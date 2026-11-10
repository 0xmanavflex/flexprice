import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCardIcon } from '@fp/ui/icons'
import successConfetti from './success-confetti.svg'
import {
  NO_USAGE_FILTER,
  isUsageFiltered,
  type PortalUsageFilter,
  type PortalOpenCheckout,
  type PortalRange,
  type PortalView,
  portalRangeWindow,
} from '@fp/domain'
import {
  ApiError,
  type PortalAuth,
  type PortalQuery,
  useAddPortalPaymentMethod,
  usePayPortalInvoice,
  usePortalCheckoutFollower,
  usePortalConfig,
  usePortalCustomer,
  usePortalGateways,
  usePortalInvoice,
  usePortalInvoicePdf,
  usePortalInvoices,
  usePortalPaymentMethods,
  usePortalPropertyKeys,
  usePortalPropertyValues,
  usePortalQuotas,
  usePortalSpend,
  usePortalSubscriptions,
  usePortalTopUps,
  usePortalWalletFlows,
  usePortalWalletTransactionPages,
  usePortalWallets,
  useRemovePortalPaymentMethod,
  useSetDefaultPortalPaymentMethod,
  useTopUpPortalWallet,
  useUpdatePortalAutoTopup,
  queryKeys,
} from '@fp/query'
import { useQueryClient } from '@tanstack/react-query'
import {
  type CustomerPortalActions,
  CustomerPortalView,
  type Load,
  PortalNotice,
  toast,
} from '@fp/ui/pages'
import { isSafeNavigationUrl } from '../safeUrl'
import type { ApiUrls } from '../publicApi'
import {
  RETURNED_PARAM,
  consumeLeftForGateway,
  gatewayReturnFailed,
  gatewayReturnPaid,
  isGatewayReturn,
  markLeavingForGateway,
  type PortalLocation,
  parsePortalLocation,
  portalHref,
  rememberForReturn,
  returnUrl as gatewayReturnUrl,
  tokenForReturn,
} from './link'

const GENERIC_ERROR = 'Something went wrong. Please try again.'
/** Transactions per page: "Load more" asks the API for the next ten. */
const PAGE = 10
/** Top-ups read at once; "Load older top-ups" reads this many more. */
const TOP_UPS = 100

/**
 * The customer portal: `/<region>[/<view>]`, opened from the link a merchant
 * sends (`?token=…`). No Flexprice session and no sign-in: the token is the
 * only credential, and when it expires the page says so.
 *
 * Navigation is the address bar's: the view, the usage range and the open
 * invoice live in the URL, so back, forward and reload all keep their place.
 */
export function PortalSurface({
  pathname,
  basePath,
  apiUrls,
  ownApiOrigin,
}: {
  pathname: string
  basePath: string
  apiUrls: ApiUrls
  /** The console's own API, for a region-less link (`/p?token=…`). */
  ownApiOrigin: string | null
}) {
  const [location, setLocation] = useState(() =>
    parsePortalLocation(pathname, window.location.search, apiUrls, ownApiOrigin),
  )
  // The token stays in the address bar, as the merchant's link has it; every
  // address the portal moves to carries it (see `navigate`). Back from a
  // gateway, the address has none: the session kept for the return opens it.
  const [token] = useState(
    () =>
      location?.token ??
      // This tab's own trip to a gateway (marker or not) restores the token it left with;
      // only a gateway tab carrying our marker falls back to the shared slot.
      consumeLeftForGateway() ??
      (new URLSearchParams(window.location.search).has(RETURNED_PARAM) ? tokenForReturn() : null),
  )
  useEffect(() => {
    if (!token || !location || location.token) return
    // Put the token back in the address, without the return marker, so reload and links work.
    window.history.replaceState(null, '', portalHref({ ...location, token }, basePath))
    setLocation({ ...location, token })
  }, [token, location, basePath])

  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname.slice(basePath.length) || '/'
      setLocation(parsePortalLocation(path, window.location.search, apiUrls, ownApiOrigin))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [basePath, apiUrls, ownApiOrigin])

  const navigate = useCallback(
    (next: PortalLocation, mode: 'push' | 'replace' = 'push') => {
      const href = portalHref({ ...next, token: next.token ?? token }, basePath)
      if (mode === 'push') window.history.pushState(null, '', href)
      else window.history.replaceState(null, '', href)
      setLocation(next)
    },
    [basePath, token],
  )

  if (!location) {
    return (
      <PortalNotice
        title="Page not found"
        body="Check the billing link you were sent. If it still doesn’t work, ask the business that sent it."
      />
    )
  }
  if (!token) {
    // Back from a gateway with no session kept in this browser: the payment page
    // opened in another browser (on a phone, a link tapped in an app pays in
    // Safari), or the kept session expired. The gateway's webhook settles the
    // payment, not this page, so it must not read as a broken link.
    //
    // With no session there is nothing to check the payment against, so the
    // page says only what the gateway's own return says. The tick is for a
    // gateway that states the payment went through; a stated failure gets the
    // neutral card; and a return that states nothing (our marker, Stripe,
    // Paddle) may be a customer who left checkout without paying, so it claims
    // neither outcome.
    const search = window.location.search
    if (!isGatewayReturn(search)) return <Expired />
    if (gatewayReturnPaid(search)) {
      return (
        <PortalNotice
          illustration={<img src={successConfetti} alt="" aria-hidden="true" className="size-28" />}
          title="You’re all set!"
          body="Head back to your billing portal to view your latest billing details."
        />
      )
    }
    if (gatewayReturnFailed(search)) {
      return (
        <PortalNotice
          icon={<CreditCardIcon />}
          title="Back to billing"
          body="Your checkout session has ended. Head back to your billing portal to view your latest billing details."
        />
      )
    }
    return (
      <PortalNotice
        icon={<CreditCardIcon />}
        title="You’re back from checkout"
        body="If you completed a payment, it’s being applied to your account. Head back to your billing portal to see your latest billing details."
      />
    )
  }
  return (
    <Portal
      auth={{ apiOrigin: location.apiOrigin, token }}
      location={location}
      navigate={navigate}
    />
  )
}

function Expired() {
  return (
    <PortalNotice
      title="This link has expired"
      body="Billing links last a limited time. Ask the business that sent it for a new one."
    />
  )
}

function Portal({
  auth,
  location,
  navigate,
}: {
  auth: PortalAuth
  location: PortalLocation
  navigate: (next: PortalLocation, mode?: 'push' | 'replace') => void
}) {
  const [walletId, setWalletId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const [usageFilter, setUsageFilter] = useState<PortalUsageFilter>(NO_USAGE_FILTER)
  const [topUpLimit, setTopUpLimit] = useState(TOP_UPS)

  const customer = usePortalCustomer(auth)
  const config = usePortalConfig(auth)
  const usageControls = config.data?.usage
  // The merchant's presets: a range they do not offer, or none in the address, opens on their default.
  const range: PortalRange =
    location.range && (usageControls?.ranges.includes(location.range) ?? true)
      ? location.range
      : (usageControls?.defaultRange ?? '30d')
  const customRange = usageControls?.customRange === false ? null : location.customRange
  const gateways = usePortalGateways(auth)
  const subscriptions = usePortalSubscriptions(auth)
  const invoices = usePortalInvoices(auth)
  const wallets = usePortalWallets(auth)
  const paymentMethods = usePortalPaymentMethods(auth)
  const quotas = usePortalQuotas(auth)
  // One window per range per day: a re-render must not move the window and refetch.
  const today = new Date().toDateString()
  const customStart = customRange?.start.getTime() ?? null
  const customEnd = customRange?.end.getTime() ?? null
  const span = useMemo(
    () =>
      customStart !== null && customEnd !== null
        ? { start: new Date(customStart), end: new Date(customEnd) }
        : portalRangeWindow(range, new Date(today)),
    [range, customStart, customEnd, today],
  )
  // Only the Usage view groups and filters, and only by keys the merchant lets customers see
  // (the server filters them). Overview's figures are never filtered.
  const onUsage = location.view === 'usage'
  const filtered = onUsage && isUsageFiltered(usageFilter)
  const filter = filtered
    ? { featureIds: usageFilter.featureIds, properties: usageFilter.properties }
    : {}
  const spend = usePortalSpend(auth, span.start, span.end, true, null, filter)
  // The feature filter offers every feature used in the window, not only the ones it kept.
  const allSpend = usePortalSpend(auth, span.start, span.end, filtered)
  const propertyKeys = usePortalPropertyKeys(auth, span.start, span.end, onUsage)
  const groupKeys = propertyKeys.data ?? []
  const propertyValues = usePortalPropertyValues(auth, span.start, span.end, groupKeys, onUsage)
  // A key that is not in this window's usage would put everything under "No value".
  const effectiveGroupBy = groupBy && groupKeys.includes(groupBy) ? groupBy : null
  const groupedSpend = usePortalSpend(
    auth,
    span.start,
    span.end,
    onUsage && effectiveGroupBy !== null,
    effectiveGroupBy,
    filter,
  )
  // The same length of time just before, for "↑ 12% vs the 30 days before".
  const previousStart = useMemo(
    () => new Date(span.start.getTime() - (span.end.getTime() - span.start.getTime())),
    [span],
  )
  const previousSpend = usePortalSpend(auth, previousStart, span.start, true, null, filter)
  // The current billing period so far, for "About $407 by Oct 12 at this pace".
  const period = subscriptions.data?.find(
    (s) => s.status === 'active' && s.periodStart && s.periodEnd,
  )
  const periodStart = period?.periodStart ?? null
  const periodNow = useMemo(() => portalRangeWindow('today', new Date(today)).end, [today])
  const periodSpend = usePortalSpend(
    auth,
    periodStart ?? periodNow,
    periodNow,
    periodStart !== null,
  )
  const wallet =
    wallets.data?.find((w) => w.id === walletId) ??
    wallets.data?.find((w) => w.active) ??
    wallets.data?.[0] ??
    null
  // The whole history, a page at a time: the list promises every credit added and used, so it
  // is not cut off at the billing period (only the "since" totals below are).
  const transactions = usePortalWalletTransactionPages(auth, wallet, PAGE)
  // "Added since" and "Used since": over the whole window, not just the loaded pages.
  // Only the Credits view shows them, and a long ledger takes many requests.
  const flows = usePortalWalletFlows(auth, wallet, periodStart, location.view === 'credits')
  const topUps = usePortalTopUps(auth, wallet, topUpLimit)
  const invoiceDetail = usePortalInvoice(auth, location.invoiceId)

  // Every trip to a gateway keeps the session for the tab the customer comes back to.
  const returnHere = () => {
    rememberForReturn(auth.token)
    return gatewayReturnUrl(window.location.href)
  }
  // A payment page opened in another tab: say here how it went once the gateway has.
  const checkout = usePortalCheckoutFollower(auth, (result) => {
    if (result.status === 'completed') toast.success('Payment received')
    else if (result.status === 'expired')
      toast.error('The payment page expired', { description: 'Nothing was charged.' })
    else
      toast.error('The payment did not go through', {
        description:
          result.failureReason ?? 'Nothing was charged. Try again or use another method.',
      })
  })
  const pay = usePayPortalInvoice(auth, checkout.follow)
  const topUp = useTopUpPortalWallet(auth, checkout.follow)
  const addCard = useAddPortalPaymentMethod(auth)
  const removeCard = useRemovePortalPaymentMethod(auth)
  const makeDefault = useSetDefaultPortalPaymentMethod(auth)
  const pdf = usePortalInvoicePdf(auth)
  const saveAutoTopup = useUpdatePortalAutoTopup(auth)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (customer.data) document.title = `Billing · ${customer.data.name}`
  }, [customer.data])

  const views = config.data?.tabs ?? ['overview', 'usage', 'credits', 'invoices']
  const view: PortalView = views.includes(location.view) ? location.view : (views[0] ?? 'overview')

  // An expired or revoked token fails every call the same way; the customer call decides.
  if (isAuthError(customer.error)) return <Expired />

  const actions: CustomerPortalActions = {
    onViewChange: (next) => navigate({ ...location, view: next, invoiceId: null }),
    onRangeChange: (range: PortalRange) =>
      navigate({ ...location, range, customRange: null }, 'replace'),
    onCustomRange: (start, end) =>
      navigate({ ...location, customRange: { start, end } }, 'replace'),
    onGroupByChange: setGroupBy,
    onUsageFilterChange: setUsageFilter,
    onWalletChange: (id) => {
      setWalletId(id)
      setTopUpLimit(TOP_UPS)
    },
    onShowMoreTransactions: transactions.loadMore,
    onShowMoreTopUps: () => setTopUpLimit((limit) => limit + TOP_UPS),
    // "I've paid": the gateway may not have told the API yet; look again now, and on focus as always.
    onRefresh: () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.customerPortal.all(auth.apiOrigin, auth.token),
      }),
    onOpenInvoice: (invoiceId) => navigate({ ...location, invoiceId }),
    payInvoice: (invoice, provider) =>
      toGateway(() =>
        pay.run({
          invoiceId: invoice.id,
          provider,
          returnUrl: returnHere(),
        }),
      ),
    addCredits: async (target, credits, via, note) => {
      const request = {
        walletId: target.id,
        credits,
        note,
        returnUrl: returnHere(),
      }
      if (via.kind === 'saved') {
        // Charged at once, unless the card's bank asks the customer to confirm. That page
        // is handed to the dialog as a link the customer clicks: a tab opened here, after
        // the request, has lost the click and pop-up blockers stop it. Reserving a tab up
        // front instead would flash an empty one on the usual, immediate charge.
        const next = await topUp
          .run({ ...request, provider: via.provider, savedCard: true })
          .then((outcome) => outcome.url)
          .catch((cause: unknown) => {
            throw new Error(messageOf(cause), { cause })
          })
        if (next === null) return null
        if (!isSafeNavigationUrl(next)) throw new Error(GENERIC_ERROR)
        return next
      }
      // Another checkout already open: the customer stays here, and the dialog asks what to do.
      let alreadyOpen: PortalOpenCheckout | null = null
      const url = await toGateway(async () => {
        const outcome = await topUp.run({
          ...request,
          provider: via.provider,
          ...(via.replace ? { replace: true } : {}),
        })
        alreadyOpen = outcome.alreadyOpen
        return outcome.url
      })
      return alreadyOpen ? { alreadyOpen } : url
    },
    addCard: (provider) =>
      toGateway(() => addCard.run({ provider, returnUrl: returnHere() }), {
        required: true,
      }),
    removeCard: async (card) => {
      await settle(() => removeCard.run({ provider: card.provider, id: card.id }))
    },
    makeDefault: async (card) => {
      await settle(() => makeDefault.run({ provider: card.provider, id: card.id }))
    },
    saveAutoTopup: async (target, settings) => {
      await settle(() =>
        saveAutoTopup.run({
          walletId: target.id,
          enabled: settings.enabled,
          threshold: settings.threshold,
          credits: settings.credits,
          cooldown: settings.cooldown,
        }),
      )
    },
    downloadInvoice: async (invoice) => {
      await inNewTab(() => pdf.run(invoice.id), { required: true })
    },
  }

  return (
    <CustomerPortalView
      brandName={null}
      brandColor={config.data?.primaryColor ?? null}
      views={views}
      {...(config.data
        ? {
            labels: config.data.labels,
            parts: config.data.parts,
            ranges: config.data.usage.ranges,
            allowCustomRange: config.data.usage.customRange,
          }
        : {})}
      groupKeys={groupKeys}
      groupBy={effectiveGroupBy}
      usageFilter={usageFilter}
      propertyValues={propertyValues.data ?? {}}
      usageFeatures={(filtered ? allSpend.data : spend.data)?.items.map((item) => ({
        id: item.featureId,
        name: item.name,
      }))}
      view={view}
      range={range}
      customRange={customRange}
      walletId={wallet?.id ?? null}
      data={{
        customer: load(customer),
        subscriptions: load(subscriptions),
        invoices: load(invoices),
        wallets: load(wallets),
        paymentMethods: loadPart(paymentMethods, (saved) => saved.cards),
        cardProviderErrors: paymentMethods.data?.unavailable ?? [],
        gateways: load(gateways),
        quotas: load(quotas),
        spend: load(spend),
        previousSpend: load(previousSpend),
        periodSpend: periodStart ? load(periodSpend) : null,
        transactions: load(transactions),
        flows: load(flows),
        topUps: load(topUps),
        invoiceDetail: location.invoiceId ? load(invoiceDetail) : null,
        groupedSpend: effectiveGroupBy ? load(groupedSpend) : null,
      }}
      actions={actions}
    />
  )
}

function load<T>(query: PortalQuery<T>): Load<T> {
  if (query.data !== undefined) return { status: 'ready', data: query.data }
  if (query.error) return { status: 'error', retry: query.refetch }
  return { status: 'loading' }
}

function loadPart<T, U>(query: PortalQuery<T>, pick: (data: T) => U): Load<U> {
  const loaded = load(query)
  return loaded.status === 'ready' ? { status: 'ready', data: pick(loaded.data) } : loaded
}

function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

/** Runs a write and turns any failure into a message the dialog can show. */
async function settle(run: () => Promise<unknown>): Promise<null> {
  try {
    await run()
    return null
  } catch (cause) {
    throw new Error(messageOf(cause), { cause })
  }
}

/**
 * Runs a write that may answer with a gateway page, and sends this tab there.
 * The gateway sends the customer back to this same tab (`returnHere`), which
 * picks the session up again and follows the checkout, so they never end up
 * with a second copy of the portal. Framed in another site's page, where a
 * gateway refuses to load, the page opens in a new tab instead (`inNewTab`).
 * The URL is handed back so the dialog keeps the link on screen until the page
 * has gone. `required`: no page in the answer is an error.
 */
async function toGateway(
  run: () => Promise<string | null>,
  options: { required?: boolean } = {},
): Promise<string | null> {
  if (isFramed()) return inNewTab(run, options)
  let url: string | null
  try {
    url = await run()
  } catch (cause) {
    throw new Error(messageOf(cause), { cause })
  }
  if (url === null) {
    if (options.required) throw new Error(GENERIC_ERROR)
    return null
  }
  if (!isSafeNavigationUrl(url)) throw new Error(GENERIC_ERROR)
  markLeavingForGateway()
  window.location.assign(url)
  return url
}

function isFramed(): boolean {
  try {
    return window.top !== window.self
  } catch {
    // A cross-origin parent cannot be read, which itself means framed.
    return true
  }
}

/**
 * Runs a write that may answer with a gateway page, and opens that page in a
 * new tab: opened on the click itself so pop-up blockers allow it, then
 * pointed at the gateway once the API answers, and the URL is handed back so
 * the dialog can keep it on screen. The portal refetches when the customer
 * comes back to it. `required`: no page in the answer is an error.
 */
async function inNewTab(
  run: () => Promise<string | null>,
  options: { required?: boolean } = {},
): Promise<string | null> {
  const tab = window.open('about:blank', '_blank')
  if (tab) tab.opener = null
  let url: string | null
  try {
    url = await run()
  } catch (cause) {
    tab?.close()
    throw new Error(messageOf(cause), { cause })
  }
  if (url === null) {
    tab?.close()
    if (options.required) throw new Error(GENERIC_ERROR)
    return null
  }
  if (!isSafeNavigationUrl(url)) {
    tab?.close()
    throw new Error(GENERIC_ERROR)
  }
  // The dialog keeps the link on screen too: the tab may have been blocked, or the portal framed.
  if (tab) tab.location.replace(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
  return url
}

function messageOf(cause: unknown): string {
  return cause instanceof ApiError && cause.fromServer && cause.message
    ? cause.message
    : GENERIC_ERROR
}

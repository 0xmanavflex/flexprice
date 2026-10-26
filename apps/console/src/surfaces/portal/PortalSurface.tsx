import { useCallback, useEffect, useMemo, useState } from 'react'
import { type PortalRange, type PortalView, portalRangeWindow } from '@fp/domain'
import {
  ApiError,
  type PortalAuth,
  type PortalQuery,
  useAddPortalPaymentMethod,
  usePayPortalInvoice,
  usePortalConfig,
  usePortalCustomer,
  usePortalGateways,
  usePortalInvoice,
  usePortalInvoicePdf,
  usePortalInvoices,
  usePortalPaymentMethods,
  usePortalQuotas,
  usePortalSpend,
  usePortalSubscriptions,
  usePortalTopUps,
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
} from '@fp/ui/pages'
import { isSafeNavigationUrl } from '../safeUrl'
import type { ApiUrls } from '../publicApi'
import { type PortalLocation, parsePortalLocation, portalHref, takePortalToken } from './link'

const GENERIC_ERROR = 'Something went wrong. Please try again.'
/** Transactions per page: "Load more" asks the API for the next ten. */
const PAGE = 10
/** Top-ups shown at once; a wallet rarely has more grants and purchases than this. */
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
  const [token] = useState(() => {
    if (!location) return null
    const taken = takePortalToken(location.region, window.location.search, sessionStore())
    // Out of the address bar before anything else can read or share it.
    if (taken.cleanSearch !== null) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${taken.cleanSearch}`,
      )
    }
    return taken.token
  })

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
      const href = portalHref(next, basePath)
      if (mode === 'push') window.history.pushState(null, '', href)
      else window.history.replaceState(null, '', href)
      setLocation(next)
    },
    [basePath],
  )

  if (!location) {
    return (
      <PortalNotice
        title="Page not found"
        body="Check the billing link you were sent. If it still doesn’t work, ask the business that sent it."
      />
    )
  }
  if (!token) return <Expired />
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

  const customer = usePortalCustomer(auth)
  const config = usePortalConfig(auth)
  const gateways = usePortalGateways(auth)
  const subscriptions = usePortalSubscriptions(auth)
  const invoices = usePortalInvoices(auth)
  const wallets = usePortalWallets(auth)
  const paymentMethods = usePortalPaymentMethods(auth)
  const quotas = usePortalQuotas(auth)
  // One window per range per day: a re-render must not move the window and refetch.
  const today = new Date().toDateString()
  const customStart = location.customRange?.start.getTime() ?? null
  const customEnd = location.customRange?.end.getTime() ?? null
  const span = useMemo(
    () =>
      customStart !== null && customEnd !== null
        ? { start: new Date(customStart), end: new Date(customEnd) }
        : portalRangeWindow(location.range, new Date(today)),
    [location.range, customStart, customEnd, today],
  )
  const spend = usePortalSpend(auth, span.start, span.end)
  // The same length of time just before, for "↑ 12% vs the 30 days before".
  const previousStart = useMemo(
    () => new Date(span.start.getTime() - (span.end.getTime() - span.start.getTime())),
    [span],
  )
  const previousSpend = usePortalSpend(auth, previousStart, span.start)
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
  // "Added since" and "Used since" the billing period's start; the latest page with no period.
  const transactions = usePortalWalletTransactionPages(auth, wallet, PAGE, periodStart)
  const topUps = usePortalTopUps(auth, wallet, TOP_UPS)
  const invoiceDetail = usePortalInvoice(auth, location.invoiceId)

  const pay = usePayPortalInvoice(auth)
  const topUp = useTopUpPortalWallet(auth)
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
  const view: PortalView = views.includes(location.view) ? location.view : 'overview'

  // An expired or revoked token fails every call the same way; the customer call decides.
  if (isAuthError(customer.error)) return <Expired />

  const actions: CustomerPortalActions = {
    onViewChange: (next) => navigate({ ...location, view: next, invoiceId: null }),
    onRangeChange: (range: PortalRange) =>
      navigate({ ...location, range, customRange: null }, 'replace'),
    onCustomRange: (start, end) =>
      navigate({ ...location, customRange: { start, end } }, 'replace'),
    onWalletChange: (id) => {
      setWalletId(id)
    },
    onShowMoreTransactions: transactions.loadMore,
    onShowMoreTopUps: () => undefined,
    // "I've paid": the gateway may not have told the API yet; look again now, and on focus as always.
    onRefresh: () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.customerPortal.all(auth.apiOrigin, auth.token),
      }),
    onOpenInvoice: (invoiceId) => navigate({ ...location, invoiceId }),
    payInvoice: (invoice, provider) =>
      inNewTab(() => pay.run({ invoiceId: invoice.id, provider, returnUrl: returnUrl() })),
    addCredits: (target, credits, via, note) =>
      via.kind === 'saved'
        ? settle(() =>
            topUp.run({
              walletId: target.id,
              credits,
              provider: null,
              note,
              returnUrl: returnUrl(),
            }),
          )
        : inNewTab(() =>
            topUp.run({
              walletId: target.id,
              credits,
              provider: via.provider,
              note,
              returnUrl: returnUrl(),
            }),
          ),
    addCard: (provider) =>
      inNewTab(() => addCard.run({ provider, returnUrl: returnUrl() }), { required: true }),
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
      view={view}
      range={location.range}
      customRange={location.customRange}
      walletId={wallet?.id ?? null}
      data={{
        customer: load(customer),
        subscriptions: load(subscriptions),
        invoices: load(invoices),
        wallets: load(wallets),
        paymentMethods: load(paymentMethods),
        gateways: load(gateways),
        quotas: load(quotas),
        spend: load(spend),
        previousSpend: load(previousSpend),
        periodSpend: periodStart ? load(periodSpend) : null,
        transactions: load(transactions),
        topUps: load(topUps),
        invoiceDetail: location.invoiceId ? load(invoiceDetail) : null,
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

function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

/** Where a gateway sends the customer back: this page as it is now (the token is already out of it). */
function returnUrl(): string {
  return window.location.href
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

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

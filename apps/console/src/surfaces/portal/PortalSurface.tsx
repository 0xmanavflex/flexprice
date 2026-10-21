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
  usePortalWalletTransactions,
  usePortalWallets,
  useRemovePortalPaymentMethod,
  useSetDefaultPortalPaymentMethod,
  useTopUpPortalWallet,
} from '@fp/query'
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
const PAGE = 20

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
}: {
  pathname: string
  basePath: string
  apiUrls: ApiUrls
}) {
  const [location, setLocation] = useState(() =>
    parsePortalLocation(pathname, window.location.search, apiUrls),
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
      setLocation(parsePortalLocation(path, window.location.search, apiUrls))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [basePath, apiUrls])

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
  const [limit, setLimit] = useState(PAGE)

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
  const span = useMemo(
    () => portalRangeWindow(location.range, new Date(today)),
    [location.range, today],
  )
  const spend = usePortalSpend(auth, span.start, span.end)
  const wallet =
    wallets.data?.find((w) => w.id === walletId) ??
    wallets.data?.find((w) => w.active) ??
    wallets.data?.[0] ??
    null
  const transactions = usePortalWalletTransactions(auth, wallet, limit)
  const invoiceDetail = usePortalInvoice(auth, location.invoiceId)

  const pay = usePayPortalInvoice(auth)
  const topUp = useTopUpPortalWallet(auth)
  const addCard = useAddPortalPaymentMethod(auth)
  const removeCard = useRemovePortalPaymentMethod(auth)
  const makeDefault = useSetDefaultPortalPaymentMethod(auth)
  const pdf = usePortalInvoicePdf(auth)

  useEffect(() => {
    if (customer.data) document.title = `Billing · ${customer.data.name}`
  }, [customer.data])

  const views = config.data?.tabs ?? ['overview', 'usage', 'credits', 'invoices']
  const view: PortalView = views.includes(location.view) ? location.view : 'overview'

  // An expired or revoked token fails every call the same way; the customer call decides.
  if (isAuthError(customer.error)) return <Expired />

  const actions: CustomerPortalActions = {
    onViewChange: (next) => navigate({ ...location, view: next, invoiceId: null }),
    onRangeChange: (range: PortalRange) => navigate({ ...location, range }, 'replace'),
    onWalletChange: (id) => {
      setWalletId(id)
      setLimit(PAGE)
    },
    onShowMoreTransactions: () => setLimit((n) => n + PAGE),
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
    removeCard: (card) => settle(() => removeCard.run({ provider: card.provider, id: card.id })),
    makeDefault: (card) => settle(() => makeDefault.run({ provider: card.provider, id: card.id })),
    downloadInvoice: (invoice) => inNewTab(() => pdf.run(invoice.id), { required: true }),
  }

  return (
    <CustomerPortalView
      brandName={null}
      brandColor={config.data?.primaryColor ?? null}
      views={views}
      view={view}
      range={location.range}
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
        transactions: load(transactions),
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
async function settle(run: () => Promise<unknown>): Promise<void> {
  try {
    await run()
  } catch (cause) {
    throw new Error(messageOf(cause), { cause })
  }
}

/**
 * Runs a write that may answer with a gateway page, and opens that page in a
 * new tab — opened on the click itself so pop-up blockers allow it, then
 * pointed at the gateway once the API answers. The portal refetches when the
 * customer comes back to it. `required`: no page in the answer is an error.
 */
async function inNewTab(
  run: () => Promise<string | null>,
  options: { required?: boolean } = {},
): Promise<void> {
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
    return
  }
  if (!isSafeNavigationUrl(url)) {
    tab?.close()
    throw new Error(GENERIC_ERROR)
  }
  if (tab) tab.location.replace(url)
  else window.location.assign(url)
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

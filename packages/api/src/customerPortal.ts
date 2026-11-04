import { publicRequest } from './publicRequest'

/**
 * The customer portal's routes, `/v1/customer/portal/*`, authenticated by the
 * session token a merchant minted for one customer
 * (`GET /customers/portal/{external_id}` → `{ url, token, expires_at }`).
 *
 * Like the hosted invoice these are called with plain `fetch`: the token is the
 * only credential, it names the tenant, environment and customer, and the
 * routes are not in the SDK. Each returns the raw JSON; `@fp/domain` maps it.
 */

const BASE = '/v1/customer/portal'

export interface PortalAuth {
  apiOrigin: string
  token: string
}

const get = (
  auth: PortalAuth,
  path: string,
  query?: Record<string, string | readonly string[] | undefined>,
) =>
  publicRequest(auth.apiOrigin, `${BASE}${path}`, {
    method: 'GET',
    token: auth.token,
    ...(query ? { query } : {}),
  })
const post = (auth: PortalAuth, path: string, body: unknown = {}) =>
  publicRequest(auth.apiOrigin, `${BASE}${path}`, { method: 'POST', token: auth.token, body })
const put = (auth: PortalAuth, path: string, body: unknown) =>
  publicRequest(auth.apiOrigin, `${BASE}${path}`, { method: 'PUT', token: auth.token, body })

const id = (value: string) => encodeURIComponent(value)

/** Who the portal is for — `GET /info`. */
export const getPortalCustomer = (auth: PortalAuth) => get(auth, '/info')
/** The tenant's portal settings: theme, sections, tabs — `GET /config`. */
export const getPortalConfig = (auth: PortalAuth) => get(auth, '/config')
/** Payment gateways the tenant has connected — `GET /integrations`. */
export const getPortalIntegrations = (auth: PortalAuth) => get(auth, '/integrations')

/** Allowances used this period, per feature — `GET /usage`. */
export const getPortalUsageSummary = (auth: PortalAuth) => get(auth, '/usage')
/**
 * Spend per feature over a window, with points — `POST /analytics/revenue`.
 * `groupBy`, an event property key, splits each feature by that property's value.
 */
export const getPortalUsageAnalytics = (
  auth: PortalAuth,
  window: { start: Date; end: Date; windowSize: 'HOUR' | 'DAY' },
  groupBy?: string,
) =>
  post(auth, '/analytics/revenue', {
    start_time: window.start.toISOString(),
    end_time: window.end.toISOString(),
    window_size: window.windowSize,
    expand: ['price', 'feature'],
    ...(groupBy ? { group_by: [`properties.${groupBy}`] } : {}),
  })
/**
 * The event property keys this customer may group usage by —
 * `POST /analytics/properties`. Empty unless the merchant switched grouping on.
 */
export const getPortalPropertyKeys = (auth: PortalAuth, window: { start: Date; end: Date }) =>
  post(auth, '/analytics/properties', {
    start_time: window.start.toISOString(),
    end_time: window.end.toISOString(),
  })

export const getPortalSubscriptions = (auth: PortalAuth, page = 1, limit = 50) =>
  post(auth, '/subscriptions', { page, limit })

export const getPortalInvoices = (auth: PortalAuth, page = 1, limit = 50) =>
  post(auth, '/invoices', { page, limit })
export const getPortalInvoice = (auth: PortalAuth, invoiceId: string) =>
  get(auth, `/invoices/${id(invoiceId)}`)
/** A short-lived PDF link — `{ presigned_url }`. */
export const getPortalInvoicePdf = (auth: PortalAuth, invoiceId: string) =>
  get(auth, `/invoices/${id(invoiceId)}/pdf`)
/** Pays an invoice now (a saved card) or returns the gateway's checkout. */
export const payPortalInvoice = (
  auth: PortalAuth,
  invoiceId: string,
  body: {
    payment_provider?: string
    idempotency_key: string
    success_url?: string
    cancel_url?: string
    failure_url?: string
  },
) => post(auth, `/invoices/${id(invoiceId)}/pay`, body)

export const getPortalWallets = (auth: PortalAuth) => post(auth, '/wallets')
export const getPortalWalletTransactions = (
  auth: PortalAuth,
  walletId: string,
  /** `type` is the API's own spelling, lowercase (`credit`, `debit`); `CREDIT` is refused. */
  query: { limit: number; offset: number; type?: 'credit' | 'debit'; since?: Date },
) =>
  get(auth, `/wallets/${id(walletId)}/transactions`, {
    limit: String(query.limit),
    offset: String(query.offset),
    ...(query.type ? { type: query.type } : {}),
    ...(query.since ? { start_time: query.since.toISOString() } : {}),
  })
/** Turns automatic top-ups on or off, and sets when and how much. */
export const updatePortalAutoTopup = (
  auth: PortalAuth,
  walletId: string,
  body: {
    enabled: boolean
    threshold?: string
    amount?: string
    cooldown?: { value: number; unit: 'minute' | 'hour' | 'day' }
  },
) => put(auth, `/wallets/${id(walletId)}/auto-topup`, body)
/** Buys credits: charged to a saved card, or a checkout to finish elsewhere. */
export const topUpPortalWallet = (
  auth: PortalAuth,
  walletId: string,
  body: {
    credits_to_add: string
    idempotency_key: string
    description?: string
    checkout: {
      payment_provider?: string
      use_saved_method?: boolean
      success_url?: string
      cancel_url?: string
      failure_url?: string
    }
  },
) => post(auth, `/wallets/${id(walletId)}/top-up`, body)

export const getPortalPaymentMethods = (auth: PortalAuth) => get(auth, '/payment-methods')
/** Starts saving a card with a gateway: returns the setup page to open. */
export const addPortalPaymentMethod = (
  auth: PortalAuth,
  body: { payment_provider: string; success_url?: string; cancel_url?: string },
) => post(auth, '/payment-methods', body)
export const deletePortalPaymentMethod = (
  auth: PortalAuth,
  body: { payment_provider: string; payment_method_id: string },
) => post(auth, '/payment-methods/delete', body)
export const setDefaultPortalPaymentMethod = (
  auth: PortalAuth,
  body: { payment_provider: string; payment_method_id: string },
) => post(auth, '/payment-methods/default', body)

/** Unused for now; kept with the routes it belongs to. */
export const updatePortalCustomer = (auth: PortalAuth, body: unknown) => put(auth, '/info', body)

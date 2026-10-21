import { request } from './settings'

/**
 * Self-billing — `/portal/billing/*`: the tenant's own Flexprice account.
 *
 * Live on the API (flexprice/flexprice#3081) but not in the SDK yet, so these
 * speak `fetch` the way `settings.ts` does. The checkout and portal-session
 * routes stay open to a suspended tenant: they are how it pays its way back.
 */

export interface SelfBillingStatusWire {
  enabled?: boolean
  status?: string
}

export interface SelfBillingInvoiceWire {
  id?: string
  number?: string
  status?: string
  payment_status?: string
  total?: string
  currency?: string
  due_date?: string | null
  pdf_url?: string | null
}

export interface SelfBillingFeatureUsageWire {
  feature?: {
    id?: string
    name?: string
    lookup_key?: string
    meter?: { event_name?: string } | null
  } | null
  total_limit?: number | null
  is_unlimited?: boolean
  current_usage?: string
}

export interface SelfBillingSummaryWire {
  status?: string
  subscription_status?: string
  trial_ends_at?: string | null
  invoices?: SelfBillingInvoiceWire[] | null
  usage?: {
    features?: SelfBillingFeatureUsageWire[] | null
    period?: { start_time?: string; end_time?: string } | null
  } | null
}

export interface SelfBillingCheckoutWire {
  checkout_id?: string
  url?: string
  status?: string
  terminal?: boolean
  tenant_status?: string
}

export interface SelfBillingCheckoutBody {
  name: string
  email: string
  address_line1: string
  address_line2: string
  address_city: string
  address_state: string
  address_country: string
  address_postal_code: string
  tax_id: string
}

export interface SelfBillingPortalWire {
  url?: string
  expires_at?: string
}

interface Credentials {
  token: string
  environmentId: string
}

/** `GET /portal/billing/status`: whether self-billing is on, and the tenant's state. */
export async function fetchSelfBillingStatus(
  serverURL: string,
  { token, environmentId }: Credentials,
): Promise<SelfBillingStatusWire> {
  return ((await request(serverURL, '/portal/billing/status', {
    method: 'GET',
    token,
    environmentId,
  })) ?? {}) as SelfBillingStatusWire
}

/** `GET /portal/billing/summary`: state, subscription, invoices and usage. Reconciles a payment on read. */
export async function fetchSelfBillingSummary(
  serverURL: string,
  { token, environmentId }: Credentials,
): Promise<SelfBillingSummaryWire> {
  return ((await request(serverURL, '/portal/billing/summary', {
    method: 'GET',
    token,
    environmentId,
  })) ?? {}) as SelfBillingSummaryWire
}

/** `POST /portal/billing/checkout`: saves the billing details and opens Stripe Checkout. */
export async function startSelfBillingCheckout(
  serverURL: string,
  { token, environmentId }: Credentials,
  body: SelfBillingCheckoutBody,
): Promise<SelfBillingCheckoutWire> {
  return ((await request(serverURL, '/portal/billing/checkout', {
    method: 'POST',
    token,
    environmentId,
    body,
  })) ?? {}) as SelfBillingCheckoutWire
}

/** `GET /portal/billing/checkout/{id}`: the checkout's state, applied to the tenant once complete. */
export async function fetchSelfBillingCheckout(
  serverURL: string,
  { token, environmentId }: Credentials,
  checkoutId: string,
): Promise<SelfBillingCheckoutWire> {
  return ((await request(serverURL, `/portal/billing/checkout/${encodeURIComponent(checkoutId)}`, {
    method: 'GET',
    token,
    environmentId,
  })) ?? {}) as SelfBillingCheckoutWire
}

/** `POST /portal/billing/checkout/{id}/cancel`: drops a checkout left before paying. */
export async function cancelSelfBillingCheckout(
  serverURL: string,
  { token, environmentId }: Credentials,
  checkoutId: string,
): Promise<void> {
  await request(serverURL, `/portal/billing/checkout/${encodeURIComponent(checkoutId)}/cancel`, {
    method: 'POST',
    token,
    environmentId,
  })
}

/** `POST /portal/billing/portal-session`: a short-lived billing portal link (pay, cards, invoices). */
export async function createSelfBillingPortalSession(
  serverURL: string,
  { token, environmentId }: Credentials,
): Promise<SelfBillingPortalWire> {
  return ((await request(serverURL, '/portal/billing/portal-session', {
    method: 'POST',
    token,
    environmentId,
  })) ?? {}) as SelfBillingPortalWire
}

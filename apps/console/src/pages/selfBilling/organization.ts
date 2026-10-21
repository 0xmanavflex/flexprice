import { type CheckoutDetails, type Tenant, emptyCheckoutDetails } from '@fp/domain'
import { useTenant, useUserInfo } from '@fp/query'

/** Settings → Organization: the tenant record the upgrade reads and writes back to. */
export function useOrganization() {
  const me = useUserInfo()
  const tenant = useTenant(me.data?.tenantId ?? '')
  return {
    tenant: tenant.data ?? null,
    /** The signed-in person's email: where Flexprice bills the workspace unless they change it. */
    userEmail: me.data?.email ?? '',
    isPending: me.isPending || (Boolean(me.data?.tenantId) && tenant.isPending),
    error: me.error ?? tenant.error,
  }
}

/** Organization holds a company and an address: the upgrade form opens filled in. */
export function hasOrganizationDetails(tenant: Tenant | null): boolean {
  return Boolean(tenant?.name && tenant.address.line1 && tenant.address.country)
}

/**
 * The upgrade form's opening values.
 *
 * The email is the person's own, never Organization's billing email: that one
 * is what the workspace's customers see as "billed by", and the API keeps it
 * apart from where Flexprice bills the workspace (flexprice/flexprice#3167).
 */
export function checkoutDefaults(tenant: Tenant | null, userEmail: string): CheckoutDetails {
  if (!tenant) return { ...emptyCheckoutDetails(), email: userEmail }
  if (!hasOrganizationDetails(tenant)) return { ...emptyCheckoutDetails(), email: userEmail }
  return {
    name: tenant.name,
    email: userEmail,
    country: tenant.address.country,
    line1: tenant.address.line1,
    line2: tenant.address.line2,
    city: tenant.address.city,
    state: tenant.address.state,
    postalCode: tenant.address.postalCode,
    taxId: '',
  }
}

/**
 * Whether the company name typed on the upgrade page differs from
 * Organization. The address needs no check (the checkout saves it), and the
 * email is not Organization's to take.
 */
export function differsInName(tenant: Tenant, details: CheckoutDetails): boolean {
  return tenant.name !== details.name
}

/**
 * Where the checkout waits while the browser is on Stripe: its id, to poll,
 * and the billing email typed for it, which the return page says the receipt
 * goes to (the API does not report it back).
 */
const CHECKOUT_KEY = 'flexprice.selfBilling.checkout'
const CHECKOUT_EMAIL_KEY = 'flexprice.selfBilling.checkoutEmail'

export function rememberCheckout(id: string, email: string): void {
  try {
    sessionStorage.setItem(CHECKOUT_KEY, id)
    sessionStorage.setItem(CHECKOUT_EMAIL_KEY, email)
  } catch {
    // Without storage the return page cannot poll; the summary still reconciles on read.
  }
}

export function recalledCheckout(): string | null {
  try {
    return sessionStorage.getItem(CHECKOUT_KEY)
  } catch {
    return null
  }
}

export function recalledCheckoutEmail(): string {
  try {
    return sessionStorage.getItem(CHECKOUT_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function forgetCheckout(): void {
  try {
    sessionStorage.removeItem(CHECKOUT_KEY)
    // The email stays for this tab: the paid page still names where the receipt went.
  } catch {
    // Nothing to forget.
  }
}

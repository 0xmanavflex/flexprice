import { type CheckoutDetails, type Tenant, emptyCheckoutDetails } from '@fp/domain'
import { useTenant, useUserInfo } from '@fp/query'

/** Settings → Organization: the tenant record the upgrade reads and writes back to. */
export function useOrganization() {
  const me = useUserInfo()
  const tenant = useTenant(me.data?.tenantId ?? '')
  return {
    tenant: tenant.data ?? null,
    isPending: me.isPending || (Boolean(me.data?.tenantId) && tenant.isPending),
    error: me.error ?? tenant.error,
  }
}

/** Organization holds a company and an address: the upgrade form opens filled in. */
export function hasOrganizationDetails(tenant: Tenant | null): boolean {
  return Boolean(tenant?.name && tenant.address.line1 && tenant.address.country)
}

/** The upgrade form's opening values. */
export function checkoutDefaults(tenant: Tenant | null): CheckoutDetails {
  if (!tenant) return emptyCheckoutDetails()
  if (!hasOrganizationDetails(tenant))
    return { ...emptyCheckoutDetails(), email: tenant.billingEmail }
  return {
    name: tenant.name,
    email: tenant.billingEmail,
    country: tenant.address.country,
    line1: tenant.address.line1,
    line2: tenant.address.line2,
    city: tenant.address.city,
    state: tenant.address.state,
    postalCode: tenant.address.postalCode,
    taxId: '',
  }
}

/** Whether the details typed on the upgrade page differ from Organization. */
export function differsFromOrganization(tenant: Tenant, details: CheckoutDetails): boolean {
  const a = tenant.address
  return (
    tenant.name !== details.name ||
    tenant.billingEmail !== details.email ||
    a.country !== details.country ||
    a.line1 !== details.line1 ||
    a.line2 !== details.line2 ||
    a.city !== details.city ||
    a.state !== details.state ||
    a.postalCode !== details.postalCode
  )
}

/** Where the checkout id waits while the browser is on Stripe. */
const CHECKOUT_KEY = 'flexprice.selfBilling.checkout'

export function rememberCheckout(id: string): void {
  try {
    sessionStorage.setItem(CHECKOUT_KEY, id)
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

export function forgetCheckout(): void {
  try {
    sessionStorage.removeItem(CHECKOUT_KEY)
  } catch {
    // Nothing to forget.
  }
}

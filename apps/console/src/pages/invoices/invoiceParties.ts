import type { CustomerDetail, Tenant, TenantAddress } from '@fp/domain'
import type { InvoiceFormParty } from '@fp/ui/pages'

/** Address parts as printable lines, blanks dropped: street lines, then "city, state postcode", then country. */
function addressLines(parts: {
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
}): string[] {
  const locality = [parts.city, [parts.state, parts.postalCode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  return [parts.line1, parts.line2, locality, parts.country].filter((line) => line.trim() !== '')
}

/** The tenant as the invoice's "From" block prints it. */
export function tenantParty(tenant: Tenant | undefined): InvoiceFormParty | null {
  if (!tenant) return null
  const address: TenantAddress = tenant.address
  return {
    name: tenant.name,
    email: tenant.billingEmail || tenant.helpEmail,
    address: addressLines(address),
  }
}

/** The customer as the invoice's "Bill to" block prints it. */
export function customerParty(customer: CustomerDetail | undefined): InvoiceFormParty | null {
  if (!customer) return null
  return {
    name: customer.name,
    email: customer.email,
    address: addressLines({
      line1: customer.addressLine1,
      line2: customer.addressLine2,
      city: customer.addressCity,
      state: customer.addressState,
      postalCode: customer.addressPostalCode,
      country: customer.addressCountry,
    }),
  }
}

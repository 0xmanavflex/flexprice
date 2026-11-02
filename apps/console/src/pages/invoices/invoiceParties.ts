import {
  type BillingEntity,
  type CustomerDetail,
  type Invoice,
  type InvoiceSellerSnapshot,
  InvoiceStatus,
  type Tenant,
  type TenantAddress,
} from '@fp/domain'
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

/** A billing entity, or the seller stamped on an issued invoice, as the "From" block prints it. */
export function entityParty(seller: BillingEntity | InvoiceSellerSnapshot): InvoiceFormParty {
  const details = 'seller' in seller ? seller.seller : seller
  const address = details.address
  return {
    name: seller.legalName || ('name' in seller ? seller.name : ''),
    email: details.email || details.helpEmail || '',
    address: addressLines({
      line1: address.line1 ?? '',
      line2: address.line2 ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      postalCode: address.postalCode ?? '',
      country: address.country ?? '',
    }),
    taxIds: seller.taxIdentifiers
      .map((id) => [id.type, id.value].filter(Boolean).join(' '))
      .filter(Boolean),
  }
}

/**
 * Who an invoice is from: an issued invoice keeps the seller stamped on it; a
 * draft or a new one is from the customer's entity (null while entities are
 * off); anything else, including an invoice issued before entities, is from the tenant.
 */
export function billFromFor(
  invoice: Pick<Invoice, 'status' | 'sellerSnapshot'> | null,
  customerEntity: BillingEntity | null,
  tenant: InvoiceFormParty | null,
): InvoiceFormParty | null {
  const isDraft = !invoice || invoice.status === InvoiceStatus.Draft
  if (!isDraft && invoice.sellerSnapshot) return entityParty(invoice.sellerSnapshot)
  if (isDraft && customerEntity) return entityParty(customerEntity)
  return tenant
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

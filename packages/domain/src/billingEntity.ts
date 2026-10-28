import { z } from 'zod'

/**
 * A billing entity: the legal seller an invoice is issued from. Entities exist
 * only in an environment whose mode is `enabled`; before that the tenant's
 * single implicit seller applies.
 */

export const BillingEntityMode = {
  Off: 'off',
  Enabling: 'enabling',
  Enabled: 'enabled',
} as const
export type BillingEntityMode = (typeof BillingEntityMode)[keyof typeof BillingEntityMode]

export interface SellerAddress {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface SellerDetails {
  email?: string
  helpEmail?: string
  phone?: string
  address: SellerAddress
}

export interface TaxIdentifier {
  type?: string
  value?: string
  country?: string
}

export interface BillingEntity {
  id: string
  name: string
  legalName: string
  isDefault: boolean
  invoiceNumberPrefix: string
  seller: SellerDetails
  taxIdentifiers: TaxIdentifier[]
  createdAt: Date | null
}

/** The entity a customer bills from; a customer without one (backfill may lag) bills from the default. */
export function effectiveEntityId(
  customer: { billingEntityId?: string | null | undefined },
  entities: readonly Pick<BillingEntity, 'id' | 'isDefault'>[],
): string {
  return customer.billingEntityId || (entities.find((entity) => entity.isDefault)?.id ?? '')
}

/** What the create and edit forms hold. */
export type BillingEntityDraft = Pick<
  BillingEntity,
  'name' | 'legalName' | 'invoiceNumberPrefix' | 'seller' | 'taxIdentifiers'
>

export const billingEntitySchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(255, 'Use 255 characters or fewer.'),
  legalName: z
    .string()
    .trim()
    .min(1, 'Enter a legal name.')
    .max(255, 'Use 255 characters or fewer.'),
  invoiceNumberPrefix: z
    .string()
    .trim()
    .min(1, 'Enter an invoice prefix.')
    .max(20, 'Use 20 characters or fewer.'),
  seller: z.object({
    email: z.string().optional(),
    helpEmail: z.string().optional(),
    phone: z.string().optional(),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    }),
  }),
  taxIdentifiers: z.array(
    z.object({
      type: z.string().trim().min(1, 'Enter a tax ID type.'),
      value: z.string().trim().min(1, 'Enter a tax ID value.'),
      country: z.string().optional(),
    }),
  ),
})

export function emptyBillingEntity(): BillingEntityDraft {
  return {
    name: '',
    legalName: '',
    invoiceNumberPrefix: '',
    seller: { email: '', helpEmail: '', phone: '', address: {} },
    taxIdentifiers: [],
  }
}

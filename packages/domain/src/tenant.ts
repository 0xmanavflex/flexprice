/**
 * The tenant: the organisation itself, and what it is paying Flexprice.
 *
 * Two unrelated things behind one noun, so they are two models:
 *
 *   - `Tenant` is the organisation's own record: name, billing contact,
 *     address. Read with `GET /tenants/{id}`, written with `PUT /tenants`.
 *   - `TenantBillingUsage` is *Flexprice's* bill to this tenant: the plan it
 *     is on and the entitlement usage against it. V1 lost this screen entirely:
 *     its `TenantApi.getTenantBillingDetails` is dead code that nothing calls.
 *
 * The second is Flexprice metering itself on Flexprice, so the shapes are the
 * ordinary subscription and usage-summary shapes, not a bespoke billing DTO.
 */
import { z } from 'zod'

export const TenantStatus = {
  Published: 'published',
  Archived: 'archived',
  Deleted: 'deleted',
} as const
export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus]

/** A postal address, flattened out of the wire's `billing_details.address`. */
export interface TenantAddress {
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
}

export function emptyAddress(): TenantAddress {
  return { line1: '', line2: '', city: '', state: '', postalCode: '', country: '' }
}

export function isEmptyAddress(address: TenantAddress): boolean {
  return Object.values(address).every((value) => value.trim().length === 0)
}

/** One line per filled field, for rendering an address as a block. */
export function formatAddress(address: TenantAddress): string[] {
  return [
    address.line1,
    address.line2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
    address.country,
  ].filter((line) => line.trim().length > 0)
}

/** The organisation's own record. */
export interface Tenant {
  id: string
  name: string
  status: TenantStatus
  /** Where invoices go. The wire nests this under `billing_details`. */
  billingEmail: string
  /** Where a customer's support mail goes, when the tenant sets one. */
  helpEmail: string
  phone: string
  address: TenantAddress
  /** Free-form key/value fields, as the API returns them. */
  metadata: Readonly<Record<string, string>>
  createdAt: Date | null
  updatedAt: Date | null
}

/** Keys the console reads from a tenant's metadata. */
export const TenantMetadataKey = {
  /** Set when the tenant is done onboarding; the support chat stops auto-opening. */
  OnboardingCompleted: 'onboarding_completed',
} as const
export type TenantMetadataKey = (typeof TenantMetadataKey)[keyof typeof TenantMetadataKey]

/** Metadata is a string map, so a flag is the string `'true'`. */
export const TenantMetadataFlag = { True: 'true', False: 'false' } as const

/** True when the tenant's metadata says onboarding is done. */
export function isTenantOnboarded(tenant: Pick<Tenant, 'metadata'> | null | undefined): boolean {
  return tenant?.metadata[TenantMetadataKey.OnboardingCompleted] === TenantMetadataFlag.True
}

const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v.length === 0 || z.string().email().safeParse(v).success, 'Enter a valid email')

/**
 * Editing the organisation.
 *
 * Every field except the name is optional and sent as `""` when cleared, so
 * emptying a billing email actually clears it rather than leaving the previous
 * value in place: `PUT /tenants` merges what it is given.
 */
export const updateTenantSchema = z.object({
  name: z.string().trim().min(1, 'Enter an organisation name'),
  billingEmail: optionalEmail,
  helpEmail: optionalEmail,
  phone: z.string().trim().optional(),
  address: z.object({
    line1: z.string().trim().optional(),
    line2: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    country: z.string().trim().optional(),
  }),
})

export type UpdateTenant = z.infer<typeof updateTenantSchema>

/** A draft seeded from the loaded tenant, so the form starts on real values. */
export function toUpdateTenantDraft(tenant: Tenant): UpdateTenant {
  return {
    name: tenant.name,
    billingEmail: tenant.billingEmail,
    helpEmail: tenant.helpEmail,
    phone: tenant.phone,
    address: {
      line1: tenant.address.line1,
      line2: tenant.address.line2,
      city: tenant.address.city,
      state: tenant.address.state,
      postalCode: tenant.address.postalCode,
      country: tenant.address.country,
    },
  }
}

/**
 * Where an entitlement comes from: the `sources[]` of a usage summary row.
 *
 * A feature can be granted by more than one contract, plan or add-on; the
 * usage on its row is the customer's total across all of them.
 */
export interface EntitlementUsageSource {
  /** The contract (subscription) the grant reaches the customer through. */
  subscriptionId: string
  /** The plan, add-on or subscription that grants it. */
  entityId: string
  /** `plan`, `addon`, `subscription`: as the API spells it. */
  entityType: string
  entityName: string
  /** `MONTHLY`, `NEVER`, … as the API spells it; `''` when not sent. */
  usageResetPeriod: string
  /** A static entitlement's value ("Premium"); `''` for other kinds. */
  staticValue: string
}

/**
 * One entitlement the tenant's Flexprice plan grants, and how much is used.
 *
 * `currentUsage` and `usagePercent` are the strings the API sent, never floats
 *: the same decimal-as-string rule the rest of the money layer follows.
 * `limit` is null when the entitlement is unlimited.
 */
export interface TenantFeatureUsage {
  featureId: string
  featureName: string
  /** `metered`, `static`, `boolean`, `config`: the feature's own type. */
  featureType: string
  /** Null when unlimited. */
  limit: number | null
  isUnlimited: boolean
  /** A decimal string, e.g. `"1042"`. */
  currentUsage: string
  /** A decimal string 0–100, e.g. `"12.5"`. */
  usagePercent: string
  isEnabled: boolean
  /** A soft limit warns; a hard limit blocks. */
  isSoftLimit: boolean
  nextUsageResetAt: Date | null
  /** The feature's plural unit ("calls"), or `''` when it has none. */
  unit: string
  /** What grants it. Empty when the API reported no source. */
  sources: EntitlementUsageSource[]
}

/** Has this entitlement been consumed past its limit? */
export function isOverLimit(usage: TenantFeatureUsage): boolean {
  if (usage.isUnlimited || usage.limit === null) return false
  return Number.parseFloat(usage.currentUsage || '0') > usage.limit
}

/** The tenant's own Flexprice subscription, narrowed to what a plan card shows. */
export interface TenantPlan {
  subscriptionId: string
  planId: string
  planName: string
  /** `active`, `cancelled`, … as the API spells it. */
  status: string
  currency: string
  /** `MONTHLY`, `ANNUAL`, … as the API spells it. */
  billingPeriod: string
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEnd: Date | null
}

/**
 * What Flexprice is billing this tenant for.
 *
 * `plans` is usually one subscription; the API returns a list because a tenant
 * can in principle hold several. `features` is the entitlement usage against
 * them. Both are empty for a tenant with no Flexprice subscription, which is a
 * legitimate state and not an error.
 */
export interface TenantBillingUsage {
  plans: TenantPlan[]
  features: TenantFeatureUsage[]
  /** The billing window the usage is measured over. Null when not in one. */
  periodStart: Date | null
  periodEnd: Date | null
}

export const EMPTY_TENANT_BILLING_USAGE: TenantBillingUsage = {
  plans: [],
  features: [],
  periodStart: null,
  periodEnd: null,
}

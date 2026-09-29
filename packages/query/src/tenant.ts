import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, type Flexprice, call } from '@fp/api'
import {
  EMPTY_TENANT_BILLING_USAGE,
  type Tenant,
  type TenantBillingUsage,
  type TenantFeatureUsage,
  type TenantPlan,
  TenantStatus,
  type UpdateTenant,
  emptyAddress,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * The tenant, and what Flexprice is billing it for.
 *
 * Two routes that read as one screen but are unrelated records:
 * `GET /tenants/{id}` for the organisation, `getTenantBillingUsage` for the
 * plan-and-usage panel V1 never shipped. The write is `PUT /tenants/update`,
 * which takes no id — it always edits the caller's own tenant.
 */

interface AddressWire {
  addressLine1?: string | undefined
  addressLine2?: string | undefined
  addressCity?: string | undefined
  addressState?: string | undefined
  addressPostalCode?: string | undefined
  addressCountry?: string | undefined
}

interface BillingDetailsWire {
  email?: string | undefined
  helpEmail?: string | undefined
  phone?: string | undefined
  address?: AddressWire | undefined
}

/** The wire shape this reads, after the SDK camelCases the response. */
export interface TenantWire {
  id?: string | undefined
  name?: string | undefined
  status?: string | undefined
  billingDetails?: BillingDetailsWire | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

const TENANT_STATUSES = new Set<string>(Object.values(TenantStatus))

export function toTenant(wire: TenantWire): Tenant {
  const status = TENANT_STATUSES.has(wire.status ?? '')
    ? (wire.status as TenantStatus)
    : TenantStatus.Published

  const address = wire.billingDetails?.address

  return {
    id: wire.id ?? '',
    name: wire.name ?? '',
    status,
    // The wire nests all four of these under `billing_details`; the domain
    // flattens them, because a form has one "billing email" field, not a path.
    billingEmail: wire.billingDetails?.email ?? '',
    helpEmail: wire.billingDetails?.helpEmail ?? '',
    phone: wire.billingDetails?.phone ?? '',
    address: address
      ? {
          line1: address.addressLine1 ?? '',
          line2: address.addressLine2 ?? '',
          city: address.addressCity ?? '',
          state: address.addressState ?? '',
          postalCode: address.addressPostalCode ?? '',
          country: address.addressCountry ?? '',
        }
      : emptyAddress(),
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

/**
 * The update request, in the SDK's camelCase.
 *
 * Every field is sent, including the empty ones, so clearing a billing email
 * clears it — `PUT /tenants/update` merges what it is given, and an omitted
 * field keeps its old value.
 *
 * The keys here are `billingDetails`, `helpEmail`, `addressLine1` and so on
 * **in camelCase**, which the SDK remaps to `billing_details`, `help_email`,
 * `address_line1`. Writing the snake_case spelling directly is silently
 * discarded: the generated zod schema strips keys the model does not declare,
 * so the request would leave as `{name}` and the address would never save.
 */
export function toUpdateTenantRequest(draft: UpdateTenant): Record<string, unknown> {
  return {
    name: draft.name,
    billingDetails: {
      email: draft.billingEmail ?? '',
      helpEmail: draft.helpEmail ?? '',
      phone: draft.phone ?? '',
      address: {
        addressLine1: draft.address.line1 ?? '',
        addressLine2: draft.address.line2 ?? '',
        addressCity: draft.address.city ?? '',
        addressState: draft.address.state ?? '',
        addressPostalCode: draft.address.postalCode ?? '',
        addressCountry: draft.address.country ?? '',
      },
    },
  }
}

export async function fetchTenant(client: Flexprice, id: string): Promise<Tenant> {
  const wire = await call(() => client.tenants.getTenantById(id))
  return toTenant(wire as TenantWire)
}

/**
 * One tenant, by id.
 *
 * The id comes from the session — `useCurrentUser().data?.tenantId`. The route
 * refuses any other tenant with a 403 ("You can only access your own tenant's
 * details"), verified live, so there is no cross-tenant lookup to build.
 */
export function useTenant(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.tenant.detail(id),
    queryFn: () => fetchTenant(client, id),
    enabled: id.length > 0,
  })
}

export function useUpdateTenant() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draft: UpdateTenant) => {
      const wire = await call(() =>
        client.tenants.updateTenant(toUpdateTenantRequest(draft) as never),
      )
      return toTenant(wire as TenantWire)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenant.all() })
      // The tenant's name is rendered in the session header.
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.all() })
    },
  })
}

/* ------------------------------------------------------------------------- */

interface FeatureUsageWire {
  feature?:
    { id?: string | undefined; name?: string | undefined; type?: string | undefined } | undefined
  totalLimit?: number | null | undefined
  isUnlimited?: boolean | undefined
  currentUsage?: string | undefined
  usagePercent?: string | undefined
  isEnabled?: boolean | undefined
  isSoftLimit?: boolean | undefined
  nextUsageResetAt?: Date | null | undefined
}

interface TenantSubscriptionWire {
  id?: string | undefined
  planId?: string | undefined
  plan?: { name?: string | undefined } | undefined
  subscriptionStatus?: string | undefined
  currency?: string | undefined
  billingPeriod?: string | undefined
  currentPeriodStart?: Date | null | undefined
  currentPeriodEnd?: Date | null | undefined
  cancelAtPeriodEnd?: boolean | undefined
  trialEnd?: Date | null | undefined
}

/** The wire shape of `getTenantBillingUsage`: `{subscriptions, usage}`. */
export interface TenantBillingUsageWire {
  subscriptions?: TenantSubscriptionWire[] | undefined
  usage?:
    | {
        customerId?: string | undefined
        features?: FeatureUsageWire[] | undefined
        period?:
          | { startTime?: Date | null | undefined; endTime?: Date | null | undefined }
          | null
          | undefined
      }
    | null
    | undefined
}

function toTenantPlan(wire: TenantSubscriptionWire): TenantPlan {
  return {
    subscriptionId: wire.id ?? '',
    planId: wire.planId ?? '',
    planName: wire.plan?.name ?? '',
    // The wire calls this `subscription_status`; `status` on the same record is
    // the row's archival state, which is not what a plan card means by status.
    status: wire.subscriptionStatus ?? '',
    currency: wire.currency ?? '',
    billingPeriod: wire.billingPeriod ?? '',
    currentPeriodStart: wire.currentPeriodStart ?? null,
    currentPeriodEnd: wire.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: wire.cancelAtPeriodEnd ?? false,
    trialEnd: wire.trialEnd ?? null,
  }
}

function toFeatureUsage(wire: FeatureUsageWire): TenantFeatureUsage {
  return {
    featureId: wire.feature?.id ?? '',
    featureName: wire.feature?.name ?? '',
    featureType: wire.feature?.type ?? '',
    // Verified live: an unlimited entitlement sends `total_limit: null`, so a
    // `?? 0` here would render "0 of 0" for something with no cap at all.
    limit: typeof wire.totalLimit === 'number' ? wire.totalLimit : null,
    isUnlimited: wire.isUnlimited ?? false,
    // Decimal strings, as the API sent them. Never parsed to a float here.
    currentUsage: wire.currentUsage ?? '0',
    usagePercent: wire.usagePercent ?? '0',
    isEnabled: wire.isEnabled ?? false,
    isSoftLimit: wire.isSoftLimit ?? false,
    nextUsageResetAt: wire.nextUsageResetAt ?? null,
  }
}

export function toTenantBillingUsage(wire: TenantBillingUsageWire): TenantBillingUsage {
  return {
    plans: (wire.subscriptions ?? []).map(toTenantPlan),
    features: (wire.usage?.features ?? []).map(toFeatureUsage),
    // `period` came back null on the live tenant even with an active monthly
    // subscription, so both ends are genuinely optional.
    periodStart: wire.usage?.period?.startTime ?? null,
    periodEnd: wire.usage?.period?.endTime ?? null,
  }
}

/**
 * What Flexprice is billing this tenant — plan, and entitlement usage.
 *
 * **This does not work on `@flexprice/sdk@2.1.30`.** The generated client calls
 * `GET /v1/tenant/billing`; the deployed route is `GET /v1/tenants/billing`,
 * plural. Verified live against `api.cloud.flexprice.io`: the SDK method
 * answers 404 `text/plain "404 page not found"`, while the plural path returns
 * `200` with exactly the `{usage, subscriptions}` body `TenantBillingUsage`
 * describes. The OpenAPI path is simply missing an `s`.
 *
 * It is **not** shimmed here on purpose. `@fp/sdk-adapter` is where a route the
 * SDK cannot reach belongs, and every shim there must name the GitHub issue
 * whose closure deletes it — inventing an issue number to get past that check
 * is how a temporary layer becomes permanent. So this calls the method the
 * corrected contract will have, and the fix is one of: correct the path in the
 * backend's OpenAPI document and republish the SDK (preferred — it is a
 * one-character change), or file the removal issue and add a four-line shim.
 *
 * Until then a 404 is reported as *unavailable* rather than *failed*: the query
 * resolves to `null`, so the panel can render an unavailable state next to the
 * other Settings sections that have no API, instead of an error nobody can act
 * on. Every other failure still throws.
 */
export async function fetchTenantBillingUsage(
  client: Flexprice,
): Promise<TenantBillingUsage | null> {
  try {
    const wire = await call(() => client.tenants.getTenantBillingUsage())
    return toTenantBillingUsage(wire as TenantBillingUsageWire)
  } catch (error) {
    if (error instanceof ApiError && error.kind === ErrorKind.NotFound) return null
    throw error
  }
}

export function useTenantBillingUsage() {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.tenant.billingUsage(),
    queryFn: () => fetchTenantBillingUsage(client),
  })
}

/** A safe value for a panel that would rather render empty than branch on null. */
export function tenantBillingUsageOrEmpty(
  usage: TenantBillingUsage | null | undefined,
): TenantBillingUsage {
  return usage ?? EMPTY_TENANT_BILLING_USAGE
}

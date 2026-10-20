import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  ErrorKind,
  type AuthSource,
  type Flexprice,
  call,
  fetchTenantBilling,
} from '@fp/api'
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
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'

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
  metadata?: Record<string, string> | undefined
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
    metadata: wire.metadata ?? {},
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

/**
 * Replace a tenant's metadata, leaving everything else alone —
 * `PUT /tenants/update` with only `name` and `metadata`, as V1 sends it.
 *
 * Separate from `useUpdateTenant` on purpose: that one always sends the
 * billing details, so using it to set one flag would overwrite them with
 * whatever the caller happened to hold.
 */
export function useUpdateTenantMetadata() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, metadata }: { name: string; metadata: Record<string, string> }) => {
      const wire = await call(() => client.tenants.updateTenant({ name, metadata } as never))
      return toTenant(wire as TenantWire)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenant.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.all() })
    },
  })
}

/* ------------------------------------------------------------------------- */

/**
 * One feature's usage against its entitlement.
 *
 * Exported because this is not tenant-specific: `TenantBillingUsage.usage` and
 * `GET /customers/usage` return the *same* `CustomerUsageSummaryResponse`, so
 * `useCustomerUsageSummary` reads a customer's quotas through this very mapper
 * rather than growing a second copy that can drift from it.
 */
export interface FeatureUsageWire {
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

export function toFeatureUsage(wire: FeatureUsageWire): TenantFeatureUsage {
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
 * The raw body, in the shape the SDK would have produced.
 *
 * `/tenants/billing` is reached with `fetch` rather than through the generated
 * client (see `fetchTenantBillingUsage`), so nothing camelCases its keys or
 * turns its timestamps into `Date`s. This does both, and then hands off to
 * `toTenantBillingUsage` — the mapper and its tests stay the ones that will
 * still be right when the SDK can make this call itself, and deleting this
 * function is the whole of the cleanup.
 */
export function toTenantBillingWire(raw: unknown): TenantBillingUsageWire {
  const body = asRecord(raw)
  const usage = asRecord(body['usage'])
  const period = asRecord(usage['period'])

  return {
    subscriptions: asArray(body['subscriptions']).map((entry) => {
      const row = asRecord(entry)
      return {
        id: text(row['id']),
        planId: text(row['plan_id']),
        plan: { name: text(asRecord(row['plan'])['name']) },
        subscriptionStatus: text(row['subscription_status']),
        currency: text(row['currency']),
        billingPeriod: text(row['billing_period']),
        currentPeriodStart: asDate(row['current_period_start']),
        currentPeriodEnd: asDate(row['current_period_end']),
        cancelAtPeriodEnd: row['cancel_at_period_end'] === true,
        trialEnd: asDate(row['trial_end']),
      }
    }),
    usage: {
      customerId: text(usage['customer_id']),
      features: asArray(usage['features']).map((entry) => {
        const row = asRecord(entry)
        const feature = asRecord(row['feature'])
        return {
          feature: {
            id: text(feature['id']),
            name: text(feature['name']),
            type: text(feature['type']),
          },
          // Preserved as null when null: an unlimited entitlement sends
          // `total_limit: null`, and a `?? 0` here renders "0 of 0" for
          // something with no cap at all.
          totalLimit: typeof row['total_limit'] === 'number' ? row['total_limit'] : null,
          isUnlimited: row['is_unlimited'] === true,
          // Decimal strings, as the API sent them. Never parsed to a float.
          currentUsage: text(row['current_usage']),
          usagePercent: text(row['usage_percent']),
          isEnabled: row['is_enabled'] === true,
          isSoftLimit: row['is_soft_limit'] === true,
          nextUsageResetAt: asDate(row['next_usage_reset_at']),
        }
      }),
      period: { startTime: asDate(period['start_time']), endTime: asDate(period['end_time']) },
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * What Flexprice is billing this tenant — plan, and entitlement usage.
 *
 * **The SDK cannot make this call, for the sake of one character.** Its
 * generated `tenants.getTenantBillingUsage()` requests `GET
 * /v1/tenant/billing`; the deployed route is `GET /v1/tenants/billing`,
 * plural. Verified live against `api.cloud.flexprice.io`: the singular path
 * answers `404 text/plain "404 page not found"` — a route that does not exist,
 * not a tenant without billing — while the plural path returns 200 with
 * exactly the `{usage, subscriptions}` body the SDK's own response model
 * describes.
 *
 * **The real fix is the backend's OpenAPI path plus an SDK republish.** It is
 * a one-character change to the document, after which this function and
 * `@fp/api`'s `fetchTenantBilling` both delete and the call goes back through
 * the client. It is deliberately not a `@fp/sdk-adapter` shim: every shim
 * there must name the GitHub issue whose closure removes it, and inventing an
 * issue number to satisfy that rule is how a temporary layer becomes
 * permanent.
 *
 * A 404 still resolves to `null` rather than throwing. The corrected path
 * should not produce one, so this now covers the case worth covering: a
 * deployment that does not bill its tenants through Flexprice at all, where a
 * panel should render "not billed here" rather than an error nobody can act
 * on. Every other failure throws.
 */
export async function fetchTenantBillingUsage(
  serverURL: string,
  token: string,
  environmentId: string,
): Promise<TenantBillingUsage | null> {
  try {
    return toTenantBillingUsage(
      toTenantBillingWire(await fetchTenantBilling(serverURL, token, environmentId)),
    )
  } catch (error) {
    if (error instanceof ApiError && error.kind === ErrorKind.NotFound) return null
    throw error
  }
}

/**
 * The tenant's bill.
 *
 * Takes no arguments, and the key carries no environment id, unlike the
 * `/settings/{key}` hooks next door. Both are deliberate: this record is the
 * tenant's — the same plan and the same entitlement usage whichever
 * environment is selected — and the environment header this route insists on
 * is an access check rather than a scope. Keying it per environment would
 * multiply one answer into as many cache entries as the tenant has
 * environments, each refetched on every switch.
 *
 * The credentials come from the same `AuthSource` the SDK client uses, read
 * per request inside the query function.
 */
export function useTenantBillingUsage() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.tenant.billingUsage(),
    queryFn: async () => {
      const { token, environmentId } = await credentials(auth)
      return fetchTenantBillingUsage(serverURL, token, environmentId)
    },
  })
}

async function credentials(auth: AuthSource): Promise<{ token: string; environmentId: string }> {
  const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])

  if (!token) {
    throw new ApiError(ErrorKind.Unauthorized, 'Sign in to see billing.')
  }
  if (!environmentId) {
    // The route answers a missing `X-Environment-ID` with a 403 reading
    // "Access denied", which describes the console mid-sign-in as a
    // permissions problem. This says what is actually true.
    throw new ApiError(ErrorKind.Forbidden, 'Choose an environment to see billing.')
  }
  return { token, environmentId }
}

/** A safe value for a panel that would rather render empty than branch on null. */
export function tenantBillingUsageOrEmpty(
  usage: TenantBillingUsage | null | undefined,
): TenantBillingUsage {
  return usage ?? EMPTY_TENANT_BILLING_USAGE
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { call } from '@fp/api'
import {
  type CreateEntitlement,
  type EditEntitlement,
  type Entitlement,
  type EntitlementAggregationMode,
  type EntitlementGrantAllocationBehavior,
  type EntitlementGrantDurationUnit,
  type EntitlementGrantMeasure,
  type EntitlementEntityType,
  FeatureType,
  UsageResetPeriod,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Entitlements: what a plan includes of a feature.
 *
 * Read with `POST /entitlements/search`, written with `POST /entitlements/bulk`
 *: the drawer queues several and commits them together. A metered entitlement
 * carries a limit where `null` means *unlimited*, a difference this module
 * preserves in both directions rather than collapsing to zero.
 */

const FEATURE_TYPES = new Set<string>(Object.values(FeatureType))
const RESET_PERIODS = new Set<string>(Object.values(UsageResetPeriod))

/** The wire shape this reads, after the SDK camelCases the response. */
export interface EntitlementWire {
  startDate?: Date | undefined
  endDate?: Date | undefined

  parentEntitlementId?: string | undefined

  id?: string | undefined
  featureId?: string | undefined
  featureType?: string | undefined
  entityType?: string | undefined
  entityId?: string | undefined
  usageLimit?: number | undefined
  usageResetPeriod?: string | undefined
  isSoftLimit?: boolean | undefined
  staticValue?: string | undefined
  isEnabled?: boolean | undefined
  configValue?: Record<string, unknown> | undefined
  grantQuota?: string | undefined
  grantMeasure?: string | undefined
  grantDurationUnit?: string | undefined
  grantDurationValue?: number | undefined
  grantAllocationBehavior?: string | undefined
  aggregationMode?: string | undefined
  feature?: { id?: string; name?: string } | undefined
  createdAt?: Date | undefined
}

export function toEntitlement(wire: EntitlementWire): Entitlement {
  const featureType = FEATURE_TYPES.has(wire.featureType ?? '')
    ? (wire.featureType as FeatureType)
    : FeatureType.Boolean
  const usageResetPeriod = RESET_PERIODS.has(wire.usageResetPeriod ?? '')
    ? (wire.usageResetPeriod as UsageResetPeriod)
    : null

  return {
    id: wire.id ?? '',
    ...(wire.startDate ? { startDate: wire.startDate } : {}),
    ...(wire.endDate ? { endDate: wire.endDate } : {}),
    ...(wire.parentEntitlementId ? { parentEntitlementId: wire.parentEntitlementId } : {}),
    featureId: wire.featureId ?? '',
    featureName: wire.feature?.name ?? null,
    featureType,
    entityType: (wire.entityType ?? 'PLAN') as EntitlementEntityType,
    entityId: wire.entityId ?? '',
    // A present number is the limit; its absence on a metered entitlement is the
    // "unlimited" case the wire encodes as no limit at all.
    usageLimit: typeof wire.usageLimit === 'number' ? wire.usageLimit : null,
    usageResetPeriod,
    isSoftLimit: wire.isSoftLimit ?? false,
    // The API sends "" for an unset static value; keep it absent so an edit form
    // does not seed (and then fail validating) a hidden empty field.
    staticValue: wire.staticValue ? wire.staticValue : null,
    isEnabled: typeof wire.isEnabled === 'boolean' ? wire.isEnabled : null,
    configValue: wire.configValue ?? null,
    grantQuota: wire.grantQuota ? wire.grantQuota : null,
    grantMeasure: (wire.grantMeasure ?? null) as EntitlementGrantMeasure | null,
    grantDurationUnit: (wire.grantDurationUnit ?? null) as EntitlementGrantDurationUnit | null,
    grantDurationValue:
      typeof wire.grantDurationValue === 'number' ? wire.grantDurationValue : null,
    grantAllocationBehavior: (wire.grantAllocationBehavior ??
      null) as EntitlementGrantAllocationBehavior | null,
    aggregationMode: (wire.aggregationMode ?? null) as EntitlementAggregationMode | null,
    createdAt: wire.createdAt ?? null,
  }
}

/**
 * A grant draft, as a `CreateEntitlementRequest`.
 *
 * Only the fields the feature type uses are sent: a boolean grant carries a
 * flag and nothing else: so the backend never has to reconcile a static value
 * on a metered entitlement. The entity it belongs to is tagged on every one.
 */
export function toEntitlementRequest(
  draft: CreateEntitlement,
  entityType: EntitlementEntityType,
  entityId: string,
): Record<string, unknown> {
  const common: Record<string, unknown> = {
    featureId: draft.featureId,
    featureType: draft.featureType,
    entityType,
    entityId,
  }

  switch (draft.featureType) {
    case FeatureType.Metered: {
      // V1's grant model: a quota (or unlimited) per window. Only what the
      // window uses is sent; usage_limit and usage_reset_period are not.
      const grant = draft.grant
      if (grant) {
        const unlimited = grant.quota === null
        // Unlimited has no window to reset: it runs over the billing period.
        const unit = unlimited ? 'subscription_period' : grant.unit
        const windowed = unit !== 'subscription_period'
        return {
          ...common,
          grantMeasure: grant.measure,
          ...(unlimited ? { grantUnlimited: true } : { grantQuota: grant.quota }),
          grantDurationUnit: unit,
          ...(windowed
            ? { grantDurationValue: grant.every ?? 1, grantAllocationBehavior: grant.allocation }
            : {}),
          aggregationMode: grant.aggregation,
        }
      }
      return {
        ...common,
        // Unlimited is no limit at all: the SDK rejects null, so the key is left out.
        ...(draft.usageLimit !== null ? { usageLimit: draft.usageLimit } : {}),
        ...(draft.usageResetPeriod ? { usageResetPeriod: draft.usageResetPeriod } : {}),
        isSoftLimit: draft.isSoftLimit,
      }
    }
    case FeatureType.Static:
      return { ...common, staticValue: draft.staticValue }
    case FeatureType.Boolean:
      return { ...common, isEnabled: draft.isEnabled }
    case FeatureType.Config:
      return { ...common, configValue: draft.configValue }
  }
}

/** The entitlements a plan (or add-on) grants. `expand: 'features'` names each one. */
export function useEntitlements(entityType: EntitlementEntityType, entityId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.entitlements.list({ entityType, entityId }),
    queryFn: async () => {
      const response = await call(() =>
        client.entitlements.queryEntitlement({
          entityType,
          entityIds: [entityId],
          expand: 'features',
          limit: 100,
          offset: 0,
        } as never),
      )
      return (response.items ?? []).map((item) => toEntitlement(item as EntitlementWire))
    },
    enabled: entityId.length > 0,
  })
}

/** The entitlements of many plans in one request, for the pricing catalogue. */
export function usePlanEntitlements(planIds: string[]) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.entitlements.list({ entityType: 'PLAN', entityIds: planIds }),
    queryFn: async () => {
      const response = await call(() =>
        client.entitlements.queryEntitlement({
          entityType: 'PLAN',
          entityIds: planIds,
          expand: 'features',
          limit: 1000,
          offset: 0,
        } as never),
      )
      return (response.items ?? []).map((item) => toEntitlement(item as EntitlementWire))
    },
    enabled: planIds.length > 0,
  })
}

/** An entitlement, plus the plan or add-on that grants it. */
export interface FeatureEntitlementLink {
  entitlement: Entitlement
  parentName: string
  parentStatus: string
}

type NamedParent = { id?: string; name?: string; status?: string }

type GrantWire = EntitlementWire & {
  plan?: NamedParent
  addon?: NamedParent
}

/**
 * Every plan and add-on entitlement that grants this feature.
 *
 * `POST /entitlements/search` takes `featureIds` and no expand.
 *
 * It used to ask for `expand: 'plan,addon'`. Unlike `/prices/search`, this
 * route does not refuse that: checked against the live API, it answers `200`
 *: but it does not honour it either: the rows come back with no `plan` and no
 * `addon` key whether it is sent or not. So it was a field that travelled on
 * every request and bought nothing.
 *
 * The parent names come from the lookup below, which is how the useless
 * expand went unnoticed: nothing depended on it working.
 */
export function useFeatureEntitlements(featureId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.entitlements.list({ featureId, scope: 'feature' }),
    enabled: featureId.length > 0,
    queryFn: async (): Promise<FeatureEntitlementLink[]> => {
      const response = await call(() =>
        client.entitlements.queryEntitlement({
          featureIds: [featureId],
          limit: 100,
          offset: 0,
        } as never),
      )
      const items = ((response.items ?? []) as GrantWire[]).filter(
        (item) =>
          item.featureId === featureId &&
          (item.entityType === 'PLAN' || item.entityType === 'ADDON'),
      )

      const missing = (type: string) => [
        ...new Set(
          items
            .filter((item) => item.entityType === type && item.entityId && !namedGrant(item, type))
            .map((item) => item.entityId as string),
        ),
      ]
      const planIds = missing('PLAN')
      const addonIds = missing('ADDON')
      const [plans, addons] = await Promise.all([
        planIds.length > 0
          ? call(() =>
              client.plans.queryPlan({ planIds, limit: planIds.length, offset: 0 } as never),
            ).then((page) => (page.items ?? []) as NamedParent[])
          : [],
        addonIds.length > 0
          ? call(() =>
              client.addons.queryAddon({ addonIds, limit: addonIds.length, offset: 0 } as never),
            ).then((page) => (page.items ?? []) as NamedParent[])
          : [],
      ])
      const byId = (rows: NamedParent[]) =>
        new Map(rows.filter((row) => row.id).map((row) => [row.id as string, row]))
      const planById = byId(plans)
      const addonById = byId(addons)

      return items.map((item) => {
        const looked =
          item.entityType === 'ADDON'
            ? (item.addon ?? (item.entityId ? addonById.get(item.entityId) : undefined))
            : (item.plan ?? (item.entityId ? planById.get(item.entityId) : undefined))
        return {
          entitlement: toEntitlement(item),
          parentName:
            looked?.name || (item.entityType === 'ADDON' ? 'Untitled add-on' : 'Untitled plan'),
          parentStatus: looked?.status || 'published',
        }
      })
    },
  })
}

function namedGrant(item: GrantWire, type: string): boolean {
  return type === 'ADDON' ? Boolean(item.addon?.name) : Boolean(item.plan?.name)
}

/** Grant several entitlements in one call. */
export function useCreateBulkEntitlements() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      entitlements,
    }: {
      entityType: EntitlementEntityType
      entityId: string
      entitlements: CreateEntitlement[]
    }) =>
      call(() =>
        client.entitlements.createEntitlementsBulk({
          items: entitlements.map((entitlement) =>
            toEntitlementRequest(entitlement, entityType, entityId),
          ),
        } as never),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.entitlements.all() })
    },
  })
}

/** Remove an entitlement. The delete carries no body: just the id. */
export function useDeleteEntitlement() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.entitlements.deleteEntitlement(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.entitlements.all() })
    },
  })
}

/**
 * Domain edit out, `UpdateEntitlementRequest` in. Every key is optional and an
 * absent one is left alone. The SDK cannot send null, so a limit cannot be
 * cleared back to "unlimited" through this call.
 */
export function toUpdateEntitlementRequest(draft: EditEntitlement): Record<string, unknown> {
  const request: Record<string, unknown> = {}
  const keys = [
    'usageLimit',
    'usageResetPeriod',
    'isSoftLimit',
    'staticValue',
    'isEnabled',
    'configValue',
    'grantQuota',
    'grantMeasure',
    'grantDurationUnit',
    'grantDurationValue',
    'grantAllocationBehavior',
    'aggregationMode',
    'clearGrantConfig',
  ] as const
  for (const key of keys) {
    if (draft[key] !== undefined) request[key] = draft[key]
  }
  // The grant form's allowance, as V1 updates it: every grant field, with
  // unlimited said outright so a quota can be cleared or set again.
  const grant = draft.grant
  if (grant) {
    const unlimited = grant.quota === null
    const unit = unlimited ? 'subscription_period' : grant.unit
    const windowed = unit !== 'subscription_period'
    Object.assign(request, {
      grantMeasure: grant.measure,
      grantUnlimited: unlimited,
      ...(unlimited ? {} : { grantQuota: grant.quota }),
      grantDurationUnit: unit,
      ...(windowed
        ? { grantDurationValue: grant.every ?? 1, grantAllocationBehavior: grant.allocation }
        : {}),
      aggregationMode: grant.aggregation,
    })
  }
  return request
}

export function useUpdateEntitlement() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: EditEntitlement }) =>
      call(() =>
        client.entitlements.updateEntitlement(id, toUpdateEntitlementRequest(draft) as never),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.entitlements.all() })
    },
  })
}

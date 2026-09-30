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
 * — the drawer queues several and commits them together. A metered entitlement
 * carries a limit where `null` means *unlimited*, a difference this module
 * preserves in both directions rather than collapsing to zero.
 */

const FEATURE_TYPES = new Set<string>(Object.values(FeatureType))
const RESET_PERIODS = new Set<string>(Object.values(UsageResetPeriod))

/** The wire shape this reads, after the SDK camelCases the response. */
export interface EntitlementWire {
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
 * Only the fields the feature type uses are sent — a boolean grant carries a
 * flag and nothing else — so the backend never has to reconcile a static value
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
    case FeatureType.Metered:
      return {
        ...common,
        usageLimit: draft.usageLimit,
        ...(draft.usageResetPeriod ? { usageResetPeriod: draft.usageResetPeriod } : {}),
        isSoftLimit: draft.isSoftLimit,
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

/** Remove an entitlement. The delete carries no body — just the id. */
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

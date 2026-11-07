import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, call, type FlexpriceModels } from '@fp/api'
import { EntitlementEntityType, type EditEntitlement, type Entitlement } from '@fp/domain'
import { useFlexprice } from './provider'
import { queryKeys } from './keys'
import { fromWire } from './wire'
import { toEntitlement, toUpdateEntitlementRequest, type EntitlementWire } from './entitlements'

export interface ContractBenefitRecord {
  entitlement: Entitlement
  name: string
  source: string
}

type BenefitResponse = {
  features?: {
    feature?: { name?: string }
    sources?: { entitlementId?: string; entityName?: string; entityType?: string }[]
  }[]
  subscriptionEntitlementGrants?: { entitlements?: EntitlementWire[] }
}

/** Keep each contributing source separate: an aggregate value is not an editable entitlement. */
export function useContractBenefitRecords(subscriptionId: string) {
  const client = useFlexprice()
  return useQuery({
    queryKey: [...queryKeys.subscriptions.all(), subscriptionId, 'benefit-records'],
    enabled: Boolean(subscriptionId),
    queryFn: async (): Promise<ContractBenefitRecord[]> => {
      let response: BenefitResponse
      try {
        response = (await call(() =>
          client.subscriptions.getSubscriptionEntitlements(subscriptionId),
        )) as BenefitResponse
      } catch (error) {
        if (!(error instanceof ApiError) || !error.cause || typeof error.cause !== 'object')
          throw error
        const cause = error.cause as { rawValue?: unknown; body?: string; statusCode?: number }
        const status = cause.statusCode ?? error.status
        if (status !== undefined && (status < 200 || status >= 300)) throw error
        let raw = cause.rawValue
        if (!raw && cause.body) {
          try {
            raw = JSON.parse(cause.body)
          } catch {
            throw error
          }
        }
        if (!raw || typeof raw !== 'object' || !('features' in raw)) throw error
        response = fromWire<BenefitResponse>(raw)
      }
      const sources = (response.features ?? []).flatMap((feature) =>
        (feature.sources ?? [])
          .filter((source) => source.entitlementId)
          .map((source) => ({
            id: source.entitlementId!,
            name: feature.feature?.name ?? 'Feature',
            source: source.entityName || source.entityType || 'Contract',
          })),
      )
      const featureRecords = await Promise.all(
        sources.map(async (source) => ({
          entitlement: toEntitlement(
            (await call(() => client.entitlements.getEntitlement(source.id))) as EntitlementWire,
          ),
          name: source.name,
          source: source.source,
        })),
      )
      // The effective endpoint omits disabled features. Read this contract's
      // source records separately so an override never removes its own reset action.
      const ownRecords: ContractBenefitRecord[] = []
      for (let offset = 0; ; offset += 100) {
        const page = await call(() =>
          client.entitlements.queryEntitlement({
            entityType: EntitlementEntityType.Subscription,
            entityIds: [subscriptionId],
            expand: 'features',
            limit: 100,
            offset,
          }),
        )
        const items = (page.items ?? []) as EntitlementWire[]
        for (const wire of items) {
          const entitlement = toEntitlement(wire)
          if (
            entitlement.entityId !== subscriptionId ||
            entitlement.entityType !== EntitlementEntityType.Subscription
          )
            continue
          ownRecords.push({
            entitlement,
            name: entitlement.featureName || entitlement.featureId || 'All usage charges',
            source: 'Contract',
          })
        }
        if (items.length < 100) break
      }
      const allRecords = [
        ...new Map(
          [...featureRecords, ...ownRecords].map((row) => [row.entitlement.id, row]),
        ).values(),
      ]
      const overridden = new Set(
        allRecords.flatMap((row) =>
          row.entitlement.parentEntitlementId ? [row.entitlement.parentEntitlementId] : [],
        ),
      )
      return [
        ...allRecords.filter((row) => !overridden.has(row.entitlement.id)),
        ...(response.subscriptionEntitlementGrants?.entitlements ?? [])
          .filter((wire) => !allRecords.some((row) => row.entitlement.id === wire.id))
          .map((wire) => ({
            entitlement: toEntitlement(wire),
            name: 'All usage charges',
            source: 'Contract spending allowance',
          })),
      ]
    },
  })
}

/** Update a contract source in place; inherited sources get a contract-only override. */
export function toContractEntitlementOverride(
  subscriptionId: string,
  entitlement: Entitlement,
  draft: EditEntitlement,
): FlexpriceModels.CreateEntitlementRequest {
  return {
    ...toUpdateEntitlementRequest(draft),
    entityType: EntitlementEntityType.Subscription,
    entityId: subscriptionId,
    featureId: entitlement.featureId,
    featureType: entitlement.featureType,
    parentEntitlementId: entitlement.id,
  } as FlexpriceModels.CreateEntitlementRequest
}

export function useEditContractEntitlement(subscriptionId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ entitlement, draft }: { entitlement: Entitlement; draft: EditEntitlement }) =>
      entitlement.entityType === EntitlementEntityType.Subscription &&
      entitlement.entityId === subscriptionId
        ? call(() =>
            client.entitlements.updateEntitlement(
              entitlement.id,
              toUpdateEntitlementRequest(draft) as FlexpriceModels.UpdateEntitlementRequest,
            ),
          )
        : call(() =>
            client.entitlements.createEntitlement(
              toContractEntitlementOverride(subscriptionId, entitlement, draft),
            ),
          ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.usageAll() })
    },
  })
}

export function useResetContractEntitlement(subscriptionId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entitlement: Entitlement) => {
      if (
        entitlement.entityType !== EntitlementEntityType.Subscription ||
        entitlement.entityId !== subscriptionId
      )
        throw new Error('Only this contract’s own entitlement can be removed or reset.')
      return call(() => client.entitlements.deleteEntitlement(entitlement.id))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.usageAll() })
    },
  })
}

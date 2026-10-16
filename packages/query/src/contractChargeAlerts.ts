import { useQuery } from '@tanstack/react-query'
import { call, type Flexprice } from '@fp/api'
import { AlertEntityType, type ChargeAlert } from '@fp/domain'
import { useFlexprice } from './provider'
import { queryKeys } from './keys'

/** One paginated search for the contract, never one request per charge. */
export async function fetchContractChargeAlerts(
  client: Flexprice,
  id: string,
  signal?: AbortSignal,
) {
  const result = new Map<string, ChargeAlert[]>()
  for (let offset = 0; ; offset += 100) {
    const page = await call(
      (options) =>
        client.alertSettings.queryAlertSettings(
          {
            entityType: AlertEntityType.SubscriptionLineItem,
            parentEntityId: id,
            enabled: true,
            status: 'published',
            limit: 100,
            offset,
          },
          options,
        ),
      signal,
    )
    const items = page.items ?? []
    for (const item of items) {
      if (
        !item.entityId ||
        item.parentEntityId !== id ||
        item.entityType !== AlertEntityType.SubscriptionLineItem ||
        item.status === 'archived' ||
        item.enabled === false ||
        item.config?.alertEnabled === false
      )
        continue
      const values = result.get(item.entityId) ?? []
      for (const level of ['info', 'warning', 'critical'] as const) {
        const threshold = item.config?.[level]
        if (!threshold?.threshold) continue
        const thresholdType =
          item.config?.alertThresholdType === 'absolute' ? 'absolute' : 'percentage'
        values.push({
          level: level[0]!.toUpperCase() + level.slice(1),
          condition: threshold.condition ?? 'above',
          value: `${threshold.threshold}${thresholdType === 'percentage' ? '%' : ' (absolute)'}`,
          thresholdType,
          threshold: threshold.threshold,
          ...(item.id ? { settingId: item.id } : {}),
        })
      }
      result.set(item.entityId, values)
    }
    if (items.length < 100 || offset + items.length >= (page.pagination?.total ?? Infinity)) break
  }
  return result
}

export function useContractChargeAlerts(id: string) {
  const client = useFlexprice()
  return useQuery({
    queryKey: [...queryKeys.alertSettings.all(), 'contract-charges', id],
    queryFn: ({ signal }) => fetchContractChargeAlerts(client, id, signal),
    enabled: Boolean(id),
  })
}

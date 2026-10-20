import { useQuery } from '@tanstack/react-query'
import { call } from '@fp/api'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/** Id → name, for the ids that resolved. An id the API did not return is absent. */
export type NameMap = Readonly<Record<string, string>>

const unique = (ids: readonly string[]) => [...new Set(ids.filter(Boolean))].sort()

/**
 * Names for a handful of features, in one `POST /features/search`.
 *
 * For views that hold only ids, such as an event's processed usage, and want
 * to show "API calls" rather than \`feat_01M5…\`. Absent names fall back to the id.
 */
export function useFeatureNames(ids: readonly string[]) {
  const client = useFlexprice()
  const featureIds = unique(ids)

  return useQuery({
    queryKey: queryKeys.features.list({ names: featureIds }),
    queryFn: async (): Promise<NameMap> => {
      const response = await call(() =>
        client.features.queryFeature({ featureIds, limit: featureIds.length, offset: 0 }),
      )
      return Object.fromEntries(
        (response.items ?? []).flatMap((item) =>
          item.id && item.name ? [[item.id, item.name]] : [],
        ),
      )
    },
    enabled: featureIds.length > 0,
  })
}

/** Names for a handful of customers, in one `POST /customers/search`. */
export function useCustomerNames(ids: readonly string[]) {
  const client = useFlexprice()
  const customerIds = unique(ids)

  return useQuery({
    queryKey: queryKeys.customers.list({ names: customerIds }),
    queryFn: async (): Promise<NameMap> => {
      const response = await call(() =>
        client.customers.queryCustomer({ customerIds, limit: customerIds.length, offset: 0 }),
      )
      return Object.fromEntries(
        (response.items ?? []).flatMap((item) =>
          item.id && item.name ? [[item.id, item.name]] : [],
        ),
      )
    },
    enabled: customerIds.length > 0,
  })
}

import { useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, call, pushToIntegrations, type Flexprice } from '@fp/api'
import { toIntegrationLinks } from './customers'
import { queryKeys } from './keys'
import { useConnections } from './integrations'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/** Entity types documented by the SDK mappings endpoint; never reuse customer mappings. */
export type MappedEntityType = 'invoice' | 'plan' | 'payment'
export const entityIntegrationKey = (type: MappedEntityType, id: string) =>
  ['integrationLinks', type, id] as const

export async function fetchEntityIntegrationLinks(
  client: Flexprice,
  type: MappedEntityType,
  id: string,
  signal?: AbortSignal,
) {
  const response = await call(
    (options) => client.integrations.getEntityIntegrationMappings(type, id, options),
    signal,
  )
  return toIntegrationLinks(response.items)
}

function options(client: Flexprice, type: MappedEntityType, id: string) {
  return {
    queryKey: entityIntegrationKey(type, id),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchEntityIntegrationLinks(client, type, id, signal),
    enabled: Boolean(id),
    staleTime: 60_000,
  }
}

export function useEntityIntegrationLinks(type: MappedEntityType, id: string) {
  return useQuery(options(useFlexprice(), type, id))
}

/** Only the visible page is read; list and detail share cached entity keys. */
export function useEntityIntegrationColumns(type: MappedEntityType, entityIds: readonly string[]) {
  const client = useFlexprice()
  const ids = [...new Set(entityIds)]
  const queries = useQueries({ queries: ids.map((id) => options(client, type, id)) })
  return new Map(
    ids.map((id, index) => {
      const query = queries[index]!
      return [
        id,
        {
          links: query.data,
          state: query.data
            ? ('ready' as const)
            : query.isError
              ? ('error' as const)
              : ('loading' as const),
          retry: () => {
            void query.refetch()
          },
        },
      ] as const
    }),
  )
}

/** Shared mutations invalidate the same cache read by the list, header and Related. */
export function useEntityIntegrationControls(type: MappedEntityType, id: string) {
  const mappings = useEntityIntegrationLinks(type, id)
  const providers = useConnections()
  const client = useFlexprice()
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const cache = useQueryClient()
  const refresh = () => cache.invalidateQueries({ queryKey: entityIntegrationKey(type, id) })
  const link = useMutation({
    mutationFn: (input: { providerType: string; providerEntityId: string }) =>
      call(() =>
        client.integrations.linkIntegrationMapping({ ...input, entityType: type, entityId: id }),
      ),
    onSuccess: refresh,
  })
  const unlink = useMutation({
    mutationFn: (input: { providerType: string }) =>
      call(() =>
        client.integrations.delinkIntegrationMapping({ ...input, entityType: type, entityId: id }),
      ),
    onSuccess: refresh,
  })
  // V1's "Push to Integration": the API writes the entity to every connection
  // that syncs this type outbound, creating the provider record when unmapped.
  const sync = (method: 'push' | 'pull') => async () => {
    const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
    if (!token) throw new ApiError(ErrorKind.Unauthorized, `Sign in to ${method} this ${type}.`)
    if (!environmentId) throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
    await pushToIntegrations(
      serverURL,
      token,
      environmentId,
      { entityType: type, entityId: id },
      method,
    )
  }
  const push = useMutation({ mutationFn: sync('push'), onSuccess: refresh })
  // V1's "Pull from Integration": the provider's copy is read back over this one.
  const pull = useMutation({
    mutationFn: sync('pull'),
    onSuccess: () => {
      void refresh()
      if (type === 'invoice') void cache.invalidateQueries({ queryKey: queryKeys.invoices.all() })
    },
  })
  // The providers a push reaches: connected, with this entity's outbound sync on.
  const pushProviders = (providers.data ?? [])
    .filter((provider) =>
      provider.connections.some((connection) => connection.syncConfig[type]?.outbound),
    )
    .map((provider) => provider.name)
  return {
    ...mappings,
    push,
    pushProviders,
    pull,
    // The providers a pull reads from: connected, with this entity's inbound sync on.
    pullProviders: (providers.data ?? [])
      .filter((provider) =>
        provider.connections.some((connection) => connection.syncConfig[type]?.inbound),
      )
      .map((provider) => provider.name),
    controls: mappings.isSuccess
      ? {
          links: mappings.data,
          linkable: (providers.data ?? [])
            .filter(
              (provider) =>
                provider.connections.length > 0 &&
                !mappings.data.some((mapping) => mapping.providerType === provider.providerType),
            )
            .map(({ providerType, name }) => ({ providerType, name })),
          onLink: (input: { providerType: string; providerEntityId: string }) =>
            link.mutateAsync(input),
          onUnlink: (input: { providerType: string }) => unlink.mutateAsync(input),
        }
      : undefined,
  }
}

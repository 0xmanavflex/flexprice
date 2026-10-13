import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type Addon,
  type AddonQuery,
  AddonSortField,
  AddonStatus,
  type CreateAddon,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import { nameContainsFilter } from './search'

/**
 * Add-ons: the translation between product vocabulary and the API.
 *
 * Reached through `POST /addons/search` (`client.addons.queryAddon`), the same
 * search shape features and plans use. The add-on shares a plan's charges and
 * entitlements, but the list needs only the name/status shell — the rest is the
 * editor's concern.
 */

/** The wire shape this reads, after the SDK camelCases the response. */
export interface AddonWire {
  id?: string | undefined
  name?: string | undefined
  lookupKey?: string | undefined
  description?: string | undefined
  status?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
  metadata?: Record<string, string> | null | undefined
}

const ADDON_STATUSES = new Set<string>(Object.values(AddonStatus))

export function toAddon(wire: AddonWire): Addon {
  const status = ADDON_STATUSES.has(wire.status ?? '')
    ? (wire.status as AddonStatus)
    : AddonStatus.Published

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled add-on',
    lookupKey: wire.lookupKey ?? '',
    description: wire.description ?? '',
    status,
    metadata: wire.metadata ?? {},
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

const SORT_FIELD: Record<AddonSortField, string> = {
  [AddonSortField.Name]: 'name',
  [AddonSortField.CreatedAt]: 'created_at',
  [AddonSortField.UpdatedAt]: 'updated_at',
}

export function toAddonFilter(query: AddonQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: [{ field: SORT_FIELD[query.sortBy], direction: query.sortDirection }],
    ...(query.search ? { filters: nameContainsFilter(query.search) } : {}),
  }
}

export interface AddonPage {
  addons: Addon[]
  total: number
}

export async function fetchAddons(client: Flexprice, query: AddonQuery): Promise<AddonPage> {
  const response = await call(() => client.addons.queryAddon(toAddonFilter(query) as never))
  const addons = (response.items ?? []).map((item) => toAddon(item as AddonWire))

  return {
    // Status is not a server-side filter here, so it is applied on the page.
    addons:
      query.statuses.length > 0
        ? addons.filter((addon) => query.statuses.includes(addon.status))
        : addons,
    total: response.pagination?.total ?? 0,
  }
}

export function useAddons(query: AddonQuery) {
  const client = useFlexprice()

  // `view` is a layout, not a filter: it must not miss the cache on a toggle.
  const { view: _view, ...key } = query

  return useQuery({
    queryKey: queryKeys.addons.list({ ...key, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchAddons(client, query),
    placeholderData: (previous) => previous,
  })
}

/**
 * Create and edit share the details draft; the wire splits them.
 *
 * Create requires the lookup key; update does not accept one — an integration
 * keys off it, so it is fixed once set. Empty optional fields are dropped rather
 * than sent as `""`, which is a different value to the API than absent.
 */
export function toCreateAddonRequest(draft: CreateAddon): Record<string, unknown> {
  return {
    name: draft.name,
    lookupKey: draft.lookupKey,
    ...(draft.description ? { description: draft.description } : {}),
  }
}

export function toUpdateAddonRequest(draft: CreateAddon): Record<string, unknown> {
  return {
    name: draft.name,
    // `description` is cleared with an empty string rather than omitted, so
    // removing the text on an edit actually removes it.
    description: draft.description ?? '',
    ...(draft.metadata ? { metadata: draft.metadata } : {}),
  }
}

export function useCreateAddon() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: CreateAddon) =>
      call(() => client.addons.createAddon(toCreateAddonRequest(draft) as never)),
    onSuccess: () => {
      // Invalidating the prefix covers every list and filter combination.
      void queryClient.invalidateQueries({ queryKey: queryKeys.addons.all() })
    },
  })
}

export function useUpdateAddon() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: CreateAddon }) =>
      call(() => client.addons.updateAddon(id, toUpdateAddonRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addons.all() })
    },
  })
}

/** One add-on, fetched by id through `GET /addons/{id}`. */
export function useAddon(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.addons.detail(id),
    queryFn: async () => {
      const response = await call(() => client.addons.getAddon(id))
      return toAddon(response as AddonWire)
    },
    enabled: id.length > 0,
  })
}

/** Delete — `DELETE` by id. Takes the record id. */
export function useDeleteAddon() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.addons.deleteAddon(id)),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addons.all() })
      void queryClient.removeQueries({ queryKey: queryKeys.addons.detail(id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() })
    },
  })
}

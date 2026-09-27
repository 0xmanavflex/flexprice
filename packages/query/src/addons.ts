import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import { type Addon, type AddonQuery, AddonSortField, AddonStatus } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

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
    ...(query.search ? { nameContains: query.search } : {}),
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

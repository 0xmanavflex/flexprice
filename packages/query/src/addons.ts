import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type Addon,
  type AddonQuery,
  AddonSortField,
  AddonStatus,
  type CreateAddon,
  ADDON_FILTERS,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import { nameContainsFilter, statusFilterField, toFilterConditions } from './search'
import { sortWithTieBreak } from './listSort'

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
  /** Present only with `expand: 'prices'`; absent when the add-on has none. */
  prices?: unknown[] | null | undefined
}

const ADDON_STATUSES = new Set<string>(Object.values(AddonStatus))

export function toAddon(wire: AddonWire): Addon {
  const prices: Array<Record<string, unknown>> = Array.isArray(wire.prices)
    ? (wire.prices as Array<Record<string, unknown>>)
    : []
  const status = ADDON_STATUSES.has(wire.status ?? '')
    ? (wire.status as AddonStatus)
    : AddonStatus.Published

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled add-on',
    lookupKey: wire.lookupKey ?? '',
    description: wire.description ?? '',
    status,
    chargeCount: prices.length,
    // `type` is `FIXED` or `USAGE`; anything else counts as a charge but as
    // neither kind, so a new price type cannot inflate one of the two.
    fixedChargeCount: prices.filter((price) => price['type'] === 'FIXED').length,
    usageChargeCount: prices.filter((price) => price['type'] === 'USAGE').length,
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
    // The Type pill and the Charges count are read off the add-on's prices.
    expand: 'prices',
    /*
     * Status, server-side.
     *
     * It used to narrow the fetched page in the browser, which is a different
     * and wrong thing: the request returns one page, rows are dropped from
     * *that* page, and the pager still reports the server's unfiltered total.
     * `status` is a declared field on this filter model and a real column the
     * backend accepts, so there was never a reason not to send it.
     */
    ...statusFilterField(query.statuses, Object.values(AddonStatus)),
    sort: sortWithTieBreak(SORT_FIELD[query.sortBy], query.sortDirection),
    ...(query.search || (query.filters?.length ?? 0) > 0
      ? {
          filters: [
            ...(query.search ? nameContainsFilter(query.search) : []),
            ...toFilterConditions(query.filters ?? [], ADDON_FILTERS),
          ],
        }
      : {}),
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
    addons,
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
    meta: { notify: { success: 'Add-on created', error: 'Could not create the add-on.' } },
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

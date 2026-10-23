import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type CostSheet,
  type CreateCostSheet,
  type EditCostSheet,
  type CostSheetQuery,
  CostSheetSortField,
  CostSheetStatus,
  COST_SHEET_FILTERS,
} from '@fp/domain'
import { queryKeys } from './keys'
import { statusFilterField, toFilterConditions } from './search'
import { useFlexprice } from './provider'
import { sortWithTieBreak } from './listSort'

/**
 * Cost sheets: the translation between product vocabulary and the API.
 *
 * Reached through `client.costs.queryCostsheet`. The costsheet filter is the
 * one that nests paging under a `queryFilter` rather than taking `limit` and
 * `offset` at the top level — so this is the one converter that has to know
 * that shape. The wire sends the grouped prices as an array; the list only
 * shows how many there are, so the domain carries the count and drops the array.
 */

/**
 * The wire shape this reads, after the SDK camelCases the response.
 *
 * `createdAt`/`updatedAt` arrive as `Date` (the SDK parses them).
 */
export interface CostSheetWire {
  id?: string | undefined
  name?: string | undefined
  lookupKey?: string | undefined
  description?: string | undefined
  metadata?: Record<string, string> | undefined
  prices?: unknown[] | undefined
  status?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

const COST_SHEET_STATUSES = new Set<string>(Object.values(CostSheetStatus))

export function toCostSheet(wire: CostSheetWire): CostSheet {
  const status = COST_SHEET_STATUSES.has(wire.status ?? '')
    ? (wire.status as CostSheetStatus)
    : CostSheetStatus.Published

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled cost sheet',
    lookupKey: wire.lookupKey ?? '',
    description: wire.description ?? '',
    priceCount: wire.prices?.length ?? 0,
    metadata: wire.metadata ?? {},
    status,
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

const SORT_FIELD: Record<CostSheetSortField, string> = {
  [CostSheetSortField.Name]: 'name',
  [CostSheetSortField.CreatedAt]: 'created_at',
  [CostSheetSortField.UpdatedAt]: 'updated_at',
}

export function toCostSheetFilter(query: CostSheetQuery): Record<string, unknown> {
  return {
    // Paging nests under `queryFilter` for this endpoint — see the note above.
    queryFilter: { limit: query.pageSize, offset: (query.page - 1) * query.pageSize },
    sort: sortWithTieBreak(SORT_FIELD[query.sortBy], query.sortDirection),
    /*
     * Status, server-side — it used to narrow the fetched page in the browser,
     * which left the pager reporting the server's unfiltered total above a
     * handful of rows. Soft-deleted sheets are still dropped in the fetch and
     * taken off that total: a different exclusion the endpoint cannot express.
     */
    ...statusFilterField(query.statuses, Object.values(CostSheetStatus)),
    ...(query.search ? { name: query.search } : {}),
    ...((query.filters?.length ?? 0) > 0
      ? { filters: toFilterConditions(query.filters ?? [], COST_SHEET_FILTERS) }
      : {}),
  }
}

export interface CostSheetPage {
  costSheets: CostSheet[]
  total: number
}

export async function fetchCostSheets(
  client: Flexprice,
  query: CostSheetQuery,
): Promise<CostSheetPage> {
  const response = await call(() => client.costs.queryCostsheet(toCostSheetFilter(query) as never))
  // The search endpoint returns soft-deleted sheets (`status: "deleted"`) with
  // no way to exclude them, and `toCostSheet` would collapse that status to
  // "published" — so a deleted sheet would sit in the list looking live. A
  // deleted sheet is gone, so it is dropped here and taken off the total.
  const items = (response.items ?? []) as CostSheetWire[]
  const live = items.filter((item) => item.status !== 'deleted')
  const costSheets = live.map(toCostSheet)
  const dropped = items.length - live.length

  return {
    costSheets,
    total: Math.max(0, (response.pagination?.total ?? 0) - dropped),
  }
}

export function useCostSheets(query: CostSheetQuery) {
  const client = useFlexprice()

  // `view` is a layout, not a filter: it must not miss the cache on a toggle.
  const { view: _view, ...key } = query

  return useQuery({
    queryKey: queryKeys.costSheets.list({ ...key, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchCostSheets(client, query),
    placeholderData: (previous) => previous,
  })
}

/**
 * One cost sheet, fetched by id through the search endpoint.
 *
 * `GET /costs/{id}` returns the record bare while the SDK's response schema
 * expects it wrapped under `costsheet` and strips everything else, so the SDK
 * hands back an empty object. Searching by id sidesteps that; a missing or
 * deleted record is reported as null.
 */
export function useCostSheet(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.costSheets.detail(id),
    queryFn: async () => {
      const response = await call(() =>
        client.costs.queryCostsheet({ costsheetIDs: [id], queryFilter: { limit: 1 } } as never),
      )
      const items = (response.items ?? []) as CostSheetWire[]
      const record = items.find((item) => item.id === id && item.status !== 'deleted')
      return record ? toCostSheet(record) : null
    },
    enabled: id.length > 0,
  })
}

/** Domain draft out, `CreateCostsheetRequest` in. Blank optional fields are dropped. */
export function toCreateCostSheetRequest(draft: CreateCostSheet): Record<string, unknown> {
  return {
    name: draft.name,
    ...(draft.lookupKey ? { lookupKey: draft.lookupKey } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.metadata ? { metadata: draft.metadata } : {}),
  }
}

/** The update treats a blank field as "unchanged", so blanks are dropped here too. */
export function toUpdateCostSheetRequest(draft: EditCostSheet): Record<string, unknown> {
  return toCreateCostSheetRequest(draft)
}

export function useCreateCostSheet() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Cost sheet created', error: 'Could not create the cost sheet.' } },
    mutationFn: (draft: CreateCostSheet) =>
      call(() => client.costs.createCostsheet(toCreateCostSheetRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all() })
    },
  })
}

export function useUpdateCostSheet() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: EditCostSheet }) =>
      call(() => client.costs.updateCostsheet(id, toUpdateCostSheetRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all() })
    },
  })
}

export function useDeleteCostSheet() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.costs.deleteCostsheet(id)),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all() })
      void queryClient.removeQueries({ queryKey: queryKeys.costSheets.detail(id) })
    },
  })
}

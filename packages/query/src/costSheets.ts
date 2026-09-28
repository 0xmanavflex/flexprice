import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type CostSheet,
  type CostSheetQuery,
  CostSheetSortField,
  CostSheetStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

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
    sort: [{ field: SORT_FIELD[query.sortBy], direction: query.sortDirection }],
    ...(query.search ? { name: query.search } : {}),
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
  const costSheets = (response.items ?? []).map((item) => toCostSheet(item as CostSheetWire))

  return {
    // Status is not a server-side filter here, so it is applied on the page —
    // the same split add-ons and coupons use.
    costSheets:
      query.statuses.length > 0
        ? costSheets.filter((sheet) => query.statuses.includes(sheet.status))
        : costSheets,
    total: response.pagination?.total ?? 0,
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

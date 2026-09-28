import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type CreatePriceUnit,
  type PriceUnit,
  type PriceUnitQuery,
  PriceUnitSortField,
  PriceUnitStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Price units: the translation between product vocabulary and the API.
 *
 * Reached through `POST /prices/units/search` (`client.priceUnits.queryPriceUnit`),
 * the same search shape features, plans, add-ons and coupons use. The rate
 * crosses the boundary as the string the API sends and stores it (`"0.01"`, not
 * `0.01`), so no precision is lost; the form's number is stringified on the way
 * back out.
 */

/** The wire shape this reads, after the SDK camelCases the response. */
export interface PriceUnitWire {
  id?: string | undefined
  name?: string | undefined
  code?: string | undefined
  symbol?: string | undefined
  baseCurrency?: string | undefined
  conversionRate?: string | undefined
  status?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

/**
 * The wire's status collapses to the two a catalogue shows.
 *
 * The API knows `published`, `archived` and `deleted`; the last is a soft
 * delete, which reads as archived here. Anything unrecognised falls to
 * published rather than vanishing from the list.
 */
function toStatus(raw: string | undefined): PriceUnitStatus {
  if (raw === 'archived' || raw === 'deleted') return PriceUnitStatus.Archived
  return PriceUnitStatus.Published
}

export function toPriceUnit(wire: PriceUnitWire): PriceUnit {
  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled price unit',
    code: wire.code ?? '',
    symbol: wire.symbol ?? '',
    baseCurrency: wire.baseCurrency ?? '',
    // Kept as the string the API sends — a rate is a decimal that a float would
    // round, and nothing above this layer does arithmetic on it.
    conversionRate: wire.conversionRate ?? '0',
    status: toStatus(wire.status),
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

const SORT_FIELD: Record<PriceUnitSortField, string> = {
  [PriceUnitSortField.Name]: 'name',
  [PriceUnitSortField.Code]: 'code',
  [PriceUnitSortField.CreatedAt]: 'created_at',
  [PriceUnitSortField.UpdatedAt]: 'updated_at',
}

export function toPriceUnitFilter(query: PriceUnitQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: [{ field: SORT_FIELD[query.sortBy], direction: query.sortDirection }],
    ...(query.search ? { nameContains: query.search } : {}),
  }
}

export interface PriceUnitPage {
  priceUnits: PriceUnit[]
  total: number
}

export async function fetchPriceUnits(
  client: Flexprice,
  query: PriceUnitQuery,
): Promise<PriceUnitPage> {
  const response = await call(() =>
    client.priceUnits.queryPriceUnit(toPriceUnitFilter(query) as never),
  )
  const priceUnits = (response.items ?? []).map((item) => toPriceUnit(item as PriceUnitWire))

  return {
    // Status is not a server-side filter here, so it is applied on the page —
    // the same split add-ons and coupons use.
    priceUnits:
      query.statuses.length > 0
        ? priceUnits.filter((unit) => query.statuses.includes(unit.status))
        : priceUnits,
    total: response.pagination?.total ?? 0,
  }
}

export function usePriceUnits(query: PriceUnitQuery) {
  const client = useFlexprice()

  // `view` is a layout, not a filter: it must not miss the cache on a toggle.
  const { view: _view, ...key } = query

  return useQuery({
    queryKey: queryKeys.priceUnits.list({ ...key, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchPriceUnits(client, query),
    placeholderData: (previous) => previous,
  })
}

/**
 * Create and edit share the draft; the wire splits them.
 *
 * Create sends the whole record — the rate stringified, because the API stores
 * it as a string. Update sends **only the name**: the backend rejects a change
 * to the code, symbol, base currency or rate, so sending them would be an error
 * the form has already prevented by rendering them read-only. Metadata is left
 * untouched (absent) rather than blanked.
 */
export function toCreatePriceUnitRequest(draft: CreatePriceUnit): Record<string, unknown> {
  return {
    name: draft.name,
    code: draft.code,
    symbol: draft.symbol,
    baseCurrency: draft.baseCurrency,
    conversionRate: String(draft.conversionRate),
  }
}

export function toUpdatePriceUnitRequest(draft: CreatePriceUnit): Record<string, unknown> {
  return { name: draft.name }
}

export function useCreatePriceUnit() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: CreatePriceUnit) =>
      call(() => client.priceUnits.createPriceUnit(toCreatePriceUnitRequest(draft) as never)),
    onSuccess: () => {
      // Invalidating the prefix covers every list and filter combination.
      void queryClient.invalidateQueries({ queryKey: queryKeys.priceUnits.all() })
    },
  })
}

export function useUpdatePriceUnit() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: CreatePriceUnit }) =>
      call(() => client.priceUnits.updatePriceUnit(id, toUpdatePriceUnitRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.priceUnits.all() })
    },
  })
}

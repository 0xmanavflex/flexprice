import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type CreateTaxRate,
  type EditTaxRate,
  type TaxRate,
  type TaxRateQuery,
  TaxRateScope,
  TaxRateSortField,
  TaxRateStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Tax rates: the translation between product vocabulary and the API.
 *
 * Reached through `GET /taxes/rates` (`client.taxRates.getTaxRates`), a paged list
 * with query params. The wire's `status` carries three values and the domain
 * keeps the two a catalogue shows; the scope enum passes through unchanged.
 */

/**
 * The wire shape this reads, after the SDK camelCases the response.
 *
 * `createdAt`/`updatedAt` arrive as `Date` (the SDK parses them). The wider
 * record: `taxRateType`, `taxRateStatus`, the audit columns: stays on the
 * wire; the list needs none of it.
 */
export interface TaxRateWire {
  id?: string | undefined
  name?: string | undefined
  code?: string | undefined
  description?: string | undefined
  metadata?: Record<string, string> | undefined
  percentageValue?: string | undefined
  scope?: string | undefined
  status?: string | undefined
  /** `ACTIVE` or `INACTIVE`: what archiving and the edit form's status change. */
  taxRateStatus?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

const TAX_RATE_SCOPES = new Set<string>(Object.values(TaxRateScope))
const TAX_RATE_STATUSES = new Set<string>(Object.values(TaxRateStatus))

export function toTaxRate(wire: TaxRateWire): TaxRate {
  const scope = TAX_RATE_SCOPES.has(wire.scope ?? '')
    ? (wire.scope as TaxRateScope)
    : TaxRateScope.Internal
  // `taxRateStatus` is the field archiving and the edit form write, so when it
  // is present it decides, both ways: the record's own `status` is not changed
  // by an update and would otherwise keep a republished rate archived.
  const rateStatus = wire.taxRateStatus?.toUpperCase()
  const status =
    rateStatus === 'INACTIVE'
      ? TaxRateStatus.Archived
      : rateStatus === 'ACTIVE'
        ? TaxRateStatus.Published
        : TAX_RATE_STATUSES.has(wire.status ?? '')
          ? (wire.status as TaxRateStatus)
          : TaxRateStatus.Published

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled tax rate',
    code: wire.code ?? '',
    description: wire.description ?? '',
    // The percentage as the API sends it ("18", not 0.18), or empty when absent.
    percentageValue: wire.percentageValue ?? '',
    scope,
    metadata: wire.metadata ?? {},
    status,
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

/**
 * The GET request `getTaxRates` takes (`GetTaxRatesRequest`): one page of the
 * scan in {@link fetchAllTaxRates}.
 *
 * The request exposes `limit`/`offset` for paging and an `order` *direction*,
 * but no sort *field* and no name search, so only paging is sent.
 */
export function toTaxRateFilter(query: Pick<TaxRateQuery, 'page' | 'pageSize'>) {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  }
}

/** Enough to hold every tax rate an account keeps in a request or two. */
const SCAN_PAGE_SIZE = 500

export interface TaxRatePage {
  taxRates: TaxRate[]
  total: number
}

/**
 * Every tax rate, read page by page.
 *
 * `GET /taxes/rates` cannot search by name or code, cannot sort by name or
 * update time, and filters on the record's own `status` rather than the
 * `taxRateStatus` the row shows (archived is what Archive and Edit write; an
 * update cannot change `status`, so a republished rate would sit under
 * Archived). Anything the list narrowed or ordered on the server would
 * therefore cover one page only. An account keeps a handful of tax rates, so
 * the whole set is read and {@link selectTaxRatePage} does the rest: the
 * search, the facet, the sort and the total then all cover every rate.
 */
export async function fetchAllTaxRates(client: Flexprice): Promise<TaxRate[]> {
  // Read every page: a single capped read would drop rates past the limit.
  const all: unknown[] = []
  for (let offset = 0; ; offset += SCAN_PAGE_SIZE) {
    const response = await call(() =>
      client.taxRates.getTaxRates({ limit: SCAN_PAGE_SIZE, offset }),
    )
    const items = response.items ?? []
    all.push(...items)
    const total = response.pagination?.total ?? 0
    if (items.length < SCAN_PAGE_SIZE || offset + SCAN_PAGE_SIZE >= total) break
  }
  return all.map((item) => toTaxRate(item as TaxRateWire))
}

const SORT_KEY: Record<TaxRateSortField, (taxRate: TaxRate) => string | number> = {
  [TaxRateSortField.Name]: (taxRate) => taxRate.name.toLowerCase(),
  [TaxRateSortField.CreatedAt]: (taxRate) => taxRate.createdAt?.getTime() ?? 0,
  [TaxRateSortField.UpdatedAt]: (taxRate) => taxRate.updatedAt?.getTime() ?? 0,
}

/** The page the query asks for, cut from every rate: facet, search, sort, then page. */
export function selectTaxRatePage(all: readonly TaxRate[], query: TaxRateQuery): TaxRatePage {
  const wanted = new Set(query.statuses)
  const search = query.search.trim().toLowerCase()
  const key = SORT_KEY[query.sortBy] ?? SORT_KEY[TaxRateSortField.UpdatedAt]
  const sign = query.sortDirection === 'asc' ? 1 : -1
  const matching = all
    .filter((taxRate) => wanted.size === 0 || wanted.has(taxRate.status))
    .filter(
      (taxRate) => !search || `${taxRate.name} ${taxRate.code}`.toLowerCase().includes(search),
    )
    .sort((left, right) => {
      const a = key(left)
      const b = key(right)
      return (a < b ? -1 : a > b ? 1 : 0) * sign
    })
  const start = (query.page - 1) * query.pageSize
  return { taxRates: matching.slice(start, start + query.pageSize), total: matching.length }
}

export async function fetchTaxRates(client: Flexprice, query: TaxRateQuery): Promise<TaxRatePage> {
  return selectTaxRatePage(await fetchAllTaxRates(client), query)
}

export function useTaxRates(
  query: TaxRateQuery,
  options: {
    /** Refetch when the tab regains focus, e.g. after a rate is created in another tab. */
    refetchOnWindowFocus?: boolean
  } = {},
) {
  const client = useFlexprice()

  // One cached read of every rate; each search, facet, sort and page is cut
  // from it, so none of them makes a request.
  return useQuery({
    queryKey: queryKeys.taxRates.list({ scan: true }),
    queryFn: () => fetchAllTaxRates(client),
    select: (all: TaxRate[]) => selectTaxRatePage(all, query),
    placeholderData: (previous) => previous,
    ...(options.refetchOnWindowFocus ? { refetchOnWindowFocus: 'always' as const } : {}),
  })
}

/** One tax rate, by id: `GET /taxes/rates/{id}`, for its detail page. */
export function useTaxRate(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.taxRates.detail(id),
    queryFn: async ({ signal }) =>
      toTaxRate(
        (await call((options) => client.taxRates.getTaxRate(id, options), signal)) as TaxRateWire,
      ),
    enabled: Boolean(id),
  })
}

/** Domain draft out, `CreateTaxRateRequest` in. Only percentage rates are offered. */
export function toCreateTaxRateRequest(draft: CreateTaxRate): Record<string, unknown> {
  return {
    name: draft.name,
    code: draft.code,
    taxRateType: 'percentage',
    percentageValue: draft.percentageValue,
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.metadata ? { metadata: draft.metadata } : {}),
  }
}

/** The wire spells the two states `ACTIVE` / `INACTIVE`; the catalogue says published / archived. */
const STATUS_TO_WIRE = { published: 'ACTIVE', archived: 'INACTIVE' } as const

/** Domain edit out, `UpdateTaxRateRequest` in. Value, scope and type are fixed. */
export function toUpdateTaxRateRequest(draft: EditTaxRate): Record<string, unknown> {
  return {
    name: draft.name,
    code: draft.code,
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.metadata ? { metadata: draft.metadata } : {}),
    ...(draft.status ? { taxRateStatus: STATUS_TO_WIRE[draft.status] } : {}),
  }
}

export function useCreateTaxRate() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Tax rate created', error: 'Could not create the tax rate.' } },
    mutationFn: (draft: CreateTaxRate) =>
      call(() => client.taxRates.createTaxRate(toCreateTaxRateRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxRates.all() })
    },
  })
}

export function useUpdateTaxRate() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: EditTaxRate }) =>
      call(() => client.taxRates.updateTaxRate(id, toUpdateTaxRateRequest(draft) as never)),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxRates.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxRates.detail(id) })
    },
  })
}

export function useDeleteTaxRate() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.taxRates.deleteTaxRate(id)),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxRates.all() })
      void queryClient.removeQueries({ queryKey: queryKeys.taxRates.detail(id) })
    },
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type CreateTaxRate,
  type EditTaxRate,
  type TaxRate,
  type TaxRateQuery,
  TaxRateScope,
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
 * The GET request `getTaxRates` takes (`GetTaxRatesRequest`).
 *
 * The request exposes `limit`/`offset` for paging and an `order` *direction*,
 * but no sort *field* and no name search, so only paging is sent here. Search
 * and status are applied on the page: the same split coupons use.
 */
export function toTaxRateFilter(query: TaxRateQuery) {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  }
}

/** Enough to hold every tax rate an account keeps, when the status facet is on. */
const STATUS_SCAN_LIMIT = 500

export interface TaxRatePage {
  taxRates: TaxRate[]
  total: number
}

export async function fetchTaxRates(client: Flexprice, query: TaxRateQuery): Promise<TaxRatePage> {
  /*
   * The Status facet reads what the row shows: archived is the rate's
   * `taxRateStatus` (what Archive and Edit write) before the record's own
   * `status`, which an update cannot change. `GET /taxes/rates` only filters on
   * the latter, so a republished rate would sit under Archived. With the facet
   * on, every rate is read and the facet, search and page are applied here, so
   * the rows, their labels and the total agree.
   */
  const wanted = new Set(query.statuses)
  if (wanted.size > 0 && wanted.size < Object.values(TaxRateStatus).length) {
    // Read every page: a single capped read would drop rates past the limit.
    const all: unknown[] = []
    for (let offset = 0; ; offset += STATUS_SCAN_LIMIT) {
      const response = await call(() =>
        client.taxRates.getTaxRates({ limit: STATUS_SCAN_LIMIT, offset }),
      )
      const items = response.items ?? []
      all.push(...items)
      const total = response.pagination?.total ?? 0
      if (items.length < STATUS_SCAN_LIMIT || offset + STATUS_SCAN_LIMIT >= total) break
    }
    const search = query.search.trim().toLowerCase()
    const matching = all
      .map((item) => toTaxRate(item as TaxRateWire))
      .filter((taxRate) => wanted.has(taxRate.status))
      .filter(
        (taxRate) => !search || `${taxRate.name} ${taxRate.code}`.toLowerCase().includes(search),
      )
    const start = (query.page - 1) * query.pageSize
    return { taxRates: matching.slice(start, start + query.pageSize), total: matching.length }
  }

  const response = await call(() => client.taxRates.getTaxRates(toTaxRateFilter(query)))
  const taxRates = (response.items ?? []).map((item) => toTaxRate(item as TaxRateWire))

  /*
   * Search still narrows the fetched page, and here that is the endpoint's
   * limit rather than a shortcut.
   *
   * `GET /taxes/rates` is not one of the `/search` routes: it takes `limit`,
   * `offset`, `status`, `scope`, codes and ids, and has neither the filter DSL
   * nor any name field. So there is nothing to push a name or code search down
   * to. Status *is* a declared parameter and has moved server-side.
   *
   * The consequence is worth being precise about: with a search term, the
   * matches shown are the matches **on this page**, and `total` counts every
   * tax rate rather than every match. Closing that needs a server-side search
   * on this route: it cannot be fixed from here.
   */
  const search = query.search.trim().toLowerCase()
  const filtered = search
    ? taxRates.filter((taxRate) => `${taxRate.name} ${taxRate.code}`.toLowerCase().includes(search))
    : taxRates

  return {
    taxRates: filtered,
    total: response.pagination?.total ?? 0,
  }
}

export function useTaxRates(
  query: TaxRateQuery,
  options: {
    /** Refetch when the tab regains focus, e.g. after a rate is created in another tab. */
    refetchOnWindowFocus?: boolean
  } = {},
) {
  const client = useFlexprice()
  // With the status facet on, every rate is scanned: cache that scan once per
  // search and status, and cut each page from it, so paging makes no request.
  const scanned =
    query.statuses.length > 0 && query.statuses.length < Object.values(TaxRateStatus).length
  const statuses = [...query.statuses].sort()

  const { page: _page, pageSize: _pageSize, ...unpaged } = query

  return useQuery({
    queryKey: scanned
      ? queryKeys.taxRates.list({ ...unpaged, statuses, scan: true })
      : queryKeys.taxRates.list({ ...query, statuses }),
    queryFn: () =>
      fetchTaxRates(client, scanned ? { ...query, page: 1, pageSize: Infinity } : query),
    select: (data: TaxRatePage): TaxRatePage => {
      if (!scanned) return data
      const start = (query.page - 1) * query.pageSize
      return { taxRates: data.taxRates.slice(start, start + query.pageSize), total: data.total }
    },
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

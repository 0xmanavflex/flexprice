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
import { statusFilterField } from './search'
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
 * record — `taxRateType`, `taxRateStatus`, the audit columns — stays on the
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
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

const TAX_RATE_SCOPES = new Set<string>(Object.values(TaxRateScope))
const TAX_RATE_STATUSES = new Set<string>(Object.values(TaxRateStatus))

export function toTaxRate(wire: TaxRateWire): TaxRate {
  const scope = TAX_RATE_SCOPES.has(wire.scope ?? '')
    ? (wire.scope as TaxRateScope)
    : TaxRateScope.Internal
  const status = TAX_RATE_STATUSES.has(wire.status ?? '')
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
 * and status are applied on the page — the same split coupons use.
 */
export function toTaxRateFilter(query: TaxRateQuery) {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    /*
     * `status` is a declared parameter on `GET /taxes/rates`, so the facet is
     * the server's. It used to narrow the fetched page instead, which left the
     * pager counting every tax rate above the few that matched.
     */
    ...statusFilterField(query.statuses, Object.values(TaxRateStatus)),
  }
}

export interface TaxRatePage {
  taxRates: TaxRate[]
  total: number
}

export async function fetchTaxRates(client: Flexprice, query: TaxRateQuery): Promise<TaxRatePage> {
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
   * on this route — it cannot be fixed from here.
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

  return useQuery({
    queryKey: queryKeys.taxRates.list({ ...query, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchTaxRates(client, query),
    placeholderData: (previous) => previous,
    ...(options.refetchOnWindowFocus ? { refetchOnWindowFocus: 'always' as const } : {}),
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

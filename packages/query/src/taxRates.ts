import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
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
 * record — `taxRateType`, `taxRateStatus`, the audit columns — stays on the
 * wire; the list needs none of it.
 */
export interface TaxRateWire {
  id?: string | undefined
  name?: string | undefined
  code?: string | undefined
  description?: string | undefined
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
export function toTaxRateFilter(query: TaxRateQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  }
}

export interface TaxRatePage {
  taxRates: TaxRate[]
  total: number
}

export async function fetchTaxRates(client: Flexprice, query: TaxRateQuery): Promise<TaxRatePage> {
  const response = await call(() => client.taxRates.getTaxRates(toTaxRateFilter(query) as never))
  const taxRates = (response.items ?? []).map((item) => toTaxRate(item as TaxRateWire))

  // Neither status nor search is a server-side filter here, so both are applied
  // on the page — the same split coupons use.
  const search = query.search.trim().toLowerCase()
  const filtered = taxRates.filter((taxRate) => {
    if (query.statuses.length > 0 && !query.statuses.includes(taxRate.status)) return false
    if (search) {
      const haystack = `${taxRate.name} ${taxRate.code}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })

  return {
    taxRates: filtered,
    total: response.pagination?.total ?? 0,
  }
}

export function useTaxRates(query: TaxRateQuery) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.taxRates.list({ ...query, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchTaxRates(client, query),
    placeholderData: (previous) => previous,
  })
}

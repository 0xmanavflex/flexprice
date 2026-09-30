import { useQuery } from '@tanstack/react-query'
import type { Flexprice } from '@fp/api'
import { call } from '@fp/api'
import {
  type Payment,
  type PaymentQuery,
  PaymentStatus,
  moneyOr,
  toPaymentStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Payments: the translation between product vocabulary and the API.
 *
 * Reached through `GET /payments` (`client.payments.listPayments`), a plain
 * paginated list rather than the `POST /search` the catalogue resources use.
 * The wire keeps the amount as a bare string beside a separate `currency` and
 * spreads the lifecycle across nine values; the domain joins the first into a
 * `Money` and folds the second into six here, so no screen sees either raw.
 */

/**
 * The wire shape this reads, after the SDK camelCases the response.
 *
 * `createdAt`/`succeededAt` arrive as `Date` (the SDK parses them). Structural,
 * so a fixture need not carry all ~30 fields to exercise the mapper.
 */
export interface PaymentWire {
  id?: string | undefined
  amount?: string | undefined
  currency?: string | undefined
  paymentStatus?: string | undefined
  paymentMethodType?: string | undefined
  paymentGateway?: string | undefined
  destinationType?: string | undefined
  invoiceNumber?: string | undefined
  createdAt?: Date | undefined
  succeededAt?: Date | undefined
}

/**
 * Unknown states are read as still in flight.
 *
 * The wire-to-domain table itself lives in `@fp/domain` — an invoice carries
 * the same `payment_status` and has to fold it the same way. What is local to
 * *this* list is the fallback: the domain reports an unrecognised value as
 * absent, and a payment row with no status at all is less useful than one that
 * says "pending", because a payment the API has told us about but whose state
 * this build does not know is, from a collections desk, exactly a payment that
 * has not finished.
 */
export function toPayment(wire: PaymentWire): Payment {
  return {
    id: wire.id ?? '',
    // The amount and its currency, joined — never the two strings apart.
    amount: moneyOr(wire.amount, wire.currency),
    status: toPaymentStatus(wire.paymentStatus) ?? PaymentStatus.Pending,
    methodType: wire.paymentMethodType ?? '',
    gateway: wire.paymentGateway ?? '',
    invoiceNumber: wire.invoiceNumber ?? '',
    createdAt: wire.createdAt ?? null,
    succeededAt: wire.succeededAt ?? null,
  }
}

/**
 * Builds the request. Page numbers are 1-based for people, offsets are not.
 *
 * `listPayments` is a GET whose query params (`ListPaymentsRequest`) take
 * `limit` and `offset`; status and search are not among the filters this list
 * pushes down, so they are applied on the page instead — see {@link
 * fetchPayments}.
 */
export function toPaymentFilter(query: PaymentQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  }
}

export interface PaymentPage {
  payments: Payment[]
  /** Server-side total, for the grid's record count. */
  total: number
}

export async function fetchPayments(
  client: Flexprice,
  query: PaymentQuery,
): Promise<PaymentPage> {
  const response = await call(() => client.payments.listPayments(toPaymentFilter(query) as never))
  const payments = (response.items ?? []).map((item) => toPayment(item as PaymentWire))

  // Neither status nor search is a server-side filter on this endpoint, so both
  // are applied here, on the page the request returned — the same split coupons
  // use for status. Search matches the invoice number a payment collected
  // against.
  const term = query.search.trim().toLowerCase()
  const filtered = payments.filter((payment) => {
    if (query.statuses.length > 0 && !query.statuses.includes(payment.status)) return false
    if (term && !payment.invoiceNumber.toLowerCase().includes(term)) return false
    return true
  })

  return {
    payments: filtered,
    total: response.pagination?.total ?? 0,
  }
}

/**
 * The page's entire interface to payments.
 *
 * Takes domain vocabulary, returns domain models. The caller never learns that
 * listing payments is a GET with an offset — which is what lets the page hand
 * its state to a URL instead of to a component.
 */
export function usePayments(query: PaymentQuery) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.payments.list({ ...query, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchPayments(client, query),
    // Keeps the previous page on screen while the next one loads, so paging does
    // not blank the grid. TanStack's replacement for keepPreviousData.
    placeholderData: (previous) => previous,
  })
}

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Flexprice } from '@fp/api'
import { call } from '@fp/api'
import {
  type Payment,
  type PaymentDetail,
  type PaymentQuery,
  type RecordPayment,
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
  gatewayPaymentId?: string | undefined
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
    ...(wire.gatewayPaymentId ? { gatewayPaymentId: wire.gatewayPaymentId } : {}),
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
  signal?: AbortSignal,
): Promise<PaymentPage> {
  const response = await call(
    (options) => client.payments.listPayments(toPaymentFilter(query) as never, options),
    signal,
  )
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
    queryFn: ({ signal }) => fetchPayments(client, query, signal),
    // Keeps the previous page on screen while the next one loads, so paging does
    // not blank the grid. TanStack's replacement for keepPreviousData.
    placeholderData: (previous) => previous,
  })
}

/**
 * The payments recorded against one invoice, for its Payments tab.
 *
 * `GET /payments` takes `destination_id`; the page is also filtered by it, so
 * a server that ignores the filter still cannot show another invoice's payments.
 */
export async function fetchInvoicePayments(
  client: Flexprice,
  invoiceId: string,
): Promise<Payment[]> {
  const response = await call(() =>
    client.payments.listPayments({
      destinationId: invoiceId,
      destinationType: 'INVOICE',
      limit: 100,
      offset: 0,
    } as never),
  )
  return (response.items ?? [])
    .filter((item) => (item as { destinationId?: string }).destinationId === invoiceId)
    .map((item) => toPayment(item as PaymentWire))
}

export function useInvoicePayments(invoiceId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.payments.list({ invoiceId }),
    queryFn: () => fetchInvoicePayments(client, invoiceId),
    enabled: invoiceId.length > 0,
  })
}

/**
 * A customer's recent payments, for the Overview.
 *
 * `GET /payments` has no customer filter, but every payment is collected
 * against an invoice and the invoice list *is* scoped to the customer. So this
 * reads the payments of the customer's most recent invoices and merges them,
 * newest first. Older invoices are not read: the result is "recent", not a
 * complete ledger, and the caller says so.
 */
export function useCustomerPayments(invoiceIds: readonly string[]) {
  const client = useFlexprice()

  return useQueries({
    queries: invoiceIds.map((invoiceId) => ({
      queryKey: queryKeys.payments.list({ invoiceId }),
      queryFn: () => fetchInvoicePayments(client, invoiceId),
    })),
    combine: (results) => ({
      payments: results
        .flatMap((result) => result.data ?? [])
        .sort(
          (left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0),
        ),
      isLoading: results.some((result) => result.isLoading),
      // Failed only when nothing arrived: one bad invoice should not blank the rest.
      isError: results.length > 0 && results.every((result) => result.isError),
      refetch: () => results.forEach((result) => void result.refetch()),
    }),
  })
}

export interface PaymentDetailWire extends PaymentWire {
  destinationId?: string | undefined
  gatewayPaymentId?: string | undefined
  paymentUrl?: string | undefined
  errorMessage?: string | undefined
  attempts?: unknown[] | undefined
  failedAt?: Date | undefined
  refundedAt?: Date | undefined
  voidedAt?: Date | undefined
}

export function toPaymentDetail(wire: PaymentDetailWire): PaymentDetail {
  return {
    ...toPayment(wire),
    invoiceId: wire.destinationType === 'INVOICE' ? (wire.destinationId ?? '') : '',
    destinationType: wire.destinationType ?? '',
    gatewayPaymentId: wire.gatewayPaymentId ?? '',
    paymentUrl: wire.paymentUrl ?? '',
    errorMessage: wire.errorMessage ?? '',
    attempts: wire.attempts?.length ?? 0,
    failedAt: wire.failedAt ?? null,
    refundedAt: wire.refundedAt ?? null,
    voidedAt: wire.voidedAt ?? null,
  }
}

/** `POST /payments`: a payment recorded against an invoice. */
export function toRecordPaymentRequest(draft: RecordPayment): Record<string, unknown> {
  return {
    amount: draft.amount.trim(),
    currency: draft.currency.trim().toUpperCase(),
    destinationId: draft.invoiceId,
    destinationType: 'INVOICE',
    paymentMethodType: draft.methodType,
    processPayment: draft.processNow,
  }
}

export function usePayment(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: async ({ signal }) =>
      toPaymentDetail(
        (await call(
          (options) => client.payments.getPayment(id, options),
          signal,
        )) as PaymentDetailWire,
      ),
  })
}

function useInvalidatePayments() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
  }
}

export function useRecordPayment() {
  const client = useFlexprice()
  const invalidate = useInvalidatePayments()

  return useMutation({
    meta: { notify: { success: 'Payment recorded', error: 'Could not record the payment.' } },
    mutationFn: (draft: RecordPayment) =>
      call(() => client.payments.createPayment(toRecordPaymentRequest(draft) as never)),
    onSuccess: invalidate,
  })
}

/** Run an initiated payment — `POST /payments/{id}/process`. */
export function useProcessPayment() {
  const client = useFlexprice()
  const invalidate = useInvalidatePayments()

  return useMutation({
    mutationFn: (id: string) => call(() => client.payments.processPayment(id)),
    onSuccess: invalidate,
  })
}

export function useDeletePayment() {
  const client = useFlexprice()
  const invalidate = useInvalidatePayments()

  return useMutation({
    mutationFn: (id: string) => call(() => client.payments.deletePayment(id)),
    onSuccess: invalidate,
  })
}

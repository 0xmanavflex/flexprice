import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AuthSource, call, listPayments } from '@fp/api'
import {
  BILLING_ENTITY_FILTER,
  type ListFilterSpec,
  type Payment,
  type PaymentDetail,
  type PaymentQuery,
  type RecordPayment,
  PaymentSortField,
  PaymentStatus,
  moneyOr,
  toPaymentStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { toTopLevelChoice } from './search'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'
import { credentials, fromWire } from './wire'

/**
 * Payments: the translation between product vocabulary and the API.
 *
 * Reached through `GET /payments`, a plain
 * paginated list rather than the `POST /search` the catalogue resources use.
 * The wire keeps the amount as a bare string beside a separate `currency` and
 * spreads the lifecycle across nine values; the domain joins the first into a
 * `Money` and folds the second into six here, so no screen sees either raw.
 */

/**
 * The wire shape this reads, camelCased by `fromWire`.
 *
 * `createdAt`/`succeededAt` arrive as `Date` (`fromWire` revives them). Structural,
 * so a fixture need not carry all ~30 fields to exercise the mapper.
 */
export interface PaymentWire {
  id?: string | undefined
  billingEntityId?: string | undefined
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
  paymentUrl?: string | null | undefined
}

/**
 * Unknown states are read as still in flight.
 *
 * The wire-to-domain table itself lives in `@fp/domain`: an invoice carries
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
    // The amount and its currency, joined: never the two strings apart.
    amount: moneyOr(wire.amount, wire.currency),
    status: toPaymentStatus(wire.paymentStatus) ?? PaymentStatus.Pending,
    methodType: wire.paymentMethodType ?? '',
    gateway: wire.paymentGateway ?? '',
    invoiceNumber: wire.invoiceNumber ?? '',
    createdAt: wire.createdAt ?? null,
    succeededAt: wire.succeededAt ?? null,
    ...(wire.billingEntityId ? { billingEntityId: wire.billingEntityId } : {}),
    ...(wire.gatewayPaymentId ? { gatewayPaymentId: wire.gatewayPaymentId } : {}),
    ...(wire.paymentUrl?.trim() ? { paymentUrl: wire.paymentUrl.trim() } : {}),
  }
}

/**
 * Builds the request. Page numbers are 1-based for people, offsets are not.
 *
 * `listPayments` is a GET whose query params (`ListPaymentsRequest`) take
 * `limit`, `offset` and the order (`sort` column, `order` direction); status
 * and search are not among the filters this list pushes down, so they are
 * applied on the page instead: see {@link fetchPayments}.
 */
export function toPaymentFilter(query: PaymentQuery) {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: PAYMENT_SORT_COLUMN[query.sortBy],
    order: query.sortDirection,
  }
}

/** The list's sort fields as the API's column names. */
const PAYMENT_SORT_COLUMN: Record<PaymentSortField, string> = {
  [PaymentSortField.CreatedAt]: 'created_at',
}

export interface PaymentPage {
  payments: Payment[]
  /** Server-side total, for the grid's record count. */
  total: number
}

export async function fetchPayments(
  serverURL: string,
  auth: AuthSource,
  query: PaymentQuery,
  signal?: AbortSignal,
  specs: readonly ListFilterSpec[] = [],
): Promise<PaymentPage> {
  const { token, environmentId } = await credentials(auth, 'Sign in to view payments.')
  const billingEntityId = toTopLevelChoice(query.filters ?? [], specs, BILLING_ENTITY_FILTER.field)
  const response = fromWire<{
    items?: PaymentWire[] | null
    pagination?: { total?: number }
  }>(
    await listPayments(
      serverURL,
      token,
      environmentId,
      {
        ...toPaymentFilter(query),
        ...(billingEntityId ? { billingEntityId } : {}),
      },
      signal,
    ),
  )
  const payments = (response?.items ?? []).map(toPayment)

  // Neither status nor search is a server-side filter on this endpoint, so both
  // are applied here, on the page the request returned: the same split coupons
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
    total: response?.pagination?.total ?? 0,
  }
}

/**
 * The page's entire interface to payments.
 *
 * Takes domain vocabulary, returns domain models. The caller never learns that
 * listing payments is a GET with an offset: which is what lets the page hand
 * its state to a URL instead of to a component.
 */
/** `specs`: the filters the list offers; the entity filter only while entities are enabled. */
export function usePayments(
  query: PaymentQuery,
  options: { specs?: readonly ListFilterSpec[] } = {},
) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const billingEntityId = toTopLevelChoice(
    query.filters ?? [],
    options.specs ?? [],
    BILLING_ENTITY_FILTER.field,
  )

  return useQuery({
    queryKey: queryKeys.payments.list({
      ...query,
      statuses: [...query.statuses].sort(),
      // Whether the entity filter is sent, so turning entities on refetches.
      ...(billingEntityId ? { billingEntityId } : {}),
    }),
    queryFn: ({ signal }) => fetchPayments(serverURL, auth, query, signal, options.specs),
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
  serverURL: string,
  auth: AuthSource,
  invoiceId: string,
): Promise<Payment[]> {
  const { token, environmentId } = await credentials(auth, 'Sign in to view payments.')
  const response = fromWire<{ items?: (PaymentWire & { destinationId?: string })[] | null }>(
    await listPayments(serverURL, token, environmentId, {
      destinationId: invoiceId,
      destinationType: 'INVOICE',
      limit: 100,
      offset: 0,
    }),
  )
  return (response?.items ?? []).filter((item) => item.destinationId === invoiceId).map(toPayment)
}

export function useInvoicePayments(invoiceId: string) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.payments.list({ invoiceId }),
    queryFn: () => fetchInvoicePayments(serverURL, auth, invoiceId),
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
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQueries({
    queries: invoiceIds.map((invoiceId) => ({
      queryKey: queryKeys.payments.list({ invoiceId }),
      queryFn: () => fetchInvoicePayments(serverURL, auth, invoiceId),
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
    // Credits are drawn from a wallet, which the request names as the method.
    ...(draft.methodType === 'CREDITS' && draft.walletId
      ? { paymentMethodId: draft.walletId }
      : {}),
    // A link is raised at the provider; the customer comes back to the page it was made on.
    // V1 sends the return URLs in metadata; the request's own fields carry them too.
    ...(draft.methodType === 'PAYMENT_LINK' && draft.gateway
      ? {
          paymentGateway: draft.gateway,
          ...(draft.returnUrl
            ? {
                successUrl: draft.returnUrl,
                cancelUrl: draft.returnUrl,
                metadata: { success_url: draft.returnUrl, cancel_url: draft.returnUrl },
              }
            : {}),
        }
      : {}),
    processPayment: draft.methodType === 'PAYMENT_LINK' ? true : draft.processNow,
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
    // A payment from credits draws a wallet down.
    void queryClient.invalidateQueries({ queryKey: queryKeys.wallets.all() })
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

/** Run an initiated payment: `POST /payments/{id}/process`. */
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

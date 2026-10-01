import { useQuery } from '@tanstack/react-query'
import type { Flexprice } from '@fp/api'
import { call } from '@fp/api'
import {
  type Invoice,
  type InvoiceQuery,
  InvoiceSortField,
  InvoiceStatus,
  deriveInvoiceStatus,
  isZeroMoney,
  moneyOr,
  toPaymentStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * The translation layer, and the reason it is not in a component.
 *
 * `InvoiceResponse` has ~45 optional fields, money as strings, and three
 * different "status" notions. Everything awkward about that is absorbed here,
 * once, so the grid receives a narrow, total `Invoice` and the page receives a
 * list plus a count.
 *
 * If the API model is ever genuinely unusable, this is where that shows up —
 * as a hard mapping function, not as `?? '0'` scattered through columns.
 */

/** Domain vocabulary out, transport vocabulary in. */
const SORT_FIELD_TO_API: Record<InvoiceSortField, string> = {
  [InvoiceSortField.IssuedAt]: 'issue_date',
  [InvoiceSortField.DueDate]: 'due_date',
  [InvoiceSortField.Total]: 'amount_due',
  [InvoiceSortField.Status]: 'invoice_status',
}

/**
 * Domain statuses that map onto an API `invoice_status`.
 *
 * `overdue` and `paid` are absent on purpose: neither is an API value. They are
 * derived from a payment status and a due date, so they cannot be pushed down
 * as a server-side filter without the backend learning the concept. Filtering
 * by them is therefore a deliberate gap, not an oversight — see
 * {@link isServerFilterable}.
 */
const STATUS_TO_API: Partial<Record<InvoiceStatus, string>> = {
  [InvoiceStatus.Draft]: 'DRAFT',
  [InvoiceStatus.Open]: 'FINALIZED',
  [InvoiceStatus.Void]: 'VOIDED',
  [InvoiceStatus.Skipped]: 'SKIPPED',
}

export function isServerFilterable(status: InvoiceStatus): boolean {
  return status in STATUS_TO_API
}

/** Builds the request. Page numbers are 1-based for people, offsets are not. */
export function toInvoiceFilter(query: InvoiceQuery): Record<string, unknown> {
  const statuses = query.statuses
    .map((s) => STATUS_TO_API[s])
    .filter((s): s is string => s !== undefined)

  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: [{ field: SORT_FIELD_TO_API[query.sortBy], direction: query.sortDirection }],
    // Line items are never rendered in a list, and they dominate the payload.
    skipLineItems: true,
    ...(statuses.length > 0 ? { invoiceStatus: statuses } : {}),
    ...(query.search ? { externalCustomerId: query.search } : {}),
  }
}

/** The shape this mapper reads. Structural, so a fixture need not be complete. */
export interface InvoiceWire {
  id?: string | undefined
  invoiceNumber?: string | undefined
  customerId?: string | undefined
  customer?: { name?: string | undefined; email?: string | undefined } | undefined
  invoiceStatus?: string | undefined
  paymentStatus?: string | undefined
  currency?: string | undefined
  total?: string | undefined
  amountDue?: string | undefined
  amountRemaining?: string | undefined
  dueDate?: Date | undefined
  issueDate?: Date | undefined
  periodStart?: Date | undefined
  periodEnd?: Date | undefined
}

export function toInvoice(wire: InvoiceWire, now?: Date): Invoice {
  const currency = wire.currency
  const amountRemaining = moneyOr(wire.amountRemaining, currency)

  return {
    id: wire.id ?? '',
    // A draft has no number yet. Showing the id beats showing a blank cell.
    number: wire.invoiceNumber || (wire.id ?? ''),
    customerId: wire.customerId ?? '',
    // Resolved here so no cell has to fall back, and no grid joins data.
    customerName: wire.customer?.name || wire.customer?.email || (wire.customerId ?? 'Unknown'),
    status: deriveInvoiceStatus({
      invoiceStatus: wire.invoiceStatus,
      paymentStatus: wire.paymentStatus,
      dueDate: wire.dueDate ?? null,
      hasOutstandingBalance: !isZeroMoney(amountRemaining),
      ...(now ? { now } : {}),
    }),
    // The same field `deriveInvoiceStatus` reads above, kept rather than
    // consumed: the derivation answers "does this need attention", the column
    // answers "what happened to the money", and they are not the same question.
    paymentStatus: toPaymentStatus(wire.paymentStatus),
    total: moneyOr(wire.total, currency),
    amountDue: moneyOr(wire.amountDue, currency),
    amountRemaining,
    dueDate: wire.dueDate ?? null,
    issuedAt: wire.issueDate ?? null,
    periodStart: wire.periodStart ?? null,
    periodEnd: wire.periodEnd ?? null,
  }
}

export interface InvoicePage {
  invoices: Invoice[]
  /** Server-side total, for the grid's record count. */
  total: number
}

export async function fetchInvoices(client: Flexprice, query: InvoiceQuery): Promise<InvoicePage> {
  const response = await call(() => client.invoices.queryInvoice(toInvoiceFilter(query) as never))
  return {
    invoices: (response.items ?? []).map((item) => toInvoice(item as InvoiceWire)),
    total: response.pagination?.total ?? 0,
  }
}

/**
 * The page's entire interface to invoices.
 *
 * Takes domain vocabulary, returns domain models. The caller never learns that
 * listing invoices is a `POST` to `/invoices/search`, or that paging is an
 * offset — which is what lets the page hand its state to a URL instead of to a
 * component.
 */
export function useInvoices(query: InvoiceQuery, options: { enabled?: boolean } = {}) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.invoices.list({ ...query, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchInvoices(client, query),
    // Keeps the previous page on screen while the next one loads, so sorting a
    // grid does not blank it. TanStack's replacement for keepPreviousData.
    enabled: options.enabled ?? true,
    placeholderData: (previous) => previous,
  })
}

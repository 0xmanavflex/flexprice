import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Flexprice } from '@fp/api'
import { call } from '@fp/api'
import {
  type CreateInvoice,
  type Invoice,
  type InvoiceDetail,
  type InvoiceQuery,
  InvoiceLinePriceType,
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

/** The detail shape this mapper reads; a superset of {@link InvoiceWire}. */
export interface InvoiceDetailWire extends InvoiceWire {
  customer?:
    | {
        name?: string | undefined
        email?: string | undefined
        addressLine1?: string | undefined
        addressLine2?: string | undefined
        addressCity?: string | undefined
        addressState?: string | undefined
        addressPostalCode?: string | undefined
        addressCountry?: string | undefined
      }
    | undefined
  tenantId?: string | undefined
  metadata?: { [key: string]: string } | undefined
  description?: string | undefined
  subscriptionId?: string | undefined
  invoicePdfUrl?: string | undefined
  subtotal?: string | undefined
  totalTax?: string | undefined
  totalPrepaidCreditsApplied?: string | undefined
  amountPaid?: string | undefined
  finalizedAt?: Date | undefined
  paidAt?: Date | undefined
  voidedAt?: Date | undefined
  createdAt?: Date | undefined
  lineItems?:
    | {
        id?: string | undefined
        displayName?: string | undefined
        planDisplayName?: string | undefined
        meterDisplayName?: string | undefined
        quantity?: string | undefined
        amount?: string | undefined
        priceType?: string | undefined
        periodStart?: Date | undefined
        periodEnd?: Date | undefined
      }[]
    | undefined
}

const formatDay = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)

/** `USAGE` / `FIXED` on the wire; anything else is not guessed at. */
function toLinePriceType(value: string | undefined): InvoiceLinePriceType | null {
  const upper = value?.toUpperCase()
  if (upper === 'USAGE') return InvoiceLinePriceType.Usage
  if (upper === 'FIXED') return InvoiceLinePriceType.Fixed
  return null
}

export function toInvoiceDetail(wire: InvoiceDetailWire, now?: Date): InvoiceDetail {
  const base = toInvoice(wire, now)
  const customer = wire.customer
  return {
    ...base,
    currency: wire.currency ?? '',
    customerEmail: customer?.email ?? '',
    customerAddress: {
      line1: customer?.addressLine1 ?? '',
      line2: customer?.addressLine2 ?? '',
      city: customer?.addressCity ?? '',
      state: customer?.addressState ?? '',
      postalCode: customer?.addressPostalCode ?? '',
      country: customer?.addressCountry ?? '',
    },
    tenantId: wire.tenantId ?? '',
    metadata: wire.metadata ?? {},
    description: wire.description ?? '',
    subscriptionId: wire.subscriptionId || null,
    invoicePdfUrl: wire.invoicePdfUrl || null,
    subtotal: wire.subtotal ?? '0',
    tax: wire.totalTax ?? '0',
    prepaidCredits: wire.totalPrepaidCreditsApplied ?? '0',
    amountPaid: wire.amountPaid ?? '0',
    lines: (wire.lineItems ?? []).map((line, index) => ({
      id: line.id ?? `line_${index}`,
      description: line.displayName || line.planDisplayName || line.meterDisplayName || 'Line item',
      detail:
        line.periodStart && line.periodEnd
          ? `${formatDay(line.periodStart)} – ${formatDay(line.periodEnd)}`
          : '',
      quantity: line.quantity ?? '',
      amount: line.amount ?? '0',
      priceType: toLinePriceType(line.priceType),
    })),
    finalizedAt: wire.finalizedAt ?? null,
    paidAt: wire.paidAt ?? null,
    voidedAt: wire.voidedAt ?? null,
    createdAt: wire.createdAt ?? null,
  }
}

/** One invoice with its lines — `GET /invoices/{id}`. */
export function useInvoice(id: string, options: { enabled?: boolean } = {}) {
  const client = useFlexprice()

  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: queryKeys.invoices.detail(id),
    queryFn: async () =>
      toInvoiceDetail((await call(() => client.invoices.getInvoice(id))) as InvoiceDetailWire),
  })
}

/** Builds `POST /invoices`. Money stays a string; the form's total is sent as given. */
export function toCreateInvoiceRequest(draft: CreateInvoice): Record<string, unknown> {
  const description = draft.description.trim()
  return {
    customerId: draft.customerId,
    currency: draft.currency.toUpperCase(),
    subtotal: draft.total,
    total: draft.total,
    amountDue: draft.total,
    invoiceType: 'ONE_OFF',
    invoiceStatus: draft.finalize ? 'FINALIZED' : 'DRAFT',
    ...(description ? { description } : {}),
    ...(draft.dueDate ? { dueDate: new Date(`${draft.dueDate}T00:00:00Z`) } : {}),
    lineItems: draft.lines.map((line) => ({
      displayName: line.description.trim(),
      quantity: line.quantity,
      amount: line.amount,
    })),
  }
}

export function useCreateInvoice() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: CreateInvoice) =>
      call(() => client.invoices.createInvoice(toCreateInvoiceRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
    },
  })
}

function useInvoiceAction(run: (client: Flexprice, id: string) => Promise<unknown>) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => run(client, id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
    },
  })
}

/** Lock a draft and send it — `POST /invoices/{id}/finalize`. */
export const useFinalizeInvoice = () =>
  useInvoiceAction((client, id) => client.invoices.finalizeInvoice(id))

/** Void an open invoice — `POST /invoices/{id}/void`. */
export const useVoidInvoice = () =>
  useInvoiceAction((client, id) => client.invoices.voidInvoice(id))

/** Try to collect payment again — `POST /invoices/{id}/payment/attempt`. */
export const useAttemptInvoicePayment = () =>
  useInvoiceAction((client, id) => client.invoices.attemptInvoicePayment(id))

/**
 * Recalculate a draft invoice in place — `POST /invoices/{id}/recalculate-v2`.
 * Replaces the line items and reapplies credits, coupons and taxes; the draft
 * stays a draft.
 */
export const useRecalculateInvoice = () =>
  useInvoiceAction((client, id) => client.invoices.recalculateInvoiceV2(id))

/**
 * Send the invoice to the customer — `POST /invoices/{id}/comms/trigger`.
 * Fires the invoice communication webhook (email, Slack) the tenant has set up.
 */
export const useSendInvoice = () =>
  useInvoiceAction((client, id) => client.invoices.triggerInvoiceCommsWebhook(id))

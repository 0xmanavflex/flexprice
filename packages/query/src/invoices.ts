import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type AuthSource,
  type Flexprice,
  call,
  getInvoice,
  getInvoicePdfUrl,
  searchInvoices,
} from '@fp/api'
import {
  type CreateInvoice,
  type Invoice,
  type InvoiceDetail,
  type InvoiceQuery,
  type InvoiceSellerSnapshot,
  InvoiceLinePriceType,
  InvoiceSortField,
  InvoiceStatus,
  deriveInvoiceStatus,
  isZeroMoney,
  moneyOr,
  toPaymentStatus,
  toWirePaymentStatus,
  PaymentStatus,
  BILLING_ENTITY_FILTER,
  INVOICE_FILTERS,
  type ListFilterSpec,
} from '@fp/domain'
import { queryKeys } from './keys'
import { toFilterConditions, toTopLevelChoice } from './search'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'
import { credentials, fromWire, toWireBody } from './wire'

/**
 * The translation layer, and the reason it is not in a component.
 *
 * `InvoiceResponse` has ~45 optional fields, money as strings, and three
 * different "status" notions. Everything awkward about that is absorbed here,
 * once, so the grid receives a narrow, total `Invoice` and the page receives a
 * list plus a count.
 *
 * If the API model is ever genuinely unusable, this is where that shows up:
 * as a hard mapping function, not as `?? '0'` scattered through columns.
 */

/** Domain vocabulary out, transport vocabulary in. */
const SORT_FIELD_TO_API: Record<InvoiceSortField, string> = {
  [InvoiceSortField.UpdatedAt]: 'updated_at',
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
 * by them is therefore a deliberate gap, not an oversight: see
 * {@link isServerFilterable}.
 */
const STATUS_TO_API: Partial<Record<InvoiceStatus, string>> = {
  [InvoiceStatus.Draft]: 'DRAFT',
  [InvoiceStatus.Open]: 'FINALIZED',
  [InvoiceStatus.Void]: 'VOIDED',
  [InvoiceStatus.Skipped]: 'SKIPPED',
}

/**
 * Every stored `invoice_status`, sent when the list asks for no particular one.
 *
 * Leaving the field out is not "any status": the search then drops SKIPPED
 * invoices, so the ledger came up short and the Invoice status → Skipped
 * filter (a filter condition, intersected with that default) found nothing.
 * V1 sends all four for the same reason.
 */
export const ALL_INVOICE_STATUSES = ['DRAFT', 'FINALIZED', 'VOIDED', 'SKIPPED'] as const

export function isServerFilterable(status: InvoiceStatus): boolean {
  return status in STATUS_TO_API
}

/** Builds the request. Page numbers are 1-based for people, offsets are not. */
/** `specs` are the filters the list offers: the entity filter is among them only while entities are enabled. */
export function toInvoiceFilter(
  query: InvoiceQuery,
  scope?: { customerId?: string },
  specs: readonly ListFilterSpec[] = INVOICE_FILTERS,
): Record<string, unknown> {
  // Paid and overdue are derived from finalized invoices, so asking for either
  // asks the server for finalized ones too; the page then keeps the matches.
  const derived = query.statuses.some((s) => !isServerFilterable(s))
  const statuses = [
    ...new Set([
      ...query.statuses.map((s) => STATUS_TO_API[s]).filter((s): s is string => s !== undefined),
      ...(derived ? ['FINALIZED'] : []),
    ]),
  ]
  const search = query.search.trim()
  const conditions = [
    ...toFilterConditions(query.filters ?? [], specs),
    // The search box finds invoice numbers, as V1's does. It used to be sent as
    // an external customer id, so a typed number 404'd as an unknown customer.
    ...(search
      ? [
          {
            field: 'invoice_number',
            operator: 'contains',
            dataType: 'string',
            value: { string: search },
          },
        ]
      : []),
  ]
  const billingEntityId = toTopLevelChoice(query.filters ?? [], specs, BILLING_ENTITY_FILTER.field)

  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: [{ field: SORT_FIELD_TO_API[query.sortBy], direction: query.sortDirection }],
    // Line items are never rendered in a list, and they dominate the payload.
    skipLineItems: true,
    ...(conditions.length > 0 ? { filters: conditions } : {}),
    invoiceStatus: statuses.length > 0 ? statuses : [...ALL_INVOICE_STATUSES],
    ...(scope?.customerId ? { customerId: scope.customerId } : {}),
    ...(billingEntityId ? { billingEntityId } : {}),
  }
}

/** The shape this mapper reads. Structural, so a fixture need not be complete. */
export interface SellerSnapshotWire {
  billingEntityId?: string | undefined
  legalName?: string | undefined
  sellerDetails?:
    | {
        email?: string | undefined
        helpEmail?: string | undefined
        phone?: string | undefined
        address?:
          | {
              addressLine1?: string | undefined
              addressLine2?: string | undefined
              addressCity?: string | undefined
              addressState?: string | undefined
              addressPostalCode?: string | undefined
              addressCountry?: string | undefined
            }
          | undefined
      }
    | undefined
  taxIdentifiers?:
    | { country?: string | undefined; type?: string | undefined; value?: string | undefined }[]
    | undefined
}

function toSellerSnapshot(wire: SellerSnapshotWire): InvoiceSellerSnapshot {
  const details = wire.sellerDetails
  const address = details?.address
  return {
    billingEntityId: wire.billingEntityId ?? '',
    legalName: wire.legalName ?? '',
    email: details?.email ?? '',
    helpEmail: details?.helpEmail ?? '',
    phone: details?.phone ?? '',
    address: {
      line1: address?.addressLine1 ?? '',
      line2: address?.addressLine2 ?? '',
      city: address?.addressCity ?? '',
      state: address?.addressState ?? '',
      postalCode: address?.addressPostalCode ?? '',
      country: address?.addressCountry ?? '',
    },
    taxIdentifiers: (wire.taxIdentifiers ?? []).map((identifier) => ({
      country: identifier.country ?? '',
      type: identifier.type ?? '',
      value: identifier.value ?? '',
    })),
  }
}

export interface InvoiceWire {
  billingEntityId?: string | undefined
  sellerSnapshot?: SellerSnapshotWire | undefined
  subscriptionId?: string | undefined
  id?: string | undefined
  invoiceNumber?: string | undefined
  customerId?: string | undefined
  customer?:
    { id?: string | undefined; name?: string | undefined; email?: string | undefined } | undefined
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

/**
 * The expanded customer, when it is the one the invoice bills.
 *
 * An invoice raised for a contract with a separate invoicing customer stores
 * that customer in `customer_id`, but the API expands the contract's customer.
 * Read as the invoice's own, it put the wrong name under Bill to; a mismatched
 * expansion is dropped instead, and the id stands until the page looks it up.
 */
function billedCustomer<C extends { id?: string | undefined }>(wire: {
  customerId?: string | undefined
  customer?: C | undefined
}): C | undefined {
  const customer = wire.customer
  if (!customer) return undefined
  return customer.id && wire.customerId && customer.id !== wire.customerId ? undefined : customer
}

/**
 * Whether money is still owed. The balance left decides; without it, the
 * amount due. With neither, the invoice is not assumed settled: a missing
 * field read as zero once showed unpaid invoices as Paid.
 */
function outstanding(wire: Pick<InvoiceWire, 'amountRemaining' | 'amountDue' | 'currency'>) {
  const balance = wire.amountRemaining ?? wire.amountDue
  if (balance === undefined || balance === null || balance === '') return true
  return !isZeroMoney(moneyOr(balance, wire.currency))
}

export function toInvoice(wire: InvoiceWire, now?: Date): Invoice {
  const currency = wire.currency
  const amountRemaining = moneyOr(wire.amountRemaining, currency)
  const customer = billedCustomer(wire)

  return {
    id: wire.id ?? '',
    subscriptionId: wire.subscriptionId || null,
    // Drafts often have no invoice number yet. Leave it blank so the UI shows
    // a dash instead of the internal id.
    number: wire.invoiceNumber?.trim() ?? '',
    customerId: wire.customerId ?? '',
    // Resolved here so no cell has to fall back, and no grid joins data.
    customerName: customer?.name || customer?.email || (wire.customerId ?? 'Unknown'),
    status: deriveInvoiceStatus({
      invoiceStatus: wire.invoiceStatus,
      paymentStatus: wire.paymentStatus,
      dueDate: wire.dueDate ?? null,
      hasOutstandingBalance: outstanding(wire),
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
    ...(wire.billingEntityId ? { billingEntityId: wire.billingEntityId } : {}),
    ...(wire.sellerSnapshot ? { sellerSnapshot: toSellerSnapshot(wire.sellerSnapshot) } : {}),
  }
}

export interface InvoicePage {
  invoices: Invoice[]
  /** Server-side total, for the grid's record count. */
  total: number
}

export async function fetchInvoices(
  serverURL: string,
  auth: AuthSource,
  query: InvoiceQuery,
  signal?: AbortSignal,
  scope?: { customerId?: string },
  specs?: readonly ListFilterSpec[],
): Promise<InvoicePage> {
  const { token, environmentId } = await credentials(auth, 'Sign in to view invoices.')
  const response = fromWire<{
    items?: InvoiceWire[] | null
    pagination?: { total?: number }
  }>(
    await searchInvoices(
      serverURL,
      token,
      environmentId,
      toWireBody(toInvoiceFilter(query, scope, specs)),
      signal,
    ),
  )
  return {
    invoices: (response?.items ?? []).map((item) => toInvoice(item)),
    total: response?.pagination?.total ?? 0,
  }
}

/**
 * The page's entire interface to invoices.
 *
 * Takes domain vocabulary, returns domain models. The caller never learns that
 * listing invoices is a `POST` to `/invoices/search`, or that paging is an
 * offset: which is what lets the page hand its state to a URL instead of to a
 * component.
 */
/** `specs`: the filters the list offers, when they differ from `INVOICE_FILTERS` (the entity filter). */
export function useInvoices(
  query: InvoiceQuery,
  options: { enabled?: boolean; specs?: readonly ListFilterSpec[] } = {},
) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const billingEntityId = toTopLevelChoice(
    query.filters ?? [],
    options.specs ?? INVOICE_FILTERS,
    BILLING_ENTITY_FILTER.field,
  )

  return useQuery({
    queryKey: queryKeys.invoices.list({
      ...query,
      statuses: [...query.statuses].sort(),
      // Whether the entity filter is sent, so turning entities on refetches.
      ...(billingEntityId ? { billingEntityId } : {}),
    }),
    queryFn: ({ signal }) =>
      fetchInvoices(serverURL, auth, query, signal, undefined, options.specs),
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
        id?: string | undefined
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
  taxes?:
    | {
        id?: string | undefined
        taxableAmount?: string | undefined
        taxAmount?: string | undefined
        taxBehavior?: string | undefined
        taxTransactionType?: string | undefined
        taxRate?:
          | {
              name?: string | undefined
              code?: string | undefined
              percentageValue?: string | undefined
            }
          | undefined
      }[]
    | null
    | undefined
  taxSummary?: { exemption?: { reason?: string | undefined } | null | undefined } | null | undefined
  totalPrepaidCreditsApplied?: string | undefined
  totalDiscount?: string | undefined
  amountPaid?: string | undefined
  finalizedAt?: Date | undefined
  paidAt?: Date | undefined
  voidedAt?: Date | undefined
  createdAt?: Date | undefined
  lineItems?:
    | {
        id?: string | undefined
        priceId?: string | undefined
        displayName?: string | undefined
        planDisplayName?: string | undefined
        meterDisplayName?: string | undefined
        quantity?: string | undefined
        amount?: string | undefined
        priceType?: string | undefined
        periodStart?: Date | undefined
        periodEnd?: Date | undefined
        metadata?: Record<string, string> | undefined
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
  const customer = billedCustomer(wire)
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
    // A reversal un-files a tax; it is not one the invoice charges.
    taxes: (wire.taxes ?? [])
      .filter((tax) => tax.taxTransactionType !== 'reversal')
      .map((tax, index) => ({
        id: tax.id ?? `tax_${index}`,
        name: tax.taxRate?.name ?? '',
        code: tax.taxRate?.code ?? '',
        percentage: tax.taxRate?.percentageValue ?? null,
        behavior:
          tax.taxBehavior === 'inclusive' || tax.taxBehavior === 'exclusive'
            ? tax.taxBehavior
            : null,
        taxableAmount: tax.taxableAmount ?? '0',
        taxAmount: tax.taxAmount ?? '0',
      })),
    taxExemption: wire.taxSummary?.exemption?.reason || null,
    prepaidCredits: wire.totalPrepaidCreditsApplied ?? '0',
    discount: wire.totalDiscount ?? '0',
    amountPaid: wire.amountPaid ?? '0',
    lines: (wire.lineItems ?? []).map((line, index) => ({
      id: line.id ?? `line_${index}`,
      priceId: line.priceId ?? '',
      description: line.displayName || line.planDisplayName || line.meterDisplayName || 'Line item',
      detail:
        line.periodStart && line.periodEnd
          ? `${formatDay(line.periodStart)} – ${formatDay(line.periodEnd)}`
          : '',
      quantity: line.quantity ?? '',
      amount: line.amount ?? '0',
      priceType: toLinePriceType(line.priceType),
      note: line.metadata?.['description'] ?? '',
      periodStart: line.periodStart ?? null,
      periodEnd: line.periodEnd ?? null,
    })),
    finalizedAt: wire.finalizedAt ?? null,
    paidAt: wire.paidAt ?? null,
    voidedAt: wire.voidedAt ?? null,
    createdAt: wire.createdAt ?? null,
  }
}

export async function fetchInvoice(
  serverURL: string,
  auth: AuthSource,
  id: string,
  signal?: AbortSignal,
): Promise<InvoiceDetail> {
  const { token, environmentId } = await credentials(auth, 'Sign in to view this invoice.')
  const body = await getInvoice(serverURL, token, environmentId, id, signal)
  return toInvoiceDetail(fromWire<InvoiceDetailWire>(body))
}

/** One invoice with its lines: `GET /invoices/{id}`. */
export function useInvoice(id: string, options: { enabled?: boolean } = {}) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: queryKeys.invoices.detail(id),
    queryFn: ({ signal }) => fetchInvoice(serverURL, auth, id, signal),
  })
}

/** Reads one invoice on demand, through the detail page's cache: a row's CSV download. */
export function useInvoiceDetailLoader() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()

  return (id: string): Promise<InvoiceDetail> =>
    queryClient.fetchQuery({
      queryKey: queryKeys.invoices.detail(id),
      queryFn: ({ signal }) => fetchInvoice(serverURL, auth, id, signal),
    })
}

/**
 * An invoice's PDF link, read on demand for "Download invoice".
 *
 * The invoice's own `invoice_pdf_url` when it has one; otherwise the PDF route
 * (`/invoices/{id}/pdf?url=true`), which renders it and answers a presigned
 * link. Null when neither gives one.
 */
export function useInvoicePdfLink() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()

  return async (id: string): Promise<string | null> => {
    const cached = queryClient.getQueryData<InvoiceDetail>(queryKeys.invoices.detail(id))
    if (cached?.invoicePdfUrl) return cached.invoicePdfUrl
    const { token, environmentId } = await credentials(auth, 'Sign in to download this invoice.')
    return getInvoicePdfUrl(serverURL, token, environmentId, id)
  }
}

/** Builds `POST /invoices`. Money stays a string; the form's total is sent as given. */
export function toCreateInvoiceRequest(draft: CreateInvoice): Record<string, unknown> {
  const description = draft.description.trim()
  const number = draft.invoiceNumber.trim()
  const day = (value: string) => new Date(`${value}T00:00:00Z`)
  const currency = draft.currency.toUpperCase()
  return {
    customerId: draft.customerId,
    currency,
    subtotal: draft.total,
    total: draft.total,
    amountDue: draft.total,
    invoiceType: 'ONE_OFF',
    billingReason: 'MANUAL',
    invoiceStatus: draft.finalize ? 'FINALIZED' : 'DRAFT',
    paymentStatus: 'PENDING',
    ...(number ? { invoiceNumber: number } : {}),
    ...(description ? { description } : {}),
    issueDate: draft.issueDate ? day(draft.issueDate) : new Date(),
    ...(draft.dueDate ? { dueDate: day(draft.dueDate) } : {}),
    ...(Object.keys(draft.metadata).length > 0 ? { metadata: draft.metadata } : {}),
    ...(draft.taxes.length > 0
      ? {
          taxRateOverrides: draft.taxes.map((tax) => ({
            taxRateCode: tax.taxRateCode,
            currency: currency.toLowerCase(),
            taxBehavior: tax.taxBehavior,
            priority: tax.priority,
            autoApply: tax.autoApply,
          })),
        }
      : {}),
    lineItems: draft.lines.map((line) => ({
      displayName: line.description.trim(),
      quantity: line.quantity,
      amount: line.amount,
      ...(line.periodStart ? { periodStart: day(line.periodStart) } : {}),
      ...(line.periodEnd ? { periodEnd: day(line.periodEnd) } : {}),
      ...(line.note.trim() ? { metadata: { description: line.note.trim() } } : {}),
    })),
  }
}

export function useCreateInvoice() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Invoice created', error: 'Could not create the invoice.' } },
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

/**
 * What `PUT /invoices/{id}` will actually change.
 *
 * Worth stating, because the route's name promises far more than it does: the
 * request body is `invoice_pdf_url`, `due_date`, `metadata` and
 * `apply_discount`, and nothing else. A customer, a currency, an amount or a
 * line item cannot be edited after an invoice exists: correcting one of those
 * means voiding and reissuing, or a credit note.
 *
 * `applyDiscount` recalculates the discount from the invoice's existing coupon
 * associations and is accepted on drafts only.
 */
export interface InvoiceEdit {
  id: string
  dueDate?: Date | null
  metadata?: Record<string, string>
  applyDiscount?: boolean
}

export function useUpdateInvoice() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, dueDate, metadata, applyDiscount }: InvoiceEdit) =>
      call(() =>
        // Each field is sent only when the caller named it: the API treats an
        // absent key as "leave it alone", so spreading undefined would be the
        // difference between not touching the metadata and clearing it.
        client.invoices.updateInvoice(id, {
          ...(dueDate !== undefined ? { dueDate: dueDate ?? undefined } : {}),
          ...(metadata !== undefined ? { metadata } : {}),
          ...(applyDiscount ? { applyDiscount: true } : {}),
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
    },
  })
}

/** The modify body and its params, taken from the SDK rather than restated. */
type ModifyBody = Parameters<Flexprice['invoices']['executeInvoiceModify']>[1]
type LineItemParams = NonNullable<ModifyBody['lineItemParams']>

/** One pending change to a draft invoice's lines, as the editor collects them. */
export interface LineItemEdit {
  /** The line being changed; absent means a line being added. */
  id?: string
  displayName: string
  amount: string
  quantity: string
  description?: string
  /** The service period, as calendar days (`YYYY-MM-DD`). */
  periodStart?: string
  periodEnd?: string
}

export interface InvoiceLineChanges {
  invoiceId: string
  /** Lines whose id is gone from the editor. */
  removed: string[]
  /** Lines that exist and changed. */
  updated: LineItemEdit[]
  /** Lines typed into the blank row. */
  added: LineItemEdit[]
}

/**
 * Edits a draft invoice's lines: `POST /invoices/{id}/modify/execute`.
 *
 * This is the endpoint `PUT /invoices/{id}` is not: the update route takes a
 * due date and metadata and nothing structural, while this one adds, updates
 * and removes line items and recalculates the totals from what is left.
 *
 * ## Why this is a sequence and not one request
 *
 * The API takes one action per call, and two of its rules make the order and
 * the chaining matter rather than being a style choice:
 *
 *   - **An update versions the line item**, so the id changes. A second update
 *     addressed to the id the editor started with would miss. Updates
 *     therefore go one at a time, and nothing may reuse an id afterwards.
 *   - **Modifying a finalized invoice voids it and returns a draft copy under
 *     a new id.** Every later call in the batch has to target that new id, and
 *     the API rejects one that still names the voided original. So the id is
 *     threaded through the loop, and the final one is returned for the caller
 *     to navigate to.
 *
 * Removes run first and adds last. Removing before updating keeps the batch
 * small, and adding last means a new line cannot be caught by an update
 * intended for an existing one.
 *
 * Failure is deliberately not rolled back. There is no transaction here, and
 * inventing a compensating one would mean issuing more edits against an
 * invoice whose state is already not what this code expected. The error
 * reaches the caller with the invoice id that survived, so the screen can
 * re-read the truth rather than guess at it.
 */
/**
 * Applies the edits in the order the API's rules require.
 *
 * Separated from the hook because the ordering and the id-threading *are* the
 * logic, and they are worth testing without a React tree or a network. The
 * hook supplies an `execute` that talks to the SDK; a test supplies one that
 * records what it was asked to do.
 *
 * Returns the invoice id the batch ended on, which is not always the one it
 * started with: see the note on {@link useModifyInvoiceLineItems}.
 */
export async function applyLineChanges(
  changes: InvoiceLineChanges,
  execute: (invoiceId: string, params: LineItemParams) => Promise<string | undefined>,
): Promise<string> {
  let id = changes.invoiceId

  const run = async (params: LineItemParams) => {
    const next = await execute(id, params)
    // The response names the invoice the next call must address: the same one
    // for a draft, a fresh draft copy when a finalized invoice was modified.
    if (next) id = next
  }

  const body = (line: LineItemEdit) => ({
    displayName: line.displayName,
    amount: line.amount,
    quantity: line.quantity,
    ...(line.description !== undefined ? { description: line.description } : {}),
    ...(line.periodStart ? { periodStart: new Date(`${line.periodStart}T00:00:00Z`) } : {}),
    ...(line.periodEnd ? { periodEnd: new Date(`${line.periodEnd}T00:00:00Z`) } : {}),
  })

  if (changes.removed.length > 0) {
    await run({ action: 'remove', lineItemIds: changes.removed })
  }
  for (const line of changes.updated) {
    if (!line.id) continue
    await run({ action: 'update', lineItemId: line.id, update: body(line) })
  }
  if (changes.added.length > 0) {
    await run({ action: 'add', items: changes.added.map(body) })
  }

  return id
}

export function useModifyInvoiceLineItems() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (changes: InvoiceLineChanges) => {
      const invoiceId = await applyLineChanges(changes, async (id, lineItemParams) => {
        const response = await call(() =>
          client.invoices.executeInvoiceModify(id, {
            type: 'line_item',
            lineItemParams,
          }),
        )
        return (response as { invoice?: { id?: string } }).invoice?.id
      })
      return { invoiceId }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
    },
  })
}

/** Everything the edit page can change, in one save. Absent means untouched. */
export interface InvoiceEditSave {
  invoiceId: string
  /** A new due date; `null` clears it. */
  dueDate?: Date | null
  metadata?: Record<string, string>
  applyDiscount?: boolean
  paymentStatus?: { status: PaymentStatus; amount?: string }
  lines?: Omit<InvoiceLineChanges, 'invoiceId'>
  /** A lifecycle step taken after everything else. */
  nextStatus?: 'finalize' | 'void'
}

/** The calls a save is made of, so the order can be tested without a network. */
export interface InvoiceEditCalls {
  /** `PUT /invoices/{id}`; resolves with the invoice the update landed on. */
  update: (
    id: string,
    body: { dueDate?: Date | null; metadata?: Record<string, string>; applyDiscount?: boolean },
  ) => Promise<string | undefined>
  paymentStatus: (id: string, change: { status: PaymentStatus; amount?: string }) => Promise<void>
  /** One `modify/execute`; resolves with the invoice the next call must address. */
  modify: (
    id: string,
    params: Parameters<typeof applyLineChanges>[1] extends (
      invoiceId: string,
      params: infer P,
    ) => Promise<string | undefined>
      ? P
      : never,
  ) => Promise<string | undefined>
  finalize: (id: string) => Promise<void>
  void: (id: string) => Promise<void>
}

/**
 * Saves an invoice edit in the order the API's rules require: V1's order:
 *
 *   1. **The invoice's own fields** (due date, metadata, re-applying discounts).
 *      Re-applying discounts on a finalized invoice voids it and returns a
 *      draft copy, so every later step follows the id it hands back.
 *   2. **Payment status**, while the invoice is still the one it was.
 *   3. **Line edits**, removes then updates then adds: see {@link applyLineChanges}.
 *      On a finalized invoice the first one voids it into a draft copy too.
 *   4. **A lifecycle step** last: finalizing must see the finished draft, and
 *      voiding discards it.
 *
 * Resolves with the id the edit ended on: the page to show afterwards.
 */
export async function runInvoiceEdit(
  edit: InvoiceEditSave,
  calls: InvoiceEditCalls,
): Promise<string> {
  let id = edit.invoiceId

  const fields = {
    ...(edit.dueDate !== undefined ? { dueDate: edit.dueDate } : {}),
    ...(edit.metadata !== undefined ? { metadata: edit.metadata } : {}),
    ...(edit.applyDiscount ? { applyDiscount: true } : {}),
  }
  if (Object.keys(fields).length > 0) id = (await calls.update(id, fields)) ?? id

  if (edit.paymentStatus) await calls.paymentStatus(id, edit.paymentStatus)

  if (edit.lines) {
    const { removed, updated, added } = edit.lines
    if (removed.length > 0 || updated.length > 0 || added.length > 0) {
      id = await applyLineChanges({ invoiceId: id, ...edit.lines }, calls.modify)
    }
  }

  if (edit.nextStatus === 'finalize') await calls.finalize(id)
  if (edit.nextStatus === 'void') await calls.void(id)
  return id
}

/** Saves the whole edit page: {@link runInvoiceEdit} over the SDK. */
export function useSaveInvoiceEdit() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (edit: InvoiceEditSave) =>
      runInvoiceEdit(edit, {
        update: async (id, body) => {
          const response = await call(() =>
            client.invoices.updateInvoice(id, {
              ...(body.dueDate !== undefined ? { dueDate: body.dueDate ?? undefined } : {}),
              ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
              ...(body.applyDiscount ? { applyDiscount: true } : {}),
            }),
          )
          return (response as { id?: string } | undefined)?.id
        },
        paymentStatus: async (id, change) => {
          await call(() =>
            client.invoices.updateInvoicePaymentStatus(id, {
              paymentStatus: toWirePaymentStatus(change.status),
              ...(change.status === PaymentStatus.Pending && change.amount
                ? { amount: change.amount }
                : {}),
            } as never),
          )
        },
        modify: async (id, lineItemParams) => {
          const response = await call(() =>
            client.invoices.executeInvoiceModify(id, { type: 'line_item', lineItemParams }),
          )
          return (response as { invoice?: { id?: string } }).invoice?.id
        },
        finalize: async (id) => {
          await call(() => client.invoices.finalizeInvoice(id))
        },
        void: async (id) => {
          await call(() => client.invoices.voidInvoice(id))
        },
      }),
    // Settled, not success: a save that failed half way has still changed
    // something, and the screen must re-read the truth rather than trust its form.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() })
    },
  })
}

/** Replace an invoice's metadata: `PUT /invoices/{id}` with `{metadata}` and nothing else. */
export function useUpdateInvoiceMetadata() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, metadata }: { id: string; metadata: Record<string, string> }) =>
      call(() => client.invoices.updateInvoice(id, { metadata })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
    },
  })
}

/**
 * Set an invoice's payment status by hand: `PUT /invoices/{id}/payment`:
 * for money that moved outside Flexprice. `status` is the wire value
 * (`SUCCEEDED`, `FAILED`, `PENDING`).
 */
export function useUpdateInvoicePaymentStatus() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status, amount }: { id: string; status: PaymentStatus; amount?: string }) =>
      call(() =>
        client.invoices.updateInvoicePaymentStatus(id, {
          paymentStatus: toWirePaymentStatus(status),
          // Only pending records a partial amount; the others set it themselves.
          ...(status === PaymentStatus.Pending && amount ? { amount } : {}),
        } as never),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
    },
  })
}

/** Lock a draft and send it: `POST /invoices/{id}/finalize`. */
export const useFinalizeInvoice = () =>
  useInvoiceAction((client, id) => client.invoices.finalizeInvoice(id))

/** Void an open invoice: `POST /invoices/{id}/void`. */
export const useVoidInvoice = () =>
  useInvoiceAction((client, id) => client.invoices.voidInvoice(id))

/** Try to collect payment again: `POST /invoices/{id}/payment/attempt`. */
export const useAttemptInvoicePayment = () =>
  useInvoiceAction((client, id) => client.invoices.attemptInvoicePayment(id))

/**
 * Recalculate a draft invoice in place: `POST /invoices/{id}/recalculate-v2`.
 * Replaces the line items and reapplies credits, coupons and taxes; the draft
 * stays a draft.
 */
export const useRecalculateInvoice = () =>
  useInvoiceAction((client, id) => client.invoices.recalculateInvoiceV2(id))

/**
 * Replace a voided contract invoice with a fresh one for the same period:
 * `POST /invoices/{id}/recalculate`. Starts a workflow; the replacement shows
 * up in the invoice list once it completes.
 */
export function useReplaceVoidedInvoice() {
  const queryClient = useQueryClient()
  const action = useInvoiceAction((client, id) => client.invoices.recalculateInvoice(id))
  return {
    ...action,
    // A contract keeps its own invoice list; the replacement belongs there too.
    mutateAsync: async (id: string) => {
      const result = await action.mutateAsync(id)
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() })
      return result
    },
  }
}

/**
 * Send the invoice to the customer: `POST /invoices/{id}/comms/trigger`.
 * Fires the invoice communication webhook (email, Slack) the tenant has set up.
 */
export const useSendInvoice = () =>
  useInvoiceAction((client, id) => client.invoices.triggerInvoiceCommsWebhook(id))

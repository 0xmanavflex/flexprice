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
  toWirePaymentStatus,
  PaymentStatus,
  INVOICE_FILTERS,
} from '@fp/domain'
import { queryKeys } from './keys'
import { toFilterConditions } from './search'
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
    ...((query.filters?.length ?? 0) > 0
      ? { filters: toFilterConditions(query.filters ?? [], INVOICE_FILTERS) }
      : {}),
    ...(statuses.length > 0 ? { invoiceStatus: statuses } : {}),
    ...(query.search ? { externalCustomerId: query.search } : {}),
  }
}

/** The shape this mapper reads. Structural, so a fixture need not be complete. */
export interface InvoiceWire {
  subscriptionId?: string | undefined
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
    subscriptionId: wire.subscriptionId || null,
    // Drafts often have no invoice number yet. Leave it blank so the UI shows
    // a dash instead of the internal id.
    number: wire.invoiceNumber?.trim() ?? '',
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

export async function fetchInvoices(
  client: Flexprice,
  query: InvoiceQuery,
  signal?: AbortSignal,
): Promise<InvoicePage> {
  const response = await call(
    (options) => client.invoices.queryInvoice(toInvoiceFilter(query) as never, options),
    signal,
  )
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
    queryFn: ({ signal }) => fetchInvoices(client, query, signal),
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

/** One invoice with its lines — `GET /invoices/{id}`. */
export function useInvoice(id: string, options: { enabled?: boolean } = {}) {
  const client = useFlexprice()

  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: queryKeys.invoices.detail(id),
    queryFn: async ({ signal }) =>
      toInvoiceDetail(
        (await call(
          (options) => client.invoices.getInvoice(id, undefined, undefined, undefined, options),
          signal,
        )) as InvoiceDetailWire,
      ),
  })
}

/**
 * An invoice's PDF link, read on demand for a row's "Download invoice".
 *
 * Rows come from the list, which does not carry `invoice_pdf_url`; this reads
 * the invoice through the same query the detail page uses (so a later visit is
 * cached) and resolves to its link, or null when no PDF exists yet.
 */
export function useInvoicePdfLink() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return (id: string): Promise<string | null> =>
    queryClient
      .fetchQuery({
        queryKey: queryKeys.invoices.detail(id),
        queryFn: async ({ signal }) =>
          toInvoiceDetail(
            (await call(
              (options) => client.invoices.getInvoice(id, undefined, undefined, undefined, options),
              signal,
            )) as InvoiceDetailWire,
          ),
      })
      .then((invoice) => invoice.invoicePdfUrl)
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
 * line item cannot be edited after an invoice exists — correcting one of those
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
 * Edits a draft invoice's lines — `POST /invoices/{id}/modify/execute`.
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
 * started with — see the note on {@link useModifyInvoiceLineItems}.
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
 * Saves an invoice edit in the order the API's rules require — V1's order:
 *
 *   1. **The invoice's own fields** (due date, metadata, re-applying discounts).
 *      Re-applying discounts on a finalized invoice voids it and returns a
 *      draft copy, so every later step follows the id it hands back.
 *   2. **Payment status**, while the invoice is still the one it was.
 *   3. **Line edits**, removes then updates then adds — see {@link applyLineChanges}.
 *      On a finalized invoice the first one voids it into a draft copy too.
 *   4. **A lifecycle step** last: finalizing must see the finished draft, and
 *      voiding discards it.
 *
 * Resolves with the id the edit ended on — the page to show afterwards.
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

/** Saves the whole edit page — {@link runInvoiceEdit} over the SDK. */
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

/** Replace an invoice's metadata — `PUT /invoices/{id}` with `{metadata}` and nothing else. */
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
 * Set an invoice's payment status by hand — `PUT /invoices/{id}/payment` —
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, type AuthSource, ErrorKind, call, listCreditNotes } from '@fp/api'
import {
  type CreateCreditNote,
  type CreditNote,
  type CreditNoteDetail,
  type CreditNoteQuery,
  CreditNoteStatus,
  CreditNoteType,
  moneyOr,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Credit notes, through `GET /creditnotes`: a route the SDK has no method for,
 * so this reads the raw snake_case body (see `@fp/api` `creditNotes.ts`).
 * Status is a server-side filter; search narrows the returned page.
 */

export interface CreditNoteWire {
  id?: string
  credit_note_number?: string
  credit_note_status?: string
  credit_note_type?: string
  currency?: string
  total_amount?: string | number
  created_at?: string
  invoice_id?: string
  invoice?: { invoice_number?: string }
  customer?: { name?: string; external_id?: string }
}

const STATUS_FROM_WIRE: Record<string, CreditNoteStatus> = {
  DRAFT: CreditNoteStatus.Draft,
  FINALIZED: CreditNoteStatus.Finalized,
  VOIDED: CreditNoteStatus.Voided,
}

const TYPE_FROM_WIRE: Record<string, CreditNoteType> = {
  ADJUSTMENT: CreditNoteType.Adjustment,
  REFUND: CreditNoteType.Refund,
}

export function toCreditNote(wire: CreditNoteWire): CreditNote {
  const created = wire.created_at ? new Date(wire.created_at) : null
  const id = wire.id ?? ''
  return {
    id,
    number: wire.credit_note_number || id.slice(0, 8),
    status: STATUS_FROM_WIRE[wire.credit_note_status ?? ''] ?? CreditNoteStatus.Draft,
    type: TYPE_FROM_WIRE[wire.credit_note_type ?? ''] ?? null,
    amount: moneyOr(
      wire.total_amount === undefined ? undefined : String(wire.total_amount),
      wire.currency,
    ),
    invoiceNumber: wire.invoice?.invoice_number?.trim() || '',
    customerName: wire.customer?.name || wire.customer?.external_id || '',
    createdAt: created && !Number.isNaN(created.getTime()) ? created : null,
  }
}

export interface CreditNotePage {
  creditNotes: CreditNote[]
  total: number
}

export async function fetchCreditNotes(
  serverURL: string,
  auth: AuthSource,
  query: CreditNoteQuery,
): Promise<CreditNotePage> {
  const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
  if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to view credit notes.')

  const body = await listCreditNotes(serverURL, token, environmentId ?? '', {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    statuses: query.statuses.map((status) => status.toUpperCase()),
  })
  const record = (body ?? {}) as {
    items?: CreditNoteWire[] | null
    pagination?: { total?: number }
  }
  const all = (record.items ?? []).map(toCreditNote)

  const term = query.search.trim().toLowerCase()
  const creditNotes = term
    ? all.filter((note) =>
        [note.number, note.invoiceNumber, note.customerName].some((field) =>
          field.toLowerCase().includes(term),
        ),
      )
    : all

  return { creditNotes, total: record.pagination?.total ?? all.length }
}

export function useCreditNotes(query: CreditNoteQuery) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.creditNotes.list({ ...query, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchCreditNotes(serverURL, auth, query),
    placeholderData: (previous) => previous,
  })
}

/**
 * The credit notes issued against one invoice, for its Credit notes tab.
 *
 * Asks the API for `invoice_id` and filters the page by it as well, so a
 * server that ignores the parameter still cannot show another invoice's notes.
 */
export async function fetchInvoiceCreditNotes(
  serverURL: string,
  auth: AuthSource,
  invoiceId: string,
): Promise<CreditNote[]> {
  const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
  if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to view credit notes.')
  const body = await listCreditNotes(serverURL, token, environmentId ?? '', {
    limit: 100,
    offset: 0,
    invoiceId,
  })
  const items = ((body ?? {}) as { items?: CreditNoteWire[] | null }).items ?? []
  return items.filter((item) => item.invoice_id === invoiceId).map(toCreditNote)
}

export function useInvoiceCreditNotes(invoiceId: string) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.creditNotes.list({ invoiceId }),
    queryFn: () => fetchInvoiceCreditNotes(serverURL, auth, invoiceId),
    enabled: invoiceId.length > 0,
  })
}

/** What `GET /creditnotes/{id}` sends once the SDK has camelCased it. */
export interface CreditNoteDetailWire {
  id?: string | undefined
  creditNoteNumber?: string | undefined
  creditNoteStatus?: string | undefined
  creditNoteType?: string | undefined
  currency?: string | undefined
  totalAmount?: string | undefined
  createdAt?: Date | undefined
  finalizedAt?: Date | undefined
  voidedAt?: Date | undefined
  invoiceId?: string | undefined
  invoice?: { invoiceNumber?: string | undefined } | undefined
  customerId?: string | undefined
  customer?: { name?: string | undefined; externalId?: string | undefined } | undefined
  reason?: string | undefined
  memo?: string | undefined
  refundStatus?: string | undefined
  lineItems?:
    | {
        id?: string | undefined
        invoiceLineItemId?: string | undefined
        displayName?: string | undefined
        amount?: string | undefined
        currency?: string | undefined
      }[]
    | undefined
}

export function toCreditNoteDetail(wire: CreditNoteDetailWire): CreditNoteDetail {
  const id = wire.id ?? ''
  return {
    id,
    number: wire.creditNoteNumber || id.slice(0, 8),
    status: STATUS_FROM_WIRE[wire.creditNoteStatus ?? ''] ?? CreditNoteStatus.Draft,
    type: TYPE_FROM_WIRE[wire.creditNoteType ?? ''] ?? null,
    amount: moneyOr(wire.totalAmount, wire.currency),
    invoiceNumber: wire.invoice?.invoiceNumber?.trim() || '',
    customerName: wire.customer?.name || wire.customer?.externalId || '',
    createdAt: wire.createdAt ?? null,
    invoiceId: wire.invoiceId ?? '',
    customerId: wire.customerId ?? '',
    reason: wire.reason ?? '',
    memo: wire.memo ?? '',
    refundStatus: wire.refundStatus ?? '',
    lines: (wire.lineItems ?? []).map((line, index) => ({
      id: line.id ?? `line_${index}`,
      invoiceLineItemId: line.invoiceLineItemId ?? '',
      description: line.displayName || 'Invoice line',
      amount: moneyOr(line.amount, line.currency ?? wire.currency),
    })),
    finalizedAt: wire.finalizedAt ?? null,
    voidedAt: wire.voidedAt ?? null,
  }
}

/** `POST /creditnotes`: only lines with an amount are credited. */
export function toCreateCreditNoteRequest(draft: CreateCreditNote): Record<string, unknown> {
  const memo = draft.memo.trim()
  return {
    invoiceId: draft.invoiceId,
    reason: draft.reason,
    lineItems: draft.lines
      .filter((line) => line.amount.trim() !== '')
      .map((line) => ({
        invoiceLineItemId: line.invoiceLineItemId,
        amount: line.amount.trim(),
        ...(line.label ? { displayName: line.label } : {}),
      })),
    processCreditNote: draft.processNow,
    ...(memo ? { memo } : {}),
    ...(draft.refundTarget ? { refundTarget: draft.refundTarget } : {}),
  }
}

export function useCreditNote(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.creditNotes.detail(id),
    queryFn: async () =>
      toCreditNoteDetail(
        (await call(() => client.creditNotes.getCreditNote(id))) as CreditNoteDetailWire,
      ),
  })
}

function useInvalidateCreditNotes() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.creditNotes.all() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
  }
}

export function useCreateCreditNote() {
  const client = useFlexprice()
  const invalidate = useInvalidateCreditNotes()

  return useMutation({
    meta: { notify: { success: 'Credit memo issued', error: 'Could not issue the credit memo.' } },
    mutationFn: (draft: CreateCreditNote) =>
      call(() => client.creditNotes.createCreditNote(toCreateCreditNoteRequest(draft) as never)),
    onSuccess: invalidate,
  })
}

/** Lock a draft and apply it: `POST /creditnotes/{id}/finalize`. */
export function useFinalizeCreditNote() {
  const client = useFlexprice()
  const invalidate = useInvalidateCreditNotes()

  return useMutation({
    mutationFn: (id: string) => call(() => client.creditNotes.processCreditNote(id)),
    onSuccess: invalidate,
  })
}

export function useVoidCreditNote() {
  const client = useFlexprice()
  const invalidate = useInvalidateCreditNotes()

  return useMutation({
    mutationFn: (id: string) => call(() => client.creditNotes.voidCreditNote(id)),
    onSuccess: invalidate,
  })
}

import { useQuery } from '@tanstack/react-query'
import { ApiError, type AuthSource, ErrorKind, listCreditNotes } from '@fp/api'
import {
  type CreditNote,
  type CreditNoteQuery,
  CreditNoteStatus,
  CreditNoteType,
  moneyOr,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Credit notes, through `GET /creditnotes` — a route the SDK has no method for,
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
    amount: moneyOr(wire.total_amount === undefined ? undefined : String(wire.total_amount), wire.currency),
    invoiceNumber: wire.invoice?.invoice_number || (wire.invoice_id ?? '').slice(0, 8),
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
  const record = (body ?? {}) as { items?: CreditNoteWire[] | null; pagination?: { total?: number } }
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

import { useMemo } from 'react'
import { BanIcon, CopyIcon, FileMinusIcon, ReceiptIcon } from '@ui/icons'
import {
  CREDIT_NOTE_STATUS_LABEL,
  type CreditNote,
  type CreditNoteQuery,
  CreditNoteStatus,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import {
  type EntityColumn,
  dateColumn,
  moneyColumn,
  pillColumn,
  textColumn,
} from '../../shared/cells'
import { statusFilter } from '@ui/compositions/tables/FilterBar'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import { CREDIT_NOTE_STATUS_TONE } from '../../shared/statusTones'

/**
 * The credit memo list, on the shared `EntityList`.
 *
 * Read-only here: a credit memo is issued against an invoice, so creating one
 * belongs to the invoice, not to this list. Status is a server-side filter on
 * `GET /creditnotes`; the search box narrows the page by number, invoice or
 * customer.
 */
export const CreditNoteGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Credit memo columns and status filter over the shared list table.',
})

const STATUS_CHOICES = Object.values(CreditNoteStatus).map((value) => ({
  value,
  label: CREDIT_NOTE_STATUS_LABEL[value],
}))

const STATUS_TONE = CREDIT_NOTE_STATUS_TONE

const GUIDES: EntityGuide[] = [
  {
    title: 'Issuing a credit memo',
    description: 'Refunding or adjusting an invoice after it has been finalized.',
    href: 'https://docs.flexprice.io/api-reference/credit-notes/create-a-new-credit-note',
    icon: <FileMinusIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Finalizing a draft',
    description: 'Processing a draft so the refund or adjustment takes effect.',
    href: 'https://docs.flexprice.io/api-reference/credit-notes/process-a-draft-credit-note',
    icon: <ReceiptIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Voiding a credit memo',
    description: 'Cancelling one that was raised in error, before it takes effect.',
    href: 'https://docs.flexprice.io/api-reference/credit-notes/void-a-credit-note',
    icon: <BanIcon aria-hidden className="size-4" />,
  },
]

export interface CreditNoteGridProps {
  creditNotes: CreditNote[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: CreditNoteQuery
  onQueryChange: (query: CreditNoteQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onCreditNoteClick?: (creditNote: CreditNote) => void
  onCreate?: () => void
  onClearFilters?: () => void
  locale?: string
}

export function CreditNoteGrid({
  creditNotes,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onCreditNoteClick,
  onCreate,
  onClearFilters,
  locale,
}: CreditNoteGridProps) {
  const columns = useMemo<EntityColumn<CreditNote>[]>(
    () => [
      textColumn<CreditNote>('number', 'Credit memo', (row) => row.number, {
        width: 180,
        hideable: false,
      }),
      textColumn<CreditNote>('customer', 'Customer', (row) => row.customerName, { width: 180 }),
      textColumn<CreditNote>('invoice', 'Invoice number', (row) => row.invoiceNumber, {
        width: 150,
      }),
      dateColumn<CreditNote>('createdAt', 'Date', (row) => row.createdAt, {
        width: 140,
        ...(locale ? { locale } : {}),
      }),
      moneyColumn<CreditNote>('amount', 'Amount', (row) => row.amount, {
        width: 140,
        ...(locale ? { locale } : {}),
      }),
      pillColumn<CreditNote>('status', 'Status', (row) => ({
        label: CREDIT_NOTE_STATUS_LABEL[row.status],
        tone: STATUS_TONE[row.status],
      })),
    ],
    [locale],
  )

  const rowActions = (creditNote: CreditNote): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onCreditNoteClick) {
      actions.push({
        label: 'View credit memo',
        readOnly: true,
        icon: <FileMinusIcon aria-hidden className="size-4" />,
        onSelect: () => onCreditNoteClick(creditNote),
      })
    }
    actions.push({
      label: 'Copy credit memo ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(creditNote.id),
    })
    return actions
  }

  return (
    <EntityList<CreditNote>
      label="Credit memos"
      noun="credit memos"
      rows={creditNotes}
      total={total}
      columns={columns}
      getRowId={(creditNote) => creditNote.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search by number, invoice or customer…"
      filter={statusFilter({
        values: query.statuses,
        choices: STATUS_CHOICES,
        onChange: (statuses) => onQueryChange({ ...query, statuses, page: 1 }),
      })}
      rowActions={rowActions}
      exportFileName="credit-notes"
      {...(onCreate ? { primaryAction: <Button onClick={onCreate}>New credit memo</Button> } : {})}
      {...(onCreditNoteClick ? { onRowClick: onCreditNoteClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.search.length > 0 || query.statuses.length > 0}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No credit memos match these filters"
      empty={{
        scene: 'billing',
        title: 'No credit memos yet',
        description:
          'Credit memos refund or adjust an invoice after it has been issued. Issue one from an invoice and it appears here.',
        guides: GUIDES,
      }}
    />
  )
}

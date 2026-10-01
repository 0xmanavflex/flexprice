import { useMemo } from 'react'
import { CopyIcon, FileMinusIcon, ReceiptIcon } from 'lucide-react'
import {
  CREDIT_NOTE_STATUS_LABEL,
  CREDIT_NOTE_TYPE_LABEL,
  type CreditNote,
  type CreditNoteQuery,
  CreditNoteStatus,
} from '@fp/domain'
import { provenance } from '@ui/provenance'
import {
  type EntityColumn,
  type PillTone,
  dateColumn,
  moneyColumn,
  pillColumn,
  textColumn,
} from '../shared/cells'
import { statusFilter } from '@ui/compositions/FilterBar'
import { EntityList, type EntityGuide, type EntityRowAction } from '../shared/EntityList'

/**
 * The credit note list, on the shared `EntityList`.
 *
 * Read-only here: a credit note is issued against an invoice, so creating one
 * belongs to the invoice, not to this list. Status is a server-side filter on
 * `GET /creditnotes`; the search box narrows the page by number, invoice or
 * customer.
 */
export const CreditNoteGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Credit note columns and status filter over the shared list table.',
})

const STATUS_ALL = 'all'
const STATUS_CHOICES = Object.values(CreditNoteStatus).map((value) => ({
  value,
  label: CREDIT_NOTE_STATUS_LABEL[value],
}))

const STATUS_TONE: Record<CreditNoteStatus, PillTone> = {
  [CreditNoteStatus.Draft]: 'neutral',
  [CreditNoteStatus.Finalized]: 'success',
  [CreditNoteStatus.Voided]: 'neutral',
}

const GUIDES: EntityGuide[] = [
  {
    title: 'Issuing a credit note',
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
  onClearFilters,
  locale,
}: CreditNoteGridProps) {
  const columns = useMemo<EntityColumn<CreditNote>[]>(
    () => [
      textColumn<CreditNote>('number', 'Credit note', (row) => row.number, {
        width: 180,
        hideable: false,
      }),
      moneyColumn<CreditNote>('amount', 'Amount', (row) => row.amount, {
        width: 140,
        ...(locale ? { locale } : {}),
      }),
      pillColumn<CreditNote>('status', 'Status', (row) => ({
        label: CREDIT_NOTE_STATUS_LABEL[row.status],
        tone: STATUS_TONE[row.status],
      })),
      textColumn<CreditNote>(
        'type',
        'Type',
        (row) => (row.type ? CREDIT_NOTE_TYPE_LABEL[row.type] : null),
        {
          width: 120,
        },
      ),
      textColumn<CreditNote>('invoice', 'Invoice', (row) => row.invoiceNumber, { width: 150 }),
      textColumn<CreditNote>('customer', 'Customer', (row) => row.customerName, { width: 180 }),
      dateColumn<CreditNote>('createdAt', 'Created', (row) => row.createdAt, {
        width: 140,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale],
  )

  const statusValue = query.statuses.length === 1 ? (query.statuses[0] ?? STATUS_ALL) : STATUS_ALL

  const rowActions = (creditNote: CreditNote): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onCreditNoteClick) {
      actions.push({
        label: 'View credit note',
        icon: <FileMinusIcon aria-hidden className="size-4" />,
        onSelect: () => onCreditNoteClick(creditNote),
      })
    }
    actions.push({
      label: 'Copy credit note ID',
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(creditNote.id),
    })
    return actions
  }

  return (
    <EntityList<CreditNote>
      label="Credit notes"
      noun="credit notes"
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
      status={{
        value: statusValue,
        ...(query.statuses.length > 1 ? { valueLabel: `${query.statuses.length} selected` } : {}),
        label: 'Status',
        onChange: (value) =>
          onQueryChange({
            ...query,
            statuses: value === STATUS_ALL ? [] : [value as CreditNoteStatus],
            page: 1,
          }),
        options: [
          { value: STATUS_ALL, label: 'All' },
          ...Object.values(CreditNoteStatus).map((value) => ({
            value,
            label: CREDIT_NOTE_STATUS_LABEL[value],
          })),
        ],
      }}
      filter={statusFilter({
        values: query.statuses,
        choices: STATUS_CHOICES,
        onChange: (statuses) => onQueryChange({ ...query, statuses, page: 1 }),
      })}
      rowActions={rowActions}
      exportFileName="credit-notes"
      {...(onCreditNoteClick ? { onRowClick: onCreditNoteClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.search.length > 0 || query.statuses.length > 0}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No credit notes match these filters"
      empty={{
        title: 'No credit notes yet',
        description:
          'Credit notes refund or adjust an invoice after it has been issued. Issue one from an invoice and it appears here.',
        guides: GUIDES,
      }}
    />
  )
}

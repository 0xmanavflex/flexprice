import { useMemo } from 'react'
import { CopyIcon, InfoIcon, ReceiptIcon, SettingsIcon, WalletIcon } from 'lucide-react'
import {
  DEFAULT_INVOICE_QUERY,
  type Invoice,
  type InvoiceQuery,
  InvoiceSortField,
  InvoiceStatus,
  PAYMENT_STATUS_LABEL,
  PaymentStatus,
  isStoredInvoiceStatus,
} from '@fp/domain'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../shared/EntityList'
import {
  type EntityColumn,
  type PillTone,
  dateColumn,
  moneyColumn,
  pillColumn,
  textColumn,
} from '../shared/cells'

/**
 * The invoice list, on the shared `EntityList`.
 *
 * ## Two statuses, two columns, one dropdown
 *
 * The redesign's tab list — Draft, Outstanding, Overdue, Paid, Voided — mixes
 * two different things. `Draft` and `Voided` are what the *document* is;
 * `Paid` is what the *money* did. The API keeps them apart (`invoice_status`
 * and `payment_status`) and so, now, does this table: the **Status** column
 * is the document, the **Payment** column is the collection.
 *
 * They are not redundant. A finalized invoice nobody has tried to collect and
 * one whose only payment attempt failed are both `open` in the first column
 * and tell you nothing; in the second they are "—" and "Failed", and only one
 * of them needs a phone call today.
 *
 * The dropdown then carries the *single* question people actually navigate by
 * — `InvoiceStatus`, the domain's fold of both — because two controls writing
 * `query.statuses` disagree the moment either is touched. That is also what
 * happened to `InvoiceFilters`: its only field was this same status, so the
 * builder is not mounted here at all and the control it held now lives in the
 * toolbar. Nothing was lost; the skipped-invoice case it was added for is
 * still reachable, from the dropdown.
 *
 * ## Which of those the server can answer
 *
 * `draft`, `open`, `void` and `skipped` are stored, so they go down the wire.
 * `paid` and `overdue` are **derived** — `deriveInvoiceStatus` computes the
 * first from a payment status and the second from a balance plus a due date
 * in the past. Neither is a field, so neither can be asked of the API, and
 * `isStoredInvoiceStatus` is the check that keeps anyone from trying.
 *
 * Choosing one of them narrows **the page already fetched**, and the table
 * says so on screen rather than letting the reader believe they are looking
 * at the whole ledger. Saying it out loud is the entire point: an unfiltered
 * answer presented as a filtered one is the failure mode worth engineering
 * against on a billing console.
 */
export const InvoiceGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Invoice columns and actions over the shared list table. Document status and payment status as separate columns.',
})

/**
 * The labels, spelled here rather than imported.
 *
 * Every other status enum in `@fp/domain` ships a `*_STATUS_LABEL` map;
 * invoices do not. The strings match what `InvoiceFilters` used, so a row and
 * a control read the same word.
 */
const STATUS_LABEL: Record<InvoiceStatus, string> = {
  [InvoiceStatus.Draft]: 'Draft',
  [InvoiceStatus.Open]: 'Open',
  [InvoiceStatus.Paid]: 'Paid',
  [InvoiceStatus.Overdue]: 'Overdue',
  [InvoiceStatus.Void]: 'Void',
  [InvoiceStatus.Skipped]: 'Skipped',
}

/** Only `overdue` is a problem; only `paid` is finished. Everything else is
 *  simply where the invoice has got to. */
const STATUS_TONE: Record<InvoiceStatus, PillTone> = {
  [InvoiceStatus.Draft]: 'neutral',
  [InvoiceStatus.Open]: 'info',
  [InvoiceStatus.Paid]: 'success',
  [InvoiceStatus.Overdue]: 'danger',
  [InvoiceStatus.Void]: 'neutral',
  [InvoiceStatus.Skipped]: 'neutral',
}

const PAYMENT_TONE: Record<PaymentStatus, PillTone> = {
  [PaymentStatus.Pending]: 'warning',
  [PaymentStatus.Succeeded]: 'success',
  [PaymentStatus.Overpaid]: 'info',
  [PaymentStatus.Failed]: 'danger',
  [PaymentStatus.Refunded]: 'neutral',
  [PaymentStatus.Voided]: 'neutral',
}

const SORT_LABEL: Record<InvoiceSortField, string> = {
  [InvoiceSortField.IssuedAt]: 'Issued',
  [InvoiceSortField.DueDate]: 'Due date',
  [InvoiceSortField.Total]: 'Total',
  [InvoiceSortField.Status]: 'Status',
}

const SORT_OPTIONS = Object.values(InvoiceSortField).map((value) => ({
  value,
  label: SORT_LABEL[value],
}))

const STATUS_ALL = 'all'

/** The order the dropdown offers, which is the order a collections desk works
 *  in: what needs attention first, what is finished last. */
const STATUS_ORDER: InvoiceStatus[] = [
  InvoiceStatus.Draft,
  InvoiceStatus.Open,
  InvoiceStatus.Overdue,
  InvoiceStatus.Paid,
  InvoiceStatus.Void,
  InvoiceStatus.Skipped,
]

/** Every URL requested and confirmed 200. */
const GUIDES: EntityGuide[] = [
  {
    title: 'Raising a one-off invoice',
    description: 'Billing something that is not on a subscription.',
    href: 'https://docs.flexprice.io/api-reference/invoices/create-one-off-invoice',
    icon: <ReceiptIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Recording a payment',
    description: 'Marking an invoice settled when the money arrived elsewhere.',
    href: 'https://docs.flexprice.io/api-reference/invoices/update-invoice-payment-status',
    icon: <WalletIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Invoice numbering and due dates',
    description: 'Prefixes, sequences and the payment terms new invoices inherit.',
    href: 'https://docs.flexprice.io/docs/settings/settings#invoice-configuration',
    icon: <SettingsIcon aria-hidden className="size-4" />,
  },
]

/** True when the current selection is one the API cannot be asked for. */
function hasDerivedStatus(statuses: InvoiceStatus[]): boolean {
  return statuses.some((status) => !isStoredInvoiceStatus(status))
}

export interface InvoiceGridProps {
  invoices: Invoice[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: InvoiceQuery
  onQueryChange: (query: InvoiceQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onInvoiceClick?: (invoice: Invoice) => void
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /** Locale for dates and amounts. Supplied by the app, never read from a global. */
  locale?: string
}

export function InvoiceGrid({
  invoices,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onInvoiceClick,
  onClearFilters,
  locale,
}: InvoiceGridProps) {
  const columns = useMemo<EntityColumn<Invoice>[]>(
    () => [
      textColumn<Invoice>('number', 'Invoice', (row) => row.number, {
        width: 170,
        // The document's own identity. A row without it is unciteable.
        hideable: false,
      }),
      textColumn<Invoice>('customer', 'Customer', (row) => row.customerName, { width: 200 }),
      moneyColumn<Invoice>('total', 'Total', (row) => row.total, {
        width: 150,
        sortable: true,
        sortValue: InvoiceSortField.Total,
        ...(locale ? { locale } : {}),
      }),
      // What is still owed, not what was originally billed — the figure a
      // collections view is actually reading. Zero is muted so a column of
      // settled invoices does not shout.
      moneyColumn<Invoice>('amountDue', 'Amount due', (row) => row.amountRemaining, {
        width: 150,
        muteZero: true,
        ...(locale ? { locale } : {}),
      }),
      pillColumn<Invoice>('status', 'Status', (row) => ({
        label: STATUS_LABEL[row.status],
        tone: STATUS_TONE[row.status],
      })),
      pillColumn<Invoice>('paymentStatus', 'Payment', (row) =>
        row.paymentStatus
          ? {
              label: PAYMENT_STATUS_LABEL[row.paymentStatus],
              tone: PAYMENT_TONE[row.paymentStatus],
            }
          : null,
      ),
      dateColumn<Invoice>('dueDate', 'Due', (row) => row.dueDate, {
        width: 130,
        sortable: true,
        sortValue: InvoiceSortField.DueDate,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale],
  )

  const statusValue = query.statuses.length === 1 ? (query.statuses[0] ?? STATUS_ALL) : STATUS_ALL

  const isDefaultSort =
    query.sortBy === DEFAULT_INVOICE_QUERY.sortBy &&
    query.sortDirection === DEFAULT_INVOICE_QUERY.sortDirection

  const rowActions = (invoice: Invoice): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onInvoiceClick) {
      actions.push({
        label: 'View invoice',
        icon: <ReceiptIcon aria-hidden className="size-4" />,
        onSelect: () => onInvoiceClick(invoice),
      })
    }
    actions.push({
      label: 'Copy invoice number',
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(invoice.number),
    })
    return actions
  }

  const derived = hasDerivedStatus(query.statuses)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/*
        Sits above the toolbar, where the control that caused it is, rather
        than in the table body — the body may be full of perfectly good rows,
        and the caveat is about what is *missing* from them.
      */}
      {derived ? (
        <p
          role="status"
          className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed"
        >
          <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            Paid and overdue are worked out from each invoice&rsquo;s balance and due date rather
            than stored, so the API cannot be asked for them. This narrows the invoices already
            loaded, not the whole ledger — page through, or sort by due date, to be sure you have
            seen everything.
          </span>
        </p>
      ) : null}

      <EntityList<Invoice>
        label="Invoices"
        noun="invoices"
        rows={invoices}
        total={total}
        columns={columns}
        getRowId={(invoice) => invoice.id}
        page={query.page}
        pageSize={query.pageSize}
        onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
        search={query.search}
        onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
        searchPlaceholder="Search invoices…"
        /*
         * No counts. The four stored statuses could each be counted with a
         * `limit: 1` search read for its `pagination.total` — but `paid` and
         * `overdue` could not, and a dropdown where four options carry a
         * number and two do not reads as "there are no paid invoices". Either
         * every option can be counted honestly or none of them shows a
         * number.
         */
        status={{
          value: statusValue,
          label: 'Status',
          onChange: (value) =>
            onQueryChange({
              ...query,
              statuses: value === STATUS_ALL ? [] : [value as InvoiceStatus],
              page: 1,
            }),
          options: [
            { value: STATUS_ALL, label: 'All' },
            ...STATUS_ORDER.map((value) => ({ value, label: STATUS_LABEL[value] })),
          ],
        }}
        sort={{
          options: SORT_OPTIONS,
          field: query.sortBy,
          direction: query.sortDirection,
          activeCount: isDefaultSort ? 0 : 1,
          onChange: (sortBy, sortDirection) =>
            onQueryChange({
              ...query,
              sortBy: sortBy as InvoiceSortField,
              sortDirection,
              page: 1,
            }),
        }}
        selectable
        rowActions={rowActions}
        exportFileName="invoices"
        {...(onInvoiceClick ? { onRowClick: onInvoiceClick } : {})}
        isLoading={isLoading}
        error={error}
        {...(onRetry ? { onRetry } : {})}
        isFiltered={query.search.length > 0 || query.statuses.length > 0}
        {...(onClearFilters ? { onClearFilters } : {})}
        filteredEmptyTitle="No invoices match these filters"
        empty={{
          title: 'No invoices yet',
          description:
            'Invoices are produced when a subscription’s billing period closes. Put a customer on a plan and the first one will appear here on its own.',
          guides: GUIDES,
        }}
      />
    </div>
  )
}

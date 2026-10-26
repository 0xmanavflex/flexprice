import { integrationColumn, type IntegrationMappings } from '../../shared/integrationColumn'
import { useMemo } from 'react'
import { CopyIcon, InfoIcon, ReceiptIcon, SettingsIcon, WalletIcon, PlusIcon } from '@ui/icons'
import {
  DRAFT_INVOICE_NUMBER_LABEL,
  DEFAULT_INVOICE_QUERY,
  type Invoice,
  type InvoiceQuery,
  InvoiceSortField,
  InvoiceStatus,
  PAYMENT_STATUS_LABEL,
  PaymentStatus,
  isStoredInvoiceStatus,
  INVOICE_FILTERS,
  withFilterOptions,
} from '@fp/domain'
import { granularFilter } from '@ui/compositions/tables/FilterBar'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import {
  type EntityColumn,
  type PillTone,
  dateColumn,
  moneyColumn,
  pillColumn,
  textColumn,
} from '../../shared/cells'

/**
 * The invoice list, on the shared `EntityList`.
 *
 * Invoice date, due date, amounts and payment status lead the default table.
 * Document status is a filter and remains available as an optional column.
 * The API's document and payment states stay distinct in the data model.
 *
 * ## Which of those the server can answer
 *
 * `draft`, `open`, `void` and `skipped` are stored, so they go down the wire.
 * `paid` and `overdue` are **derived**: `deriveInvoiceStatus` computes the
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
  note: 'Invoice columns and actions over the shared list table. Payment status visible; document status available through filtering and optional columns.',
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
  // Open awaits payment (orange); Draft is still being written (info).
  [InvoiceStatus.Draft]: 'info',
  [InvoiceStatus.Open]: 'warning',
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
  [InvoiceSortField.UpdatedAt]: 'Updated',
  [InvoiceSortField.IssuedAt]: 'Issued',
  [InvoiceSortField.DueDate]: 'Due date',
  [InvoiceSortField.Total]: 'Total',
  [InvoiceSortField.Status]: 'Status',
}

const SORT_OPTIONS = Object.values(InvoiceSortField).map((value) => ({
  value,
  label: SORT_LABEL[value],
}))

/** Every URL requested and confirmed 200. */
const GUIDES: EntityGuide[] = [
  {
    title: 'Raising a one-off invoice',
    description: 'Billing something that is not on a contract.',
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

function formatDate(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
}

/** True when the current selection is one the API cannot be asked for. */
function hasDerivedStatus(statuses: InvoiceStatus[]): boolean {
  return statuses.some((status) => !isStoredInvoiceStatus(status))
}

export interface InvoiceGridProps {
  integrationMappings?: IntegrationMappings
  invoices: Invoice[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: InvoiceQuery
  onQueryChange: (query: InvoiceQuery) => void
  /** Choices for the customer filter, keyed by wire field (`customer_id`). */
  filterOptions?: Readonly<Record<string, readonly { value: string; label: string }[]>>
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onInvoiceClick?: (invoice: Invoice) => void
  /** More row-menu items after View and Copy: finalize, void, record payment… chosen per invoice. */
  extraActions?: (invoice: Invoice) => EntityRowAction[]
  onOpenCustomer?: (customerId: string) => void
  onCreate?: () => void
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /**
   * Set when `invoices` is a page-local narrowing of the page fetched (the
   * derived paid/overdue statuses). `total` is then still the server's count
   * of every invoice, and an empty result means "none on this page", never
   * "none in the ledger".
   */
  pageLocal?: { fetchedCount: number } | undefined
  /** A background refetch is updating the rows on screen. */
  isRefreshing?: boolean
  /** The rows belong to the previous page or filter. */
  isProvisional?: boolean
  /** Locale for dates and amounts. Supplied by the app, never read from a global. */
  locale?: string
}

export function InvoiceGrid({
  integrationMappings,
  invoices,
  total,
  query,
  onQueryChange,
  filterOptions,
  isLoading = false,
  error = null,
  onRetry,
  onInvoiceClick,
  extraActions,
  onOpenCustomer,
  onCreate,
  onClearFilters,
  pageLocal,
  isRefreshing = false,
  isProvisional = false,
  locale,
}: InvoiceGridProps) {
  const columns = useMemo<EntityColumn<Invoice>[]>(
    () => [
      textColumn<Invoice>('number', 'Invoice number', (row) => row.number, {
        width: 180,
        // The document's own identity. A row without it is unciteable.
        hideable: false,
        // A draft is numbered when it is finalized.
        placeholder: (row) =>
          row.status === InvoiceStatus.Draft ? DRAFT_INVOICE_NUMBER_LABEL : null,
      }),
      textColumn<Invoice>('customer', 'Customer', (row) => row.customerName, {
        width: 180,
        onOpen: onOpenCustomer ? (row) => onOpenCustomer(row.customerId) : undefined,
      }),
      dateColumn<Invoice>('issuedAt', 'Invoice date', (row) => row.issuedAt, {
        width: 120,
        sortable: true,
        sortValue: InvoiceSortField.IssuedAt,
        ...(locale ? { locale } : {}),
      }),
      dateColumn<Invoice>('dueDate', 'Due date', (row) => row.dueDate, {
        width: 120,
        sortable: true,
        sortValue: InvoiceSortField.DueDate,
        ...(locale ? { locale } : {}),
      }),
      moneyColumn<Invoice>('total', 'Amount', (row) => row.total, {
        width: 120,
        sortable: true,
        sortValue: InvoiceSortField.Total,
        ...(locale ? { locale } : {}),
      }),
      // What is still owed, not what was originally billed: the figure a
      // collections view is actually reading. Zero is muted so a column of
      // settled invoices does not shout.
      moneyColumn<Invoice>('amountDue', 'Amount due', (row) => row.amountRemaining, {
        width: 120,
        muteZero: true,
        ...(locale ? { locale } : {}),
      }),
      pillColumn<Invoice>(
        'status',
        'Status',
        (row) => ({
          label: STATUS_LABEL[row.status],
          tone: STATUS_TONE[row.status],
        }),
        { hiddenByDefault: true },
      ),
      pillColumn<Invoice>('paymentStatus', 'Payment status', (row) =>
        row.paymentStatus
          ? {
              label: PAYMENT_STATUS_LABEL[row.paymentStatus],
              tone: PAYMENT_TONE[row.paymentStatus],
            }
          : null,
      ),
      integrationColumn<Invoice>(integrationMappings, 'invoice'),
      // Off by default and switched on from the `⋯` menu, as in the reference.
      textColumn<Invoice>(
        'period',
        'Period',
        (row) =>
          row.periodStart && row.periodEnd
            ? `${formatDate(row.periodStart, locale)} – ${formatDate(row.periodEnd, locale)}`
            : null,
        { width: 220, muted: true, hiddenByDefault: true },
      ),
    ],
    [locale, onOpenCustomer, integrationMappings],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_INVOICE_QUERY.sortBy &&
    query.sortDirection === DEFAULT_INVOICE_QUERY.sortDirection

  const rowActions = (invoice: Invoice): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onInvoiceClick) {
      actions.push({
        label: 'View invoice',
        readOnly: true,
        icon: <ReceiptIcon aria-hidden className="size-4" />,
        onSelect: () => onInvoiceClick(invoice),
      })
    }
    if (invoice.number) {
      actions.push({
        label: 'Copy invoice number',
        readOnly: true,
        icon: <CopyIcon aria-hidden className="size-4" />,
        onSelect: () => void navigator.clipboard?.writeText(invoice.number),
      })
    }
    if (extraActions) actions.push(...extraActions(invoice))
    return actions
  }

  const derived = hasDerivedStatus(query.statuses)
  const isPageLocal = derived && pageLocal !== undefined

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/*
        Sits above the toolbar, where the control that caused it is, rather
        than in the table body: the body may be full of perfectly good rows,
        and the caveat is about what is *missing* from them.
      */}
      {derived ? (
        <p
          role="status"
          className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed"
        >
          <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            <span className="text-foreground font-medium">Filtered within this page.</span>{' '}
            {pageLocal
              ? `Showing ${invoices.length} of ${pageLocal.fetchedCount} invoices on this page. `
              : ''}
            Paid and overdue are worked out from each invoice&rsquo;s balance and due date rather
            than stored, so the API cannot be asked for them. The count below is every invoice, not
            only matching ones; page through to see the rest.
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
         * `limit: 1` search read for its `pagination.total`: but `paid` and
         * `overdue` could not, and a dropdown where four options carry a
         * number and two do not reads as "there are no paid invoices". Either
         * every option can be counted honestly or none of them shows a
         * number.
         */
        filter={granularFilter({
          specs: withFilterOptions(INVOICE_FILTERS, filterOptions ?? {}),
          filters: query.filters ?? [],
          onChange: (filters) => onQueryChange({ ...query, filters, page: 1 }),
        })}
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
        rowActions={rowActions}
        exportFileName="invoices"
        primaryAction={
          onCreate ? (
            <Button onClick={onCreate}>
              <PlusIcon aria-hidden className="size-4" />
              New invoice
            </Button>
          ) : undefined
        }
        {...(onInvoiceClick ? { onRowClick: onInvoiceClick } : {})}
        isLoading={isLoading}
        error={error}
        {...(onRetry ? { onRetry } : {})}
        isRefreshing={isRefreshing}
        isProvisional={isProvisional}
        isPageLocalFilter={isPageLocal}
        isFiltered={
          query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
        }
        {...(onClearFilters ? { onClearFilters } : {})}
        filteredEmptyTitle={
          isPageLocal ? 'No matching invoices on this page' : 'No invoices match these filters'
        }
        {...(isPageLocal
          ? {
              filteredEmptyDescription:
                'Paid and overdue are filtered within this page only. Other pages may have matches; go to another page, or clear the filter.',
            }
          : {})}
        empty={{
          scene: 'billing',
          title: 'No invoices yet',
          description:
            'Invoices are produced when a contract’s billing period closes. Put a customer on a plan and the first one will appear here on its own.',
          guides: GUIDES,
        }}
      />
    </div>
  )
}

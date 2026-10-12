import { type Money, formatMoney } from '@fp/domain'
import { provenance } from '@ui/provenance'
import { DetailTable, type DetailColumn } from '../../shared/DetailTable'
import { EmDash } from '../../shared/cells'

/**
 * The customers who owe overdue money, on the shared client-side list table.
 *
 * ## Why the rows are not paged by the server
 *
 * There is no tenant-wide "what is overdue" endpoint. The rows are grouped on
 * the client from the finalized invoices the query layer already reads, so the
 * whole set is in memory and `DetailTable` keeps search, sort and paging
 * itself. The page above says how many invoices that read covered.
 *
 * ## What is a dash
 *
 * **Oldest due date** is empty for a customer whose only late invoice is a
 * failed payment with no due date on it. It is a dash, not today.
 */
export const DunningGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/DetailTable'],
  note: 'Customer, overdue invoices, overdue amount, oldest due date and outstanding amount over the shared detail table.',
})

export interface DunningCustomer {
  customerId: string
  customerName: string
  overdueCount: number
  overdue: Money
  /** Null when none of the overdue invoices carries a due date. */
  oldestDueDate: Date | null
  /** Everything the customer has unpaid, overdue or not. */
  outstanding: Money
}

export interface DunningGridProps {
  customers: DunningCustomer[]
  isLoading?: boolean
  onCustomerClick?: (customer: DunningCustomer) => void
  /** Locale for dates and amounts. Supplied by the app, never read from a global. */
  locale?: string
}

export function DunningGrid({
  customers,
  isLoading = false,
  onCustomerClick,
  locale,
}: DunningGridProps) {
  const day = (value: Date | null) =>
    value && !Number.isNaN(value.getTime())
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
      : ''

  const columns: DetailColumn<DunningCustomer>[] = [
    {
      key: 'customer',
      header: 'Customer',
      width: 240,
      sortBy: (row) => row.customerName,
      text: (row) => row.customerName,
      cell: (row) => <span className="truncate font-medium">{row.customerName}</span>,
    },
    {
      key: 'count',
      header: 'Overdue invoices',
      width: 150,
      sortBy: (row) => row.overdueCount,
      text: (row) => String(row.overdueCount),
      cell: (row) => <span className="tabular-nums">{row.overdueCount}</span>,
    },
    {
      key: 'overdue',
      header: 'Overdue amount',
      width: 160,
      sortBy: (row) => Number(row.overdue.amount),
      text: (row) => formatMoney(row.overdue, locale),
      cell: (row) => (
        <span className="text-destructive tabular-nums">{formatMoney(row.overdue, locale)}</span>
      ),
    },
    {
      key: 'oldest',
      header: 'Oldest due date',
      width: 160,
      sortBy: (row) => row.oldestDueDate?.getTime() ?? Number.POSITIVE_INFINITY,
      text: (row) => day(row.oldestDueDate),
      cell: (row) =>
        row.oldestDueDate ? (
          <span className="text-muted-foreground tabular-nums">{day(row.oldestDueDate)}</span>
        ) : (
          <EmDash />
        ),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      width: 160,
      sortBy: (row) => Number(row.outstanding.amount),
      text: (row) => formatMoney(row.outstanding, locale),
      cell: (row) => <span className="tabular-nums">{formatMoney(row.outstanding, locale)}</span>,
    },
  ]

  return (
    <DetailTable<DunningCustomer>
      border
      className="p-0"
      label="Customers with overdue invoices"
      noun="customers"
      rows={customers}
      columns={columns}
      isLoading={isLoading}
      getRowId={(row) => row.customerId}
      {...(onCustomerClick ? { onRowClick: onCustomerClick } : {})}
    />
  )
}

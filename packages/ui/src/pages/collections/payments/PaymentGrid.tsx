import { useMemo } from 'react'
import { BanknoteIcon, CopyIcon, CreditCardIcon, ReceiptIcon } from 'lucide-react'
import {
  DEFAULT_PAYMENT_QUERY,
  PAYMENT_SORT_LABEL,
  PAYMENT_STATUS_LABEL,
  type Payment,
  type PaymentQuery,
  PaymentSortField,
  PaymentStatus,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import {
  type EntityColumn,
  type PillTone,
  EmDash,
  Tag,
  dateColumn,
  idColumn,
  moneyColumn,
  pillColumn,
  textColumn,
} from '../../shared/cells'
import { statusFilter } from '@ui/compositions/tables/FilterBar'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'

/**
 * The payment list, on the shared `EntityList`.
 *
 * ## Customer is not here
 *
 * The redesign asks for it, and it is the column a collections desk would
 * most like. `PaymentResponse` does not carry a customer: not a name, not
 * even a `customer_id`. What it carries is `destination_id` plus
 * `destination_type` — the thing the money was paid *against*, which for
 * every payment this list shows is an invoice. Resolving a name therefore
 * means fetching each row's invoice and reading the customer off that: a
 * join, per row, per page.
 *
 * Omitted rather than dashed, on the rule the billing grids share — a column
 * no row can ever fill is removed, because a column of em dashes reads as
 * "these payments happen to have no customer" rather than "we cannot tell you
 * yet". The **Invoice** column is here instead, and it is the honest version
 * of the same lookup: it is a real field, and it is the thing you would click
 * to find the customer anyway.
 *
 * ## Gateway is here, and was not before
 *
 * `paymentGateway` has been on `PaymentResponse` all along and the read model
 * simply was not asking for it. It is a different fact from **Method**:
 * "card" is what the customer presented, Stripe is who charged it, and a
 * failure you are chasing needs the second to know where to go and look.
 */
export const PaymentGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Payment columns and actions over the shared list table.',
})

const SORT_OPTIONS = Object.values(PaymentSortField).map((value) => ({
  value,
  label: PAYMENT_SORT_LABEL[value],
}))

const STATUS_CHOICES = Object.values(PaymentStatus).map((value) => ({
  value,
  label: PAYMENT_STATUS_LABEL[value],
}))

const STATUS_TONE: Record<PaymentStatus, PillTone> = {
  [PaymentStatus.Pending]: 'warning',
  [PaymentStatus.Succeeded]: 'success',
  [PaymentStatus.Overpaid]: 'info',
  [PaymentStatus.Failed]: 'danger',
  [PaymentStatus.Refunded]: 'neutral',
  [PaymentStatus.Voided]: 'neutral',
}

/**
 * The wire's `CARD`, `ACH_DEBIT` and friends, as words.
 *
 * Title-cased from the enum rather than mapped through a lookup: the set is
 * open — a gateway can report a method this build has never heard of — and a
 * lookup would render the new one blank. Splitting on the underscore is not
 * elegant, but it degrades into something readable instead of into nothing.
 */
function humanise(value: string): string | null {
  if (!value) return null
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Every URL requested and confirmed 200. */
const GUIDES: EntityGuide[] = [
  {
    title: 'Recording a payment',
    description: 'Registering money that arrived, against the invoice it settles.',
    href: 'https://docs.flexprice.io/api-reference/payments/create-payment',
    icon: <BanknoteIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Correcting one',
    description: 'Amending a payment that was recorded against the wrong invoice or amount.',
    href: 'https://docs.flexprice.io/api-reference/payments/update-payment',
    icon: <CreditCardIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Marking an invoice settled',
    description: 'Updating payment status when the money moved outside Flexprice.',
    href: 'https://docs.flexprice.io/api-reference/invoices/update-invoice-payment-status',
    icon: <ReceiptIcon aria-hidden className="size-4" />,
  },
]

export interface PaymentGridProps {
  payments: Payment[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: PaymentQuery
  onQueryChange: (query: PaymentQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onPaymentClick?: (payment: Payment) => void
  onCreate?: () => void
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /** Locale for dates and amounts. Supplied by the app, never read from a global. */
  locale?: string
}

export function PaymentGrid({
  payments,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onPaymentClick,
  onCreate,
  onClearFilters,
  locale,
}: PaymentGridProps) {
  const columns = useMemo<EntityColumn<Payment>[]>(
    () => [
      idColumn<Payment>('id', 'Payment ID', (row) => row.id, {
        width: 200,
        // The only thing that identifies the row at all.
        hideable: false,
      }),
      moneyColumn<Payment>('amount', 'Amount', (row) => row.amount, {
        width: 150,
        ...(locale ? { locale } : {}),
      }),
      pillColumn<Payment>('status', 'Status', (row) => ({
        label: PAYMENT_STATUS_LABEL[row.status],
        tone: STATUS_TONE[row.status],
      })),
      textColumn<Payment>('method', 'Method', (row) => humanise(row.methodType), { width: 130 }),
      {
        id: 'gateway',
        header: 'Gateway',
        cell: (row) => {
          const gateway = humanise(row.gateway)
          return gateway ? <Tag>{gateway}</Tag> : <EmDash />
        },
        text: (row) => humanise(row.gateway) ?? '',
        width: 130,
      },
      idColumn<Payment>('invoice', 'Invoice', (row) => row.invoiceNumber, { width: 160 }),
      // When it was taken, not when it landed: `succeededAt` is null for
      // everything still in flight and for everything that failed, which is
      // exactly the half of this list anyone is looking for.
      dateColumn<Payment>('createdAt', 'Date', (row) => row.createdAt, {
        width: 140,
        sortable: true,
        sortValue: PaymentSortField.CreatedAt,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_PAYMENT_QUERY.sortBy &&
    query.sortDirection === DEFAULT_PAYMENT_QUERY.sortDirection

  const rowActions = (payment: Payment): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onPaymentClick) {
      actions.push({
        label: 'View payment',
        icon: <BanknoteIcon aria-hidden className="size-4" />,
        onSelect: () => onPaymentClick(payment),
      })
    }
    actions.push({
      label: 'Copy payment ID',
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(payment.id),
    })
    return actions
  }

  return (
    <EntityList<Payment>
      label="Payments"
      noun="payments"
      rows={payments}
      total={total}
      columns={columns}
      getRowId={(payment) => payment.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search by invoice number…"
      /*
       * Every real state, not the redesign's five. `Overpaid` and `Voided`
       * are values the domain can hold and rows can arrive in; leaving them
       * out of the dropdown would make those rows visible in the list but
       * unreachable from the control that exists to find them.
       *
       * No counts: `GET /payments` filters neither status nor search, so
       * `fetchPayments` narrows the page it received. There is no per-status
       * server total to read, and counting the rows on screen would be a
       * number about this page dressed up as a number about the ledger.
       */
      filter={statusFilter({
        values: query.statuses,
        choices: STATUS_CHOICES,
        onChange: (statuses) => onQueryChange({ ...query, statuses, page: 1 }),
      })}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({
            ...query,
            sortBy: sortBy as PaymentSortField,
            sortDirection,
            page: 1,
          }),
      }}
      rowActions={rowActions}
      exportFileName="payments"
      {...(onCreate ? { primaryAction: <Button onClick={onCreate}>Record payment</Button> } : {})}
      {...(onPaymentClick ? { onRowClick: onPaymentClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.search.length > 0 || query.statuses.length > 0}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No payments match these filters"
      empty={{
        title: 'No money has moved yet',
        description:
          'A payment is a collection against an invoice — taken by a gateway, or recorded by you when it arrived some other way. Finalize an invoice and the first one can be collected.',
        ...(onCreate ? { actions: <Button onClick={onCreate}>Record payment</Button> } : {}),
        guides: GUIDES,
      }}
    />
  )
}

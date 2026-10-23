import { integrationColumn, type IntegrationMappings } from '../../shared/integrationColumn'
import { useMemo } from 'react'
import { BanknoteIcon, CopyIcon, CreditCardIcon, InfoIcon, ReceiptIcon } from '@ui/icons'
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
 * ## No customer or receipt column
 *
 * `PaymentResponse` carries neither a customer nor a receipt number — only the
 * invoice it was paid against — so the list shows what V1 showed: when, which
 * invoice, how much, how, and the gateway's own reference for the charge.
 *
 * ## Method is the customer's, not the processor's
 *
 * "Card" is what the customer presented; who charged it (Stripe, Razorpay) is
 * `paymentGateway`, still on the payment and its detail page but not a column
 * here.
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
  integrationMappings?: IntegrationMappings
  payments: Payment[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: PaymentQuery
  onQueryChange: (query: PaymentQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  /** A retry is in flight. */
  isRetrying?: boolean
  /** A background refetch is updating the rows on screen. */
  isRefreshing?: boolean
  /** The rows belong to the previous page or filter. */
  isProvisional?: boolean
  onPaymentClick?: (payment: Payment) => void
  onCreate?: () => void
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /** Locale for dates and amounts. Supplied by the app, never read from a global. */
  locale?: string
}

export function PaymentGrid({
  integrationMappings,
  payments,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  isRetrying = false,
  isRefreshing = false,
  isProvisional = false,
  onPaymentClick,
  onCreate,
  onClearFilters,
  locale,
}: PaymentGridProps) {
  const columns = useMemo<EntityColumn<Payment>[]>(
    () => [
      dateColumn<Payment>('date', 'Date', (row) => row.succeededAt ?? row.createdAt, {
        width: 140,
        ...(locale ? { locale } : {}),
      }),
      idColumn<Payment>('invoice', 'Invoice number', (row) => row.invoiceNumber, {
        width: 160,
        hideable: false,
      }),
      moneyColumn<Payment>('amount', 'Amount', (row) => row.amount, {
        width: 150,
        ...(locale ? { locale } : {}),
      }),
      textColumn<Payment>('method', 'Payment method', (row) => humanise(row.methodType), {
        width: 150,
      }),
      pillColumn<Payment>('status', 'Status', (row) => ({
        label: PAYMENT_STATUS_LABEL[row.status],
        tone: STATUS_TONE[row.status],
      })),
      integrationColumn<Payment>(integrationMappings, 'payment', 'Integration'),
      idColumn<Payment>('reference', 'Gateway reference', (row) => row.gatewayPaymentId ?? '', {
        width: 180,
      }),
    ],
    [locale, integrationMappings],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_PAYMENT_QUERY.sortBy &&
    query.sortDirection === DEFAULT_PAYMENT_QUERY.sortDirection

  const rowActions = (payment: Payment): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onPaymentClick) {
      actions.push({
        label: 'View payment',
        readOnly: true,
        icon: <BanknoteIcon aria-hidden className="size-4" />,
        onSelect: () => onPaymentClick(payment),
      })
    }
    actions.push({
      label: 'Copy payment ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(payment.id),
    })
    return actions
  }

  /*
   * `GET /payments` filters neither status nor search, so both narrow only the
   * page that came back. That is true whenever either is set, and it changes
   * what an empty result and the record count mean: "none on this page", and a
   * count of every payment rather than the matching ones.
   */
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {isFiltered ? (
        <p
          role="status"
          className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed"
        >
          <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            <span className="text-foreground font-medium">Filtered within the loaded rows.</span>{' '}
            Showing {payments.length} matching on this page. Search and status are applied to the
            payments already loaded, not asked of the server; the count below is every payment, not
            only matching ones. Page through to see the rest.
          </span>
        </p>
      ) : null}
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
        searchPlaceholder="Search loaded rows by invoice number…"
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
        isRetrying={isRetrying}
        isRefreshing={isRefreshing}
        isProvisional={isProvisional}
        isPageLocalFilter={isFiltered}
        isFiltered={isFiltered}
        {...(onClearFilters ? { onClearFilters } : {})}
        filteredEmptyTitle="No matching payments on this page"
        filteredEmptyDescription="Search and status only narrow the payments loaded on this page. Other pages may have matches; go to another page, or clear the filters."
        empty={{
          scene: 'payments',
          title: 'No money has moved yet',
          description:
            'A payment is a collection against an invoice — taken by a gateway, or recorded by you when it arrived some other way. Finalize an invoice and the first one can be collected.',
          guides: GUIDES,
        }}
      />
    </div>
  )
}

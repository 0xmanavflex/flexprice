import { useMemo } from 'react'
import {
  BookOpenIcon,
  CalendarClockIcon,
  CopyIcon,
  LayersIcon,
  RepeatIcon,
  PlusIcon,
  UploadIcon,
  UserIcon,
  XCircleIcon,
} from '@ui/icons'
import {
  DOCS,
  DEFAULT_SUBSCRIPTION_QUERY,
  isSubscriptionQueryFiltered,
  SUBSCRIPTION_SORT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  type Subscription,
  type SubscriptionQuery,
  SubscriptionSortField,
  SubscriptionStatus,
  SUBSCRIPTION_FILTERS,
  withFilterOptions,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { granularFilter } from '@ui/compositions/tables/FilterBar'
import { EntityList, type EntityGuide, type EntityRowAction } from '../shared/EntityList'
import { type EntityColumn, dateColumn, pillColumn, textColumn } from '../shared/cells'
import { SUBSCRIPTION_STATUS_TONE } from '../shared/statusTones'

/**
 * The subscription list, on the shared `EntityList`.
 *
 * ## MRR is not here
 *
 * The redesign asks for it. There is no MRR field on `SubscriptionResponse`,
 * and a case-insensitive sweep of the whole SDK for `mrr` or `arr` returns
 * nothing at all: the concept does not exist in this API. It also cannot be
 * assembled on the client: a subscription's recurring amount lives across its
 * line items, and `money.ts` refuses arithmetic on principle, because a UI
 * that recomputes a total will eventually disagree with the invoice the
 * customer was actually charged.
 *
 * Omitted rather than dashed, on the rule the billing grids share: an em dash
 * says *this row has no value*, so a column no row can ever fill is removed
 * instead. A permanently blank MRR column would assert that these
 * subscriptions are worth nothing, which is worse than saying nothing.
 *
 * ## "Past due" is not a status
 *
 * The redesign's tab list has one. `SubscriptionStatus` is `active`,
 * `trialing`, `paused`, `cancelled`, `incomplete`: and `subscriptionStatus`
 * on the wire is the same set. Past due is a property of an *invoice*: it is
 * a finalized invoice with a balance and a due date in the past. Offering it
 * here would send a request the API cannot filter, get every subscription
 * back, and show an unfiltered list under a control insisting it was
 * filtered.
 *
 * So the option is dropped, and `Incomplete`: which is real, and was
 * previously unreachable from the toolbar: takes a place in the dropdown
 * instead. Finding past-due accounts is the Invoices list's job, where the
 * concept is genuinely defined.
 */
export const SubscriptionGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Contract columns and actions over the shared list table.',
})

const SORT_OPTIONS = Object.values(SubscriptionSortField).map((value) => ({
  value,
  label: SUBSCRIPTION_SORT_LABEL[value],
}))

/** How each lifecycle state reads at a glance. Only `active` is a success and
 *  only `cancelled` is a dead end; the rest are states you watch, not states
 *  you celebrate or mourn. */
const STATUS_TONE = SUBSCRIPTION_STATUS_TONE

/** Every URL requested and confirmed 200. */
const GUIDES: EntityGuide[] = [
  {
    title: 'Subscribing a customer',
    description: 'Putting someone on a plan, and what the first billing period does.',
    href: DOCS.subscriptionCreate,
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
  {
    title: 'How plans price a contract',
    description: 'Charges, entitlements, and what the customer is actually billed for.',
    href: DOCS.plans,
    icon: <LayersIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Billing period settings',
    description: 'Anchors, proration and when a cycle closes.',
    href: DOCS.subscriptionSettings,
    icon: <CalendarClockIcon aria-hidden className="size-4" />,
  },
]

export interface SubscriptionGridProps {
  subscriptions: Subscription[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: SubscriptionQuery
  onQueryChange: (query: SubscriptionQuery) => void
  isLoading?: boolean
  /**
   * Whether the list is narrowed. Defaults to the query past its Active and
   * Trialing default; the page sets it when that default hides contracts.
   */
  isFiltered?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onSubscriptionClick?: (subscription: Subscription) => void
  /** Choices for the customer and plan filters, keyed by wire field (`customer_id`, `plan_id`). */
  filterOptions?: Readonly<Record<string, readonly { value: string; label: string }[]>>
  onOpenCustomer?: (customerId: string) => void
  onOpenPlan?: (planId: string) => void
  /** Asks to cancel a contract that is still running; the page confirms it. */
  onCancelSubscription?: (subscription: Subscription) => void
  /** The primary create action; renders a "New contract" button beside the filter. */
  onCreate?: () => void
  /** Renders an outline "Upload contract" button beside the create button. */
  onUpload?: () => void
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /** Locale for dates. Supplied by the app, never read from a global. */
  locale?: string
}

export function SubscriptionGrid({
  subscriptions,
  total,
  query,
  onQueryChange,
  isLoading = false,
  isFiltered,
  error = null,
  onRetry,
  onSubscriptionClick,
  filterOptions,
  onOpenCustomer,
  onOpenPlan,
  onCancelSubscription,
  onCreate,
  onUpload,
  onClearFilters,
  locale,
}: SubscriptionGridProps) {
  /**
   * The cycle currently being billed, as one cell.
   *
   * Both ends or nothing: "4 Sep – 4 Oct 2026" is a period, and a lone end
   * date is a renewal date wearing a period's label. When only one end is
   * known the column dashes, because a half-open range is a guess about the
   * other half.
   *
   * The en dash is the range dash, and the two dates are deliberately not
   * abbreviated differently from every other date on the page: `dateStyle:
   * 'medium'` is what `dateColumn` uses, so the column reads as dates rather
   * than as a code.
   */
  const formatPeriod = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
    return (row: Subscription): string | null => {
      const { currentPeriodStart: start, currentPeriodEnd: end } = row
      if (!start || !end) return null
      return `${format.format(start)} – ${format.format(end)}`
    }
  }, [locale])

  const columns = useMemo<EntityColumn<Subscription>[]>(
    () => [
      // Plain text, not links: a click anywhere on the row opens the contract.
      // The customer and the plan are one step away in the row menu.
      textColumn<Subscription>('customer', 'Customer', (row) => row.customerName, {
        width: 220,
        // Who is being billed. Hiding it leaves a list of anonymous plans.
        hideable: false,
      }),
      textColumn<Subscription>('plan', 'Plan', (row) => row.planName, {
        width: 180,
      }),
      textColumn<Subscription>('billing', 'Billing', (row) => row.billingPeriodLabel, {
        width: 120,
      }),
      pillColumn<Subscription>('status', 'Status', (row) => ({
        label: SUBSCRIPTION_STATUS_LABEL[row.status],
        tone: STATUS_TONE[row.status],
      })),
      textColumn<Subscription>('currentPeriod', 'Current period', formatPeriod, {
        width: 220,
        muted: true,
      }),
      dateColumn<Subscription>('startDate', 'Started', (row) => row.startDate, {
        width: 140,
        sortable: true,
        sortValue: SubscriptionSortField.StartDate,
        ...(locale ? { locale } : {}),
      }),
    ],
    [formatPeriod, locale],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_SUBSCRIPTION_QUERY.sortBy &&
    query.sortDirection === DEFAULT_SUBSCRIPTION_QUERY.sortDirection

  const rowActions = (subscription: Subscription): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onSubscriptionClick) {
      actions.push({
        label: 'View contract',
        readOnly: true,
        icon: <RepeatIcon aria-hidden className="size-4" />,
        onSelect: () => onSubscriptionClick(subscription),
      })
    }
    if (onOpenCustomer && subscription.customerId) {
      actions.push({
        label: 'View customer',
        readOnly: true,
        icon: <UserIcon aria-hidden className="size-4" />,
        onSelect: () => onOpenCustomer(subscription.customerId),
      })
    }
    if (onOpenPlan && subscription.planId) {
      actions.push({
        label: 'View plan',
        readOnly: true,
        icon: <LayersIcon aria-hidden className="size-4" />,
        onSelect: () => onOpenPlan(subscription.planId),
      })
    }
    actions.push({
      label: 'Copy contract ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(subscription.id),
    })
    if (onCancelSubscription && subscription.status !== SubscriptionStatus.Cancelled) {
      actions.push({
        label: 'Cancel contract',
        icon: <XCircleIcon aria-hidden className="size-4" />,
        destructive: true,
        onSelect: () => onCancelSubscription(subscription),
      })
    }
    return actions
  }

  return (
    <EntityList<Subscription>
      label="Contracts"
      noun="contracts"
      rows={subscriptions}
      total={total}
      columns={columns}
      getRowId={(subscription) => subscription.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search by customer or plan…"
      /*
       * Status in the dropdown, and not also in a filter builder: two
       * controls writing `query.statuses` disagree on first interaction.
       *
       * No counts: `fetchSubscriptions` narrows status on the page it
       * received rather than pushing it down, so there is no per-status
       * server total to read. `SubscriptionFilter` does carry a
       * `subscription_status` array, so honest counts are available the day
       * the fetch sends it: until then the dropdown shows no number rather
       * than counting the rows it happens to hold.
       */
      filter={granularFilter({
        specs: withFilterOptions(SUBSCRIPTION_FILTERS, filterOptions ?? {}),
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
            sortBy: sortBy as SubscriptionSortField,
            sortDirection,
            page: 1,
          }),
      }}
      rowActions={rowActions}
      exportFileName="subscriptions"
      primaryAction={
        onCreate || onUpload ? (
          <>
            {onUpload ? (
              // Outline: the page's one filled button stays "New contract".
              <Button variant="outline" onClick={onUpload}>
                <UploadIcon aria-hidden className="size-4" />
                Upload contract
              </Button>
            ) : null}
            {onCreate ? (
              <Button onClick={onCreate}>
                <PlusIcon aria-hidden className="size-4" />
                New contract
              </Button>
            ) : null}
          </>
        ) : undefined
      }
      {...(onSubscriptionClick ? { onRowClick: onSubscriptionClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={isFiltered ?? isSubscriptionQueryFiltered(query)}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No contracts match these filters"
      empty={{
        title: 'Nobody is on a plan yet',
        description:
          'A contract puts a customer on a plan and starts their billing cycle. Once one is running, invoices appear on their own as each period closes.',
        guides: GUIDES,
      }}
    />
  )
}

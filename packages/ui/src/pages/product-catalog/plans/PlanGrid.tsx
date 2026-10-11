import { useMemo } from 'react'
import {
  ArchiveIcon,
  BookOpenIcon,
  CopyIcon,
  CopyPlusIcon,
  LayersIcon,
  PencilIcon,
  ReceiptTextIcon,
  SquareStackIcon,
} from '@ui/icons'
import {
  BILLING_PERIOD_SHORT,
  DEFAULT_PLAN_QUERY,
  PLAN_SORT_LABEL,
  PLAN_STATUS_LABEL,
  type Plan,
  type PlanQuery,
  PlanSortField,
  PlanStatus,
} from '@fp/domain'
import { statusFilter } from '@ui/compositions/tables/FilterBar'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import {
  EmDash,
  EntityCell,
  Status,
  Tag,
  type EntityColumn,
  dateColumn,
  idColumn,
} from '../../shared/cells'

/**
 * The plan list, over the shared `EntityList`.
 *
 * Migrated the same way `FeatureGrid` was: the `useTable` call, the
 * `tableLayout`, the toolbar, the footer and the fit-to-window state are gone,
 * because none of them were about plans. What is left is which columns a plan
 * has, what a row's menu offers, and how a `PlanQuery` maps onto the shared
 * table's flat callbacks.
 *
 * **Two of the redesign's columns are not here, deliberately.** `Subscribers`
 * has no field on `PlanWire` — counting one costs a `querySubscription` per
 * row, twenty-five requests to paint a column — and `Trial` has no field at
 * all. The redesign's own gap list names the first; the second turned up
 * checking. A column of em dashes on every row is worse than no column: it
 * takes width and promises a number that never arrives. `Charges` is the count
 * the API can give; the "N fixed, N usage" split the spec asks for needs the
 * price types, which `chargeCount` has already collapsed.
 *
 * Status is in the toolbar's dropdown and *not* in the filter builder, so two
 * controls cannot disagree about `query.statuses`.
 */
export const PlanGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Plan columns and actions over the shared list table.',
})

const SORT_OPTIONS = Object.values(PlanSortField).map((value) => ({
  value,
  label: PLAN_SORT_LABEL[value],
}))

const STATUS_CHOICES = Object.values(PlanStatus).map((value) => ({
  value,
  label: PLAN_STATUS_LABEL[value],
}))

/** Indexed by the raw wire period, which is a plain string on `PlanHeadline`. */
const PERIOD_SHORT: Record<string, string | undefined> = BILLING_PERIOD_SHORT

/**
 * The headline price, as a pricing page writes it — `$29 /mo`.
 *
 * `amount` is the string the API already formatted, never a float this side
 * re-derives (`money.ts` forbids client-side money arithmetic), and `period`
 * is the raw billing enum. An unrecognised period falls back to the bare
 * amount rather than printing the enum at someone.
 */
function headlinePrice(plan: Plan): string | null {
  if (!plan.headline) return null
  const short = PERIOD_SHORT[plan.headline.period]
  return short ? `${plan.headline.amount} /${short}` : plan.headline.amount
}

/**
 * The three cards under the first-run empty state.
 *
 * Every URL was requested and returned 200, and every one appears in
 * `docs.flexprice.io/sitemap.xml`. Worth re-checking when these change: the
 * real site namespaces everything under `/docs/` or `/api-reference/`, and a
 * guessed path like `docs.flexprice.io/plans` 404s. A dead link in an empty
 * state is worse than no link, because the empty state is where someone has
 * already admitted they do not know what to do next.
 */
const GUIDES: EntityGuide[] = [
  {
    title: 'What a plan is',
    description: 'How a plan groups charges into something a customer can subscribe to.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/plans/overview',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Creating your first plan',
    description: 'Name it, price it, and publish it so someone can subscribe.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/plans/create',
    icon: <SquareStackIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Pricing models',
    description: 'Flat fee, package and volume tiers, and when each one fits.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/plans/pricing',
    icon: <ReceiptTextIcon aria-hidden className="size-4" />,
  },
]

export interface PlanGridProps {
  plans: Plan[]
  total: number
  query: PlanQuery
  onQueryChange: (query: PlanQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onPlanClick?: (plan: Plan) => void
  /** The primary create action; renders a "New plan" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Row menu: open the plan's editor. Left out of the menu when absent. */
  onEdit?: ((plan: Plan) => void) | undefined
  /** Row menu: clone the plan. `useClonePlan` backs this. */
  onDuplicate?: ((plan: Plan) => void) | undefined
  /** Row menu: jump to the plan's charges editor. */
  onAddCharges?: ((plan: Plan) => void) | undefined
  /** Row menu: archive the plan. Rendered destructive, under a separator. */
  onArchive?: ((plan: Plan) => void) | undefined
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

export function PlanGrid({
  plans,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onPlanClick,
  onCreate,
  onEdit,
  onDuplicate,
  onAddCharges,
  onArchive,
  onClearFilters,
  locale,
}: PlanGridProps) {
  const columns = useMemo<EntityColumn<Plan>[]>(
    () => [
      {
        id: 'name',
        header: 'Plan',
        width: 240,
        sortable: true,
        sortValue: PlanSortField.Name,
        // The column the list is *for*. Hiding it leaves a table of
        // attributes belonging to nothing.
        hideable: false,
        text: (row) => row.name,
        cell: (row) => <EntityCell name={row.name} />,
        skeleton: <Skeleton className="h-4 w-32" />,
      },
      idColumn<Plan>('lookupKey', 'Lookup key', (row) => row.lookupKey, { width: 180 }),
      {
        id: 'basePrice',
        header: 'Base price',
        width: 150,
        text: (row) => headlinePrice(row) ?? '',
        cell: (row) => {
          if (!row.headline) return <EmDash />
          const short = PERIOD_SHORT[row.headline.period]
          return (
            <span className="tabular-nums">
              {row.headline.amount}
              {short ? <span className="text-muted-foreground"> / {short}</span> : null}
            </span>
          )
        },
        skeleton: <Skeleton className="h-4 w-20" />,
      },
      {
        id: 'charges',
        header: 'Charges',
        width: 130,
        text: (row) => String(row.chargeCount),
        cell: (row) => (
          <Tag>
            {new Intl.NumberFormat(locale).format(row.chargeCount)}{' '}
            {row.chargeCount === 1 ? 'charge' : 'charges'}
          </Tag>
        ),
        skeleton: <Skeleton className="h-6 w-20 rounded-full" />,
      },
      {
        id: 'status',
        header: 'Status',
        width: 130,
        text: (row) => PLAN_STATUS_LABEL[row.status],
        cell: (row) => <Status value={PLAN_STATUS_LABEL[row.status]} />,
        skeleton: <Skeleton className="h-6 w-24 rounded-full" />,
      },
      dateColumn<Plan>('updatedAt', 'Updated', (row) => row.updatedAt, {
        width: 140,
        sortable: true,
        sortValue: PlanSortField.UpdatedAt,
        ...(locale ? { locale } : {}),
      }),
      // Created is real and was on the old grid, but the redesign's default
      // layout does not spend a column on it. Kept one click away in the `⋯`
      // menu rather than dropped, so nothing that existed is lost.
      dateColumn<Plan>('createdAt', 'Created', (row) => row.createdAt, {
        width: 140,
        sortable: true,
        sortValue: PlanSortField.CreatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_PLAN_QUERY.sortBy &&
    query.sortDirection === DEFAULT_PLAN_QUERY.sortDirection

  const rowActions = (plan: Plan): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onPlanClick) {
      actions.push({
        label: 'View plan',
        icon: <LayersIcon aria-hidden className="size-4" />,
        onSelect: () => onPlanClick(plan),
      })
    }
    if (onEdit) {
      actions.push({
        label: 'Edit plan',
        icon: <PencilIcon aria-hidden className="size-4" />,
        onSelect: () => onEdit(plan),
      })
    }
    if (onDuplicate) {
      actions.push({
        label: 'Duplicate plan',
        icon: <CopyPlusIcon aria-hidden className="size-4" />,
        onSelect: () => onDuplicate(plan),
      })
    }
    if (onAddCharges) {
      actions.push({
        label: 'Add charges',
        icon: <ReceiptTextIcon aria-hidden className="size-4" />,
        onSelect: () => onAddCharges(plan),
      })
    }
    actions.push({
      label: 'Copy plan ID',
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(plan.id),
    })
    // Offered only where it would do something: archiving an archived plan is
    // a menu item that reports success and changes nothing.
    if (onArchive && plan.status !== PlanStatus.Archived) {
      actions.push({
        label: 'Archive plan',
        icon: <ArchiveIcon aria-hidden className="size-4" />,
        destructive: true,
        onSelect: () => onArchive(plan),
      })
    }
    return actions
  }

  return (
    <EntityList<Plan>
      label="Plans"
      noun="plans"
      rows={plans}
      total={total}
      columns={columns}
      getRowId={(plan) => plan.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search plans…"
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
          onQueryChange({ ...query, sortBy: sortBy as PlanSortField, sortDirection, page: 1 }),
      }}
      selectable
      rowActions={rowActions}
      exportFileName="plans"
      primaryAction={onCreate ? <Button onClick={onCreate}>New plan</Button> : undefined}
      {...(onPlanClick ? { onRowClick: onPlanClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.search.length > 0 || query.statuses.length > 0}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No plans match these filters"
      empty={{
        title: 'No plans yet',
        description:
          'A plan is what a customer subscribes to — a set of charges sold together under one name. Create one, price it, and it is ready to sell.',
        ...(onCreate ? { actions: <Button onClick={onCreate}>New plan</Button> } : {}),
        guides: GUIDES,
      }}
    />
  )
}

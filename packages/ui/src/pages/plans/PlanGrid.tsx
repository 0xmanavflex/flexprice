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
} from 'lucide-react'
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
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../shared/EntityList'
import {
  type EntityColumn,
  dateColumn,
  idColumn,
  numberColumn,
  pillColumn,
  textColumn,
} from '../shared/cells'

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

/** `all` is a value, not the absence of one — a Select with an empty value
 *  renders its placeholder and reads as unset. */
const STATUS_ALL = 'all'

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

/** Counts per status, from the server. Undefined where not yet known — a
 *  confident "0" that has not been confirmed is worse than no number. */
export interface PlanStatusCounts {
  total?: number | undefined
  published?: number | undefined
  archived?: number | undefined
}

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
  /** Fills the counts beside each status option. */
  statusCounts?: PlanStatusCounts | undefined
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
  statusCounts,
  locale,
}: PlanGridProps) {
  const columns = useMemo<EntityColumn<Plan>[]>(
    () => [
      textColumn<Plan>('name', 'Plan', (row) => row.name, {
        width: 240,
        sortable: true,
        sortValue: PlanSortField.Name,
        // The column the list is *for*. Hiding it leaves a table of
        // attributes belonging to nothing.
        hideable: false,
      }),
      idColumn<Plan>('lookupKey', 'Lookup key', (row) => row.lookupKey, { width: 180 }),
      textColumn<Plan>('basePrice', 'Base price', headlinePrice, { width: 140 }),
      numberColumn<Plan>('charges', 'Charges', (row) => row.chargeCount, {
        width: 110,
        ...(locale ? { locale } : {}),
      }),
      pillColumn<Plan>(
        'status',
        'Status',
        (row) => ({
          label: PLAN_STATUS_LABEL[row.status],
          tone: row.status === PlanStatus.Published ? 'success' : 'neutral',
        }),
        { width: 130 },
      ),
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

  const statusValue = query.statuses.length === 1 ? (query.statuses[0] ?? STATUS_ALL) : STATUS_ALL

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
      status={{
        value: statusValue,
        label: 'Status',
        onChange: (value) =>
          onQueryChange({
            ...query,
            statuses: value === STATUS_ALL ? [] : [value as PlanStatus],
            page: 1,
          }),
        options: [
          {
            value: STATUS_ALL,
            label: 'All',
            ...(statusCounts?.total === undefined ? {} : { count: statusCounts.total }),
          },
          {
            value: PlanStatus.Published,
            label: PLAN_STATUS_LABEL[PlanStatus.Published],
            ...(statusCounts?.published === undefined ? {} : { count: statusCounts.published }),
          },
          {
            value: PlanStatus.Archived,
            label: PLAN_STATUS_LABEL[PlanStatus.Archived],
            ...(statusCounts?.archived === undefined ? {} : { count: statusCounts.archived }),
          },
        ],
      }}
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

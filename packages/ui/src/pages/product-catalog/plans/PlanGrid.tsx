import { useMemo } from 'react'
import {
  ArchiveIcon,
  BookOpenIcon,
  CopyIcon,
  CopyPlusIcon,
  LayersIcon,
  PencilIcon,
  ReceiptTextIcon,
  SparklesIcon,
  SquareStackIcon,
} from '@ui/icons'
import {
  BILLING_PERIOD_SHORT,
  DEFAULT_PLAN_QUERY,
  planKindLabel,
  PLAN_SORT_LABEL,
  PLAN_STATUS_LABEL,
  type Plan,
  type PlanQuery,
  PlanSortField,
  PlanStatus,
  PLAN_FILTERS,
  planKind,
} from '@fp/domain'
import { granularFilter } from '@ui/compositions/tables/FilterBar'
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
 * The counts beside each plan: entitlements, credit grants, contracts: are
 * not on `PlanWire`; `linkage` carries them, read for the rows on screen by
 * `usePlanLinkage`. A figure that could not be read stays blank rather than
 * showing a zero nobody verified.
 *
 * `Trial` from the redesign is still not here: there is no field for it on the
 * plan, and a column of em dashes takes width to promise a number that never
 * arrives.
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

/** Indexed by the raw wire period, which is a plain string on `PlanHeadline`. */
const PERIOD_SHORT: Record<string, string | undefined> = BILLING_PERIOD_SHORT

/**
 * The headline price, as a pricing page writes it: `$29 /mo`.
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

/**
 * What a plan contains, as the grid shows it.
 *
 * Read from elsewhere (entitlements, credit grants, subscriptions) and handed
 * in per plan id, so the grid stays a table and never becomes a data loader.
 * A figure is `undefined` when it could not be read, which is not zero.
 */
export interface PlanLinkage {
  entitlements: number | undefined
  creditGrants: number | undefined
  contracts: number | undefined
}

export interface PlanGridProps {
  plans: Plan[]
  /** Entitlement, credit-grant and contract counts per plan id. */
  linkage?: ReadonlyMap<string, PlanLinkage>
  /** The linkage is still being read; its three columns show a placeholder. */
  linkageLoading?: boolean
  total: number
  query: PlanQuery
  onQueryChange: (query: PlanQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onPlanClick?: (plan: Plan) => void
  /** The primary create action; renders a "New plan" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Opens the describe-your-pricing flow. Left out when it is not wired. */
  onCreateWithAi?: (() => void) | undefined
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
  linkage,
  linkageLoading = false,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onPlanClick,
  onCreate,
  onCreateWithAi,
  onEdit,
  onDuplicate,
  onAddCharges,
  onArchive,
  onClearFilters,
  locale,
}: PlanGridProps) {
  const columns = useMemo<EntityColumn<Plan>[]>(() => {
    /** A count the linkage has not produced: loading, or unreadable. */
    /*
     * A figure, or a dash.
     *
     * Zero reads as a dash, as the redesign has it: a row of noughts across
     * an empty plan is harder to scan past than blanks, and "none" is what
     * the dash means here. Unknown: the linkage could not be read: is the
     * same dash, because the distinction is not one the grid can usefully
     * draw; it is still kept in the data, where `undefined` and `0` stay
     * apart for anything that needs them.
     */
    const count = (value: number | undefined) => {
      if (value === undefined && linkageLoading) return <Skeleton className="h-4 w-8" />
      if (!value) return <EmDash />
      return <span className="tabular-nums">{new Intl.NumberFormat(locale).format(value)}</span>
    }

    /** A linkage column: same cell, same width, different figure. */
    const linkageColumn = (
      id: string,
      header: string,
      of: (entry: PlanLinkage | undefined) => number | undefined,
      width: number,
    ): EntityColumn<Plan> => ({
      id,
      header,
      width,
      align: 'center',
      text: (row) => {
        const value = of(linkage?.get(row.id))
        return value === undefined ? '' : String(value)
      },
      cell: (row) => count(of(linkage?.get(row.id))),
      skeleton: <Skeleton className="h-4 w-8" />,
    })

    return [
      {
        id: 'name',
        header: 'Plan',
        width: 200,
        sortable: true,
        sortValue: PlanSortField.Name,
        // The column the list is *for*. Hiding it leaves a table of
        // attributes belonging to nothing.
        hideable: false,
        text: (row) => row.name,
        cell: (row) => <EntityCell name={row.name} />,
        skeleton: <Skeleton className="h-4 w-32" />,
      },
      {
        // Not stored: the mix of fixed and usage charges is what makes a plan
        // flat-rate, usage-based or hybrid, and it is the first thing someone
        // scanning the list wants to know.
        id: 'kind',
        header: 'Type',
        width: 150,
        text: (row) => planKindLabel(planKind(row), ''),
        cell: (row) => <Tag>{planKindLabel(planKind(row), '')}</Tag>,
        skeleton: <Skeleton className="h-6 w-28 rounded-full" />,
      },
      {
        id: 'charges',
        header: 'Charges',
        width: 110,
        align: 'center',
        text: (row) => String(row.chargeCount),
        cell: (row) => count(row.chargeCount),
        skeleton: <Skeleton className="h-4 w-8" />,
      },
      linkageColumn('entitlements', 'Entitlements', (entry) => entry?.entitlements, 130),
      linkageColumn('creditGrants', 'Credit grants', (entry) => entry?.creditGrants, 130),
      linkageColumn('contracts', 'Contracts', (entry) => entry?.contracts, 120),
      {
        id: 'status',
        header: 'Status',
        width: 110,
        text: (row) => PLAN_STATUS_LABEL[row.status],
        cell: (row) => <Status value={PLAN_STATUS_LABEL[row.status]} />,
        skeleton: <Skeleton className="h-6 w-24 rounded-full" />,
      },
      idColumn<Plan>('lookupKey', 'Lookup key', (row) => row.lookupKey, { width: 170 }),
      // Base price, Updated and Created are real and all three were on the
      // grid before. The redesign's layout does not spend a column on any of
      // them, so they stay one click away in the `⋯` menu rather than being
      // dropped: nothing that existed is lost.
      {
        id: 'basePrice',
        header: 'Base price',
        width: 150,
        hiddenByDefault: true,
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
      dateColumn<Plan>('updatedAt', 'Updated', (row) => row.updatedAt, {
        width: 140,
        sortable: true,
        sortValue: PlanSortField.UpdatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
      dateColumn<Plan>('createdAt', 'Created', (row) => row.createdAt, {
        width: 140,
        sortable: true,
        sortValue: PlanSortField.CreatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
    ]
  }, [linkage, linkageLoading, locale])

  const isDefaultSort =
    query.sortBy === DEFAULT_PLAN_QUERY.sortBy &&
    query.sortDirection === DEFAULT_PLAN_QUERY.sortDirection

  const rowActions = (plan: Plan): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onPlanClick) {
      actions.push({
        label: 'View plan',
        readOnly: true,
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
      readOnly: true,
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
      filter={granularFilter({
        specs: PLAN_FILTERS,
        filters: query.filters ?? [],
        onChange: (filters) => onQueryChange({ ...query, filters, page: 1 }),
      })}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({ ...query, sortBy: sortBy as PlanSortField, sortDirection, page: 1 }),
      }}
      rowActions={rowActions}
      exportFileName="plans"
      primaryAction={
        onCreate || onCreateWithAi ? (
          <>
            {onCreateWithAi ? (
              <Button variant="outline" onClick={onCreateWithAi}>
                <SparklesIcon aria-hidden />
                Create with AI
              </Button>
            ) : null}
            {onCreate ? <Button onClick={onCreate}>New plan</Button> : null}
          </>
        ) : undefined
      }
      {...(onPlanClick ? { onRowClick: onPlanClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={
        query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
      }
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No plans match these filters"
      empty={{
        scene: 'catalog',
        title: 'No plans yet',
        description:
          'A plan is what a customer subscribes to: a set of charges sold together under one name. Create one, price it, and it is ready to sell.',
        guides: GUIDES,
      }}
    />
  )
}

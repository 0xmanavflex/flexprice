import { useMemo } from 'react'
import {
  ArchiveIcon,
  BookOpenIcon,
  CopyIcon,
  PencilIcon,
  TicketPercentIcon,
  PlusIcon,
} from '@ui/icons'
import {
  DOCS,
  COUPON_CADENCE_LABEL,
  COUPON_SORT_LABEL,
  COUPON_STATUS_LABEL,
  type Coupon,
  CouponCadence,
  type CouponQuery,
  CouponSortField,
  CouponStatus,
  DEFAULT_COUPON_QUERY,
  formatMoney,
  COUPON_FILTERS,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { granularFilter } from '@ui/compositions/tables/FilterBar'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import { type EntityColumn, dateColumn, idColumn, pillColumn, textColumn } from '../../shared/cells'

/**
 * The coupon list, over the shared `EntityList`.
 *
 * The one catalogue list whose columns the redesign asked for all exist: a
 * coupon's discount, cadence, redemption ceiling and validity window are all
 * on the read model already. Nothing here is dashed for want of a field.
 *
 * **The "Expired" tab is not here.** `CouponStatus` is `published | archived`;
 * expiry is a date passing, not a status the API stores or can count. It could
 * be derived per row from `redeemBefore`, but then the dropdown would carry a
 * number counted from the twenty-five rows on screen while every other option
 * carries the server's total: two kinds of number in one control, one of them
 * wrong. So the dropdown offers what the server can actually count, and expiry
 * stays visible in the "Valid until" column where a date belongs.
 *
 * Status is in the toolbar's dropdown and *not* in the filter builder, so two
 * controls cannot disagree about `query.statuses`.
 */
export const CouponGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Coupon columns and actions over the shared list table.',
})

const SORT_OPTIONS = Object.values(CouponSortField).map((value) => ({
  value,
  label: COUPON_SORT_LABEL[value],
}))

/**
 * What the coupon takes off: an amount, or a percentage.
 *
 * `formatMoney` rather than any arithmetic here: `money.ts` forbids doing sums
 * on money in the browser, and a discount is exactly the figure someone would
 * be tempted to convert. `percentageOff` arrives as the API's own string
 * (`"10"`, never `0.1`), so it is printed, not scaled.
 */
function discountLabel(coupon: Coupon, locale?: string): string | null {
  if (coupon.amountOff) return formatMoney(coupon.amountOff, locale)
  if (coupon.percentageOff) return `${coupon.percentageOff}%`
  return null
}

/**
 * How long the discount lasts.
 *
 * Only `repeated` reads with a number beside it. The unit is **periods**, not
 * months: the spec's "· N mo" would be asserting a billing cadence the field
 * does not carry, and a quarterly plan's three periods are nine months.
 */
function durationLabel(coupon: Coupon): string {
  const base = COUPON_CADENCE_LABEL[coupon.cadence]
  if (coupon.cadence !== CouponCadence.Repeated || coupon.durationInPeriods === null) return base
  const periods = coupon.durationInPeriods
  return `${base} · ${periods} ${periods === 1 ? 'period' : 'periods'}`
}

/** Used against the ceiling. A null ceiling is unlimited, said out loud:
 *  a blank there would read as a redemption cap that failed to load. */
function redemptionsLabel(coupon: Coupon, locale?: string): string {
  const format = (value: number) => new Intl.NumberFormat(locale).format(value)
  const used = format(coupon.totalRedemptions)
  return coupon.maxRedemptions === null
    ? `${used} / Unlimited`
    : `${used} / ${format(coupon.maxRedemptions)}`
}

/** Every URL requested and returned 200; all three are in the docs sitemap. */
const GUIDES: EntityGuide[] = [
  {
    title: 'What a coupon is',
    description: 'Fixed amounts and percentages, and how a discount is redeemed.',
    href: DOCS.coupons,
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Creating a coupon',
    description: 'Set the discount, the cadence and the redemption window.',
    href: DOCS.couponCreate,
    icon: <TicketPercentIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Applying a discount',
    description: 'Put a coupon on a contract and see it on the next invoice.',
    href: DOCS.couponOnSubscription,
    icon: <PencilIcon aria-hidden className="size-4" />,
  },
]

export interface CouponGridProps {
  coupons: Coupon[]
  total: number
  query: CouponQuery
  onQueryChange: (query: CouponQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onCouponClick?: (coupon: Coupon) => void
  /** The primary create action; renders a "New coupon" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Row menu: rename the coupon: the one field the API will take. */
  onEdit?: ((coupon: Coupon) => void) | undefined
  /** Row menu: archive the coupon. Rendered destructive, under a separator. */
  onArchive?: ((coupon: Coupon) => void) | undefined
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

export function CouponGrid({
  coupons,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onCouponClick,
  onCreate,
  onEdit,
  onArchive,
  onClearFilters,
  locale,
}: CouponGridProps) {
  const columns = useMemo<EntityColumn<Coupon>[]>(
    () => [
      textColumn<Coupon>('name', 'Coupon', (row) => row.name, {
        width: 220,
        sortable: true,
        sortValue: CouponSortField.Name,
        hideable: false,
      }),
      idColumn<Coupon>('code', 'Code', (row) => row.code, { width: 150 }),
      textColumn<Coupon>('discount', 'Discount', (row) => discountLabel(row, locale), {
        width: 130,
      }),
      textColumn<Coupon>('duration', 'Duration', durationLabel, { width: 180 }),
      textColumn<Coupon>('redemptions', 'Redemptions', (row) => redemptionsLabel(row, locale), {
        width: 140,
      }),
      dateColumn<Coupon>('redeemBefore', 'Valid until', (row) => row.redeemBefore, {
        width: 140,
        storedDay: true,
        ...(locale ? { locale } : {}),
      }),
      pillColumn<Coupon>(
        'status',
        'Status',
        (row) => ({
          label: COUPON_STATUS_LABEL[row.status],
          tone: row.status === CouponStatus.Published ? 'success' : 'neutral',
        }),
        { width: 130 },
      ),
      // Real, and on the old grid, but not in the redesign's default layout.
      // One click away in the `⋯` menu rather than dropped.
      dateColumn<Coupon>('updatedAt', 'Updated', (row) => row.updatedAt, {
        width: 140,
        sortable: true,
        sortValue: CouponSortField.UpdatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_COUPON_QUERY.sortBy &&
    query.sortDirection === DEFAULT_COUPON_QUERY.sortDirection

  const rowActions = (coupon: Coupon): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onCouponClick) {
      actions.push({
        label: 'View coupon',
        readOnly: true,
        icon: <TicketPercentIcon aria-hidden className="size-4" />,
        onSelect: () => onCouponClick(coupon),
      })
    }
    if (onEdit) {
      actions.push({
        label: 'Rename coupon',
        icon: <PencilIcon aria-hidden className="size-4" />,
        onSelect: () => onEdit(coupon),
      })
    }
    actions.push({
      label: 'Copy coupon ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(coupon.id),
    })
    if (onArchive && coupon.status !== CouponStatus.Archived) {
      actions.push({
        label: 'Archive coupon',
        icon: <ArchiveIcon aria-hidden className="size-4" />,
        destructive: true,
        onSelect: () => onArchive(coupon),
      })
    }
    return actions
  }

  return (
    <EntityList<Coupon>
      label="Coupons"
      noun="coupons"
      rows={coupons}
      total={total}
      columns={columns}
      getRowId={(coupon) => coupon.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search coupons…"
      filter={granularFilter({
        specs: COUPON_FILTERS,
        filters: query.filters ?? [],
        onChange: (filters) => onQueryChange({ ...query, filters, page: 1 }),
      })}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({ ...query, sortBy: sortBy as CouponSortField, sortDirection, page: 1 }),
      }}
      rowActions={rowActions}
      exportFileName="coupons"
      primaryAction={
        onCreate ? (
          <Button onClick={onCreate}>
            <PlusIcon aria-hidden />
            New coupon
          </Button>
        ) : undefined
      }
      {...(onCouponClick ? { onRowClick: onCouponClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={
        query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
      }
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No coupons match these filters"
      empty={{
        scene: 'settings',
        title: 'No coupons yet',
        description:
          'A coupon takes an amount or a percentage off a contract: once, for a few periods, or forever. Create one and apply it at checkout or on an existing contract.',
        guides: GUIDES,
      }}
    />
  )
}

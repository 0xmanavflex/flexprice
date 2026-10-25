import { useMemo } from 'react'
import { BookOpenIcon, CopyIcon, RefreshCwIcon, WaypointsIcon } from '@ui/icons'
import {
  USAGE_SYNC_STATE,
  USAGE_SYNC_STATE_LABEL,
  type UsageSync,
  type UsageSyncQuery,
} from '@fp/domain'
import { singleChoiceFilter } from '@ui/compositions/tables/FilterBar'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import {
  type EntityColumn,
  idColumn,
  moneyColumn,
  pillColumn,
  textColumn,
} from '../../shared/cells'
import { providerLabel } from './usageSyncProviders'

/**
 * The Usage Syncs list, on the shared `EntityList`.
 *
 * Read-only: a row is one customer's usage on one subscription for one billing
 * period, and the interesting column is **Synced**: which marketplaces
 * received it. The status filter is a server-side filter on
 * `POST /usage-records/search`; search narrows the page by customer,
 * subscription or plan id.
 *
 * Customer and plan *names* are not here. The record carries ids only, so a
 * name would be a lookup per row; the external customer id is what a
 * marketplace reconciliation is done against anyway.
 */
export const UsageSyncGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Usage record columns and sync-state filter over the shared list table.',
})

const GUIDES: EntityGuide[] = [
  {
    title: 'Marketplace metering',
    description: 'How usage is reported to a cloud marketplace each billing period.',
    href: 'https://docs.flexprice.io/docs/overview',
    icon: <WaypointsIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Connecting a marketplace',
    description: 'Adding the connection that usage syncs report through.',
    href: 'https://docs.flexprice.io/docs/overview',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
]

function formatPeriod(start: Date | null, end: Date | null, locale?: string): string | null {
  if (!start && !end) return null
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  return `${start ? format.format(start) : '…'} – ${end ? format.format(end) : '…'}`
}

export interface UsageSyncGridProps {
  usageSyncs: UsageSync[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: UsageSyncQuery
  onQueryChange: (query: UsageSyncQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onRefresh?: () => void
  /** Opens the record's sync entries. Also wired to the row's "View syncs" action. */
  onUsageSyncClick?: (usageSync: UsageSync) => void
  onClearFilters?: () => void
  locale?: string
}

export function UsageSyncGrid({
  usageSyncs,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onRefresh,
  onUsageSyncClick,
  onClearFilters,
  locale,
}: UsageSyncGridProps) {
  const columns = useMemo<EntityColumn<UsageSync>[]>(
    () => [
      idColumn<UsageSync>(
        'customer',
        'Customer',
        (row) => row.customerExternalId || row.customerId,
        { width: 200, hideable: false },
      ),
      idColumn<UsageSync>('subscription', 'Contract', (row) => row.subscriptionId, {
        width: 200,
      }),
      idColumn<UsageSync>('plan', 'Plan', (row) => row.planId, { width: 180 }),
      moneyColumn<UsageSync>('amount', 'Amount', (row) => row.amount, {
        width: 130,
        ...(locale ? { locale } : {}),
      }),
      textColumn<UsageSync>(
        'period',
        'Period',
        (row) => formatPeriod(row.periodStart, row.periodEnd, locale),
        { width: 240, muted: true },
      ),
      pillColumn<UsageSync>(
        'syncs',
        'Synced to',
        (row) => {
          if (row.syncs.length === 0) return { label: 'Not synced', tone: 'neutral' }
          const labels = row.syncs.map((entry) => providerLabel(entry.provider))
          const allSkipped = row.syncs.every((entry) => entry.skipped)
          return {
            label: labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : (labels[0] ?? ''),
            tone: allSkipped ? 'warning' : 'success',
          }
        },
        { width: 220 },
      ),
    ],
    [locale],
  )

  const rowActions = (row: UsageSync): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onUsageSyncClick) {
      actions.push({
        label: 'View syncs',
        readOnly: true,
        icon: <WaypointsIcon aria-hidden className="size-4" />,
        onSelect: () => onUsageSyncClick(row),
      })
    }
    actions.push({
      label: 'Copy record ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(row.id),
    })
    return actions
  }

  return (
    <EntityList<UsageSync>
      primaryActionReadOnly
      label="Usage Syncs"
      noun="usage syncs"
      rows={usageSyncs}
      total={total}
      columns={columns}
      getRowId={(row) => row.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search by customer, contract or plan…"
      filter={singleChoiceFilter({
        id: 'state',
        label: 'Sync',
        value: query.state,
        empty: USAGE_SYNC_STATE.All,
        choices: Object.values(USAGE_SYNC_STATE).map((value) => ({
          value,
          label: USAGE_SYNC_STATE_LABEL[value],
        })),
        onChange: (state) => onQueryChange({ ...query, state, page: 1 }),
      })}
      rowActions={rowActions}
      exportFileName="usage-syncs"
      {...(onRefresh
        ? {
            primaryAction: (
              <Button variant="outline" onClick={onRefresh}>
                <RefreshCwIcon aria-hidden />
                Refresh
              </Button>
            ),
          }
        : {})}
      {...(onUsageSyncClick ? { onRowClick: onUsageSyncClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.search.length > 0 || query.state !== 'all'}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No usage syncs match these filters"
      empty={{
        scene: 'developers',
        title: 'No usage has been recorded yet',
        description:
          'Usage that bills through a cloud marketplace is recorded per billing period, and where it was reported shows here.',
        guides: GUIDES,
      }}
    />
  )
}

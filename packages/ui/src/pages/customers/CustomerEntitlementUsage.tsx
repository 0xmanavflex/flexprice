import { Progress } from '@ui/components/primitives/progress'
import { SubTabState } from '@ui/compositions/detail/SubTabState'
import { Section } from '@ui/compositions/layout/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { DetailTable } from '../shared/DetailTable'

export const CustomerEntitlementUsageProvenance = provenance({
  source: 'composition',
  composes: ['compositions/detail/SubTabState', 'pages/shared/DetailTable'],
  note: "A customer's entitlement usage on the Analytics tab: one table row per entitled feature, as V1's usage table reads it.",
})

/** One entitled feature's quota for the customer this period. */
export interface CustomerEntitlementUsageRow {
  id: string
  name: string
  /** `metered`, `static`, `boolean`, `config`. Only a metered feature has usage. */
  type: string
  /** Undefined when the API sent something unreadable — a dash, not a zero. */
  used: number | undefined
  /** Null when unlimited. */
  limit: number | null
  isEnabled: boolean
  resetsOn: Date | null
}

export interface CustomerEntitlementUsageProps {
  rows: CustomerEntitlementUsageRow[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  locale?: string
}

const NOTHING = '—'

/**
 * The customer's entitlements as a table, in V1's columns the data carries:
 * the feature, what it grants, and how much of it is used. Source, mode and
 * measure are not on `TenantFeatureUsage`, so they are not drawn.
 */
export function CustomerEntitlementUsage({
  rows,
  isLoading = false,
  error = null,
  onRetry,
  locale,
}: CustomerEntitlementUsageProps) {
  const count = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      value,
    )
  const metered = (row: CustomerEntitlementUsageRow) => row.type === 'metered'

  return (
    <Section table showTitle title="Usage">
      <SubTabState
        hasData={rows.length > 0}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        columns={4}
        loadingLabel="Loading usage"
        empty={{
          scene: 'customers',
          title: 'No entitlements yet',
          description: 'Quotas appear here once this customer is on a plan that grants a feature.',
        }}
      >
        <DetailTable<CustomerEntitlementUsageRow>
          compact
          label="Entitlement usage"
          noun="features"
          rows={rows}
          columns={[
            {
              key: 'feature',
              header: 'Feature',
              sortBy: (row) => row.name,
              text: (row) => row.name,
              cell: (row) => <span className="truncate font-medium">{row.name}</span>,
            },
            {
              key: 'value',
              header: 'Value',
              text: (row) => valueOf(row, count),
              cell: (row) => <span className="tabular-nums">{valueOf(row, count)}</span>,
            },
            {
              key: 'usage',
              header: 'Usage',
              width: 260,
              cell: (row) =>
                metered(row) ? (
                  <UsageCell row={row} format={count} />
                ) : (
                  <span className="text-muted-foreground">{NOTHING}</span>
                ),
            },
            {
              key: 'resets',
              header: 'Resets on',
              sortBy: (row) => row.resetsOn?.getTime() ?? 0,
              cell: (row) => (
                <span className="text-muted-foreground tabular-nums">
                  {row.resetsOn && !Number.isNaN(row.resetsOn.getTime())
                    ? date(row.resetsOn)
                    : NOTHING}
                </span>
              ),
            },
          ]}
        />
      </SubTabState>
    </Section>
  )
}

/** What the entitlement grants, per V1: a limit, unlimited, or on/off. */
function valueOf(row: CustomerEntitlementUsageRow, format: (n: number) => string) {
  if (row.type === 'boolean') return row.isEnabled ? 'Enabled' : 'Disabled'
  if (row.type !== 'metered') return NOTHING
  return row.limit === null ? 'Unlimited' : format(row.limit)
}

/** `used / limit` over a bar; an unlimited quota has no denominator, so no fill. */
function UsageCell({
  row,
  format,
}: {
  row: CustomerEntitlementUsageRow
  format: (n: number) => string
}) {
  const used = row.used
  const limit = row.limit
  const reading =
    used === undefined
      ? NOTHING
      : limit === null
        ? `${format(used)} / Unlimited`
        : `${format(used)} / ${format(limit)}`
  const percent =
    used === undefined || limit === null || limit <= 0 ? 0 : Math.min(100, (used / limit) * 100)
  const over = used !== undefined && limit !== null && used > limit

  return (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span className={cn('text-xs tabular-nums', over && 'text-destructive')}>{reading}</span>
      <Progress
        value={percent}
        aria-label={`${row.name}: ${reading}`}
        className={cn(
          'block gap-0 **:data-[slot=progress-track]:h-1.5',
          over && '**:data-[slot=progress-indicator]:bg-destructive',
        )}
      />
    </span>
  )
}

import {
  BILLING_PERIOD_LABEL,
  type BillingPeriod,
  type EntitlementUsageSource as UsageSourceModel,
  type SubscriptionEntitlement,
  type TenantFeatureUsage,
} from '@fp/domain'
import { provenance } from '@ui/provenance'
import { Button } from '@ui/components/primitives/button'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/primitives/popover'
import { DetailTable } from './DetailTable'
import { EmDash, EntityLink } from './cells'
import { UsageMeter } from './UsageMeter'

/**
 * Entitlements with how much of each has been used.
 *
 * V1 showed this on the customer overview as one table: feature, the plan or
 * contract that grants it, its value, and a usage bar: and V2 had dropped it.
 * The same table now serves the customer overview and a contract's
 * Entitlements section, so the two cannot drift: a contract simply passes no
 * sources, because it is the source.
 *
 * The usage cell is `UsageMeter`, the kit's meter for exactly this reading
 * (unlimited, over-limit and zero-allowance already handled), with its label
 * kept for screen readers only since the row names the feature. What is added
 * around it is what a meter does not know: whether the limit is soft and when
 * the allowance resets.
 */
export const EntitlementUsageProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/shared/UsageMeter',
    'pages/shared/DetailTable',
    'pages/shared/cells',
    'ui/button',
    'ui/popover',
  ],
  note: "V1's customer entitlements table (Feature, Source, Value, Usage) on the shared detail table, so filter and sort sit in the section header.",
})

export interface EntitlementUsageProps {
  /** The feature's name: the meter's accessible name. */
  feature: string
  /** Used so far this period. `undefined` when nothing reported it, which renders a dash. */
  used: number | undefined
  /** `null` is unlimited: not zero, and not infinity. */
  limit: number | null
  /** The plural unit, folded into the reading: "calls", "tokens". */
  unit?: string | undefined
  /** A soft limit bills the excess; a hard one blocks it. */
  softLimit?: boolean | undefined
  /** When the allowance next resets. Absent for one that never does. */
  resetsOn?: Date | null | undefined
  locale?: string | undefined
}

/** One entitlement's usage: the reading, the bar, and when it resets. */
export function EntitlementUsage({
  feature,
  used,
  limit,
  unit,
  softLimit = false,
  resetsOn,
  locale,
}: EntitlementUsageProps) {
  if (used === undefined) return <EmDash />

  const resets =
    resetsOn && !Number.isNaN(resetsOn.getTime())
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
          resetsOn,
        )
      : null
  const caption = [softLimit && limit !== null ? 'Soft limit' : null, resets && `Resets ${resets}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex min-w-0 flex-col gap-1.5 py-1">
      <UsageMeter
        hideLabel
        label={feature}
        used={used}
        limit={limit}
        locale={locale ?? 'en-US'}
        {...(unit ? { unit } : {})}
      />
      {caption ? <p className="text-muted-foreground text-xs">{caption}</p> : null}
    </div>
  )
}

/** What grants an entitlement: a plan, an add-on, a contract. */
export interface EntitlementSourceLink {
  label: string
  /** Opens it. Omitted, the name is plain text. */
  onOpen?: (() => void) | undefined
}

/** One row of the table. */
export interface EntitlementUsageRow {
  id: string
  feature: string
  /** `metered`, `boolean`, `static`, `config`. Unknown is read as metered. */
  featureType?: string | undefined
  enabled: boolean
  /** `null` is unlimited. */
  limit: number | null
  unit?: string | undefined
  softLimit?: boolean | undefined
  /** "Monthly"; `''` or omitted for an allowance that never resets. */
  resetPeriodLabel?: string | undefined
  /** A static entitlement's value. */
  staticValue?: string | undefined
  /** Used this period; omitted when the usage read has not reported it. */
  used?: number | undefined
  resetsOn?: Date | null | undefined
  /** Omit the column entirely by passing no row any sources. */
  sources?: EntitlementSourceLink[] | undefined
}

export interface EntitlementUsageTableProps {
  rows: EntitlementUsageRow[]
  locale?: string | undefined
}

const measured = (row: EntitlementUsageRow) =>
  row.featureType === undefined || row.featureType === '' || row.featureType === 'metered'

/** What the entitlement grants, in words: V1's "Value" column. */
export function entitlementValue(row: EntitlementUsageRow, locale?: string): string {
  if (!row.enabled) return 'Not included'
  if (row.featureType === 'boolean') return 'Included'
  if (row.featureType === 'static' || row.featureType === 'config') return row.staticValue || '—'
  if (row.limit === null) return 'Unlimited'
  const amount = new Intl.NumberFormat(locale ?? 'en-US').format(row.limit)
  return `${amount}${row.softLimit ? ' (soft)' : ''}${
    row.resetPeriodLabel ? ` / ${row.resetPeriodLabel.toLowerCase()}` : ''
  }`
}

function SourceName({ source }: { source: EntitlementSourceLink }) {
  return source.onOpen ? (
    <EntityLink label={source.label} onOpen={source.onOpen} />
  ) : (
    <span className="truncate">{source.label}</span>
  )
}

/**
 * The first source, then "+N": hovering or pressing it lists every source,
 * each one a link to where the grant comes from.
 */
function Sources({ sources }: { sources: EntitlementSourceLink[] }) {
  const [first, ...rest] = sources
  if (!first) return <EmDash />
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <SourceName source={first} />
      {rest.length > 0 ? (
        <Popover>
          <PopoverTrigger
            openOnHover
            delay={150}
            render={
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="h-5 shrink-0 px-1.5 text-xs"
                aria-label={`${sources.length} sources`}
                onClick={(event) => event.stopPropagation()}
              />
            }
          >
            +{rest.length}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <p className="text-muted-foreground px-1 pb-1.5 text-xs">Granted by</p>
            <ul className="flex flex-col gap-1">
              {sources.map((source, index) => (
                <li key={`${source.label}-${index}`} className="px-1 text-sm">
                  <SourceName source={source} />
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  )
}

/** The entitlements table: Feature, Source (when known), Value, Usage. */
export function EntitlementUsageTable({ rows, locale }: EntitlementUsageTableProps) {
  const withSources = rows.some((row) => (row.sources?.length ?? 0) > 0)

  return (
    <DetailTable<EntitlementUsageRow>
      compact
      toolbar
      label="Entitlements"
      noun="features"
      rows={rows}
      getRowId={(row) => row.id}
      columns={[
        {
          key: 'feature',
          header: 'Feature',
          sortBy: (row) => row.feature,
          text: (row) => row.feature,
          cell: (row) => <span className="truncate font-medium">{row.feature}</span>,
        },
        ...(withSources
          ? [
              {
                key: 'source',
                header: 'Source',
                sortBy: (row: EntitlementUsageRow) => row.sources?.[0]?.label ?? '',
                text: (row: EntitlementUsageRow) =>
                  (row.sources ?? []).map((source) => source.label).join(', '),
                cell: (row: EntitlementUsageRow) => <Sources sources={row.sources ?? []} />,
              },
            ]
          : []),
        {
          key: 'value',
          header: 'Value',
          sortBy: (row) => entitlementValue(row, locale),
          text: (row) => entitlementValue(row, locale),
          cell: (row) => (
            <span className="text-muted-foreground">{entitlementValue(row, locale)}</span>
          ),
        },
        {
          key: 'resets',
          header: 'Resets',
          sortBy: (row) => row.resetsOn?.getTime() ?? 0,
          text: (row) =>
            row.resetsOn && !Number.isNaN(row.resetsOn.getTime())
              ? new Intl.DateTimeFormat(locale, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(row.resetsOn)
              : '',
          cell: (row) => {
            const resets = row.resetsOn
            if (!resets || Number.isNaN(resets.getTime())) return <EmDash />
            return (
              <span className="text-muted-foreground tabular-nums">
                {new Intl.DateTimeFormat(locale, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(resets)}
              </span>
            )
          },
        },
        {
          key: 'usage',
          header: 'Usage',
          width: 260,
          sortBy: (row) => row.used ?? -1,
          cell: (row) =>
            row.enabled && measured(row) ? (
              <EntitlementUsage
                feature={row.feature}
                used={row.used}
                limit={row.limit}
                unit={row.unit}
                softLimit={row.softLimit}
                locale={locale}
              />
            ) : (
              <EmDash />
            ),
        },
      ]}
    />
  )
}

/**
 * A decimal string the API sent, as a count for display.
 *
 * These are counts: events, seats, calls: not money, so reading them as
 * numbers is display formatting. `undefined` for anything unparseable, which
 * renders as a dash rather than a zero.
 */
function toCount(value: string): number | undefined {
  if (value === '') return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function periodLabel(period: string): string {
  if (!period || period === 'NEVER') return ''
  return BILLING_PERIOD_LABEL[period as BillingPeriod] ?? period
}

/** The usage half of a row, from one `GET /customers/usage` feature. */
function usageFields(usage: TenantFeatureUsage) {
  return {
    featureType: usage.featureType,
    unit: usage.unit,
    used: toCount(usage.currentUsage),
    resetsOn: usage.nextUsageResetAt,
  }
}

/**
 * A customer's entitlements, from `GET /customers/usage`, as table rows.
 *
 * `onOpenSource` decides what a source name opens: a plan, a contract: and
 * returns `undefined` to leave it as text.
 */
export function entitlementRowsFromUsage(
  features: TenantFeatureUsage[],
  onOpenSource?: (source: UsageSourceModel) => (() => void) | undefined,
): EntitlementUsageRow[] {
  return features.map((usage) => {
    const [first] = usage.sources
    return {
      id: usage.featureId || usage.featureName,
      feature: usage.featureName || usage.featureId || 'Feature',
      enabled: usage.isEnabled,
      limit: usage.isUnlimited ? null : usage.limit,
      softLimit: usage.isSoftLimit,
      resetPeriodLabel: periodLabel(first?.usageResetPeriod ?? ''),
      staticValue: first?.staticValue ?? '',
      ...usageFields(usage),
      sources: usage.sources.map((source) => ({
        label: source.entityName || source.entityId || source.subscriptionId,
        onOpen: onOpenSource?.(source),
      })),
    }
  })
}

/**
 * A contract's entitlements, with the usage `GET /customers/usage` reports for
 * them when it has arrived. A feature it has not reported keeps its limit and
 * shows a dash for usage.
 */
export function entitlementRowsForContract(
  entitlements: SubscriptionEntitlement[],
  usage: TenantFeatureUsage[] | undefined,
): EntitlementUsageRow[] {
  const byFeature = new Map((usage ?? []).map((row) => [row.featureId, row]))
  return entitlements.map((entitlement) => {
    const reported = byFeature.get(entitlement.featureId)
    return {
      id: entitlement.featureId || entitlement.name,
      feature: entitlement.name,
      enabled: entitlement.enabled,
      limit: entitlement.usageLimit,
      softLimit: entitlement.softLimit,
      resetPeriodLabel: entitlement.resetPeriodLabel,
      ...(reported
        ? { ...usageFields(reported), staticValue: reported.sources[0]?.staticValue ?? '' }
        : {}),
    }
  })
}

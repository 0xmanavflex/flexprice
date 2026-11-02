import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts'
import { CalendarIcon, ChevronDownIcon, InfoIcon, LayersIcon } from '@ui/icons'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/primitives/popover'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Switch } from '@ui/components/primitives/switch'
import { SegmentMeter, TotalRow, TotalsList } from '@ui/compositions/detail/DetailKit'
import { DayCalendar } from '@ui/compositions/forms/DateInput'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import { ErrorState } from '@ui/compositions/feedback/States'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@ui/components/primitives/chart'
import type { ChartConfig } from '@ui/components/primitives/chart'
import { ChartSkeleton } from '@ui/compositions/feedback/Skeletons'
import { toneColor, type MetricPoint } from '../shared/charts'
import { DetailTable } from '../shared/DetailTable'

/**
 * A customer's Analytics tab, after the redesign (`customer-analytics.tsx`):
 * choose features, a date range and whether to include child customers, then
 * see Revenue, Cost, Margin and Margin %, usage by feature, and a per-feature
 * breakdown with its share of revenue. Features are the chart's Y axis, one
 * bar each, not a tab per feature.
 *
 * Every figure comes from the page, already formatted: usage and revenue from
 * the usage analytics, cost and margin from the cost analytics (the cost
 * sheet). A figure the API did not give is `null` and reads as "—", never as a
 * made-up zero.
 */
export const CustomerAnalyticsViewProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/dropdown-menu',
    'primitives/popover',
    'compositions/date-input',
    'primitives/switch',
    'compositions/layout/Section',
    'compositions/detail/DetailKit',
    'shared/charts',
    'shared/DetailTable',
  ],
  note: 'Customer analytics, after the admin redesign prototype (customer-analytics.tsx).',
})

export interface FeatureAnalytics {
  id: string
  name: string
  /** Total usage, formatted, e.g. `120,000`. */
  usage: string
  /** Compact total for the chart tab, e.g. `120K`. */
  short?: string | undefined
  /** The unit of usage, e.g. `calls`. */
  unit?: string | undefined
  /** Revenue from this feature, formatted. Null when the API did not price it. */
  revenue: string | null
  /** This feature's share of revenue, 0 to 1. */
  share: number
  /** What this feature's usage cost to serve, formatted. Null without a cost sheet. */
  cost: string | null
  /** Usage per day across the range. */
  points: MetricPoint[]
  /**
   * The feature's revenue per price, when it billed under more than one in
   * the range (a price change): the row stays one feature, and this says what
   * each price brought in.
   */
  prices?: FeaturePriceAnalytics[] | undefined
}

/** One price's part of a feature's usage and revenue, already formatted. */
export interface FeaturePriceAnalytics {
  id: string
  /** Which price: when it applied, e.g. `Oct 1 – Oct 14`. */
  label: string
  /** Usage under this price, formatted. */
  usage: string
  revenue: string | null
}

/** The feature's revenue, and when it billed under several prices, a list of each. */
function FeatureRevenue({ feature }: { feature: FeatureAnalytics }) {
  const prices = feature.prices ?? []
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="tabular-nums">{feature.revenue ?? DASH}</span>
      {prices.length > 1 ? (
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
                aria-label={`Revenue by price: ${prices.length} prices`}
              />
            }
          >
            {prices.length} prices
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 p-3"
            aria-label={`${feature.name}: revenue by price`}
          >
            <p className="text-muted-foreground pb-2 text-xs">Revenue by price</p>
            <TotalsList className="max-w-none">
              {prices.map((price, index) => (
                <TotalRow
                  key={`${price.id}-${index}`}
                  label={
                    <>
                      {price.label}
                      <span className="text-muted-foreground block text-xs tabular-nums">
                        {price.usage}
                        {feature.unit ? ` ${feature.unit}` : ''}
                      </span>
                    </>
                  }
                  value={price.revenue ?? DASH}
                />
              ))}
            </TotalsList>
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  )
}

export interface AnalyticsTotals {
  revenue: string | null
  cost: string | null
  margin: string | null
  marginPercent: string | null
}

export interface AnalyticsQuery {
  /** `YYYY-MM-DD`. */
  from: string
  /** `YYYY-MM-DD`. */
  to: string
  includeChildren: boolean
}

export interface AnalyticsFeatureOption {
  id: string
  name: string
}

export interface CustomerAnalyticsViewProps {
  features: FeatureAnalytics[]
  totals: AnalyticsTotals
  query: AnalyticsQuery
  onQueryChange: (query: AnalyticsQuery) => void
  /** The metered features to choose from. */
  featureOptions: AnalyticsFeatureOption[]
  /** The features chosen. Empty means all of them. */
  selectedFeatureIds: string[]
  onSelectedFeatureIdsChange: (ids: string[]) => void
  isLoading?: boolean | undefined
  error?: string | null | undefined
  onRetry?: (() => void) | undefined
  /** One muted line under the filters, for what the figures cover (a contract's scope). */
  note?: string | undefined
  /**
   * Why cost and margin are blank, under the totals: no cost sheet, say. A
   * blank figure otherwise reads as a zero or as a failed read.
   */
  costNote?: string | undefined
  /**
   * When set, the filters and Include children sit on this heading's row,
   * at the right, and the note is not shown.
   */
  title?: string | undefined
}

const NAME_AXIS = 220
const compactUsage = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Keeps the start of a long feature id and ellipsizes the end so the axis does not clip it. */
function featureLabel(name: string): string {
  return name.length > 34 ? `${name.slice(0, 32)}…` : name
}

function FeatureTick({ x, y, payload }: { x: number; y: number; payload?: { value?: string } }) {
  const full = payload?.value ?? ''
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} className="fill-muted-foreground">
      <title>{full}</title>
      {featureLabel(full)}
    </text>
  )
}

/** Usage in the period, one bar per feature. The feature name is the Y axis. */
function FeatureBars({ features }: { features: FeatureAnalytics[] }) {
  const data = features
    .map((feature) => {
      const usage = feature.points.reduce((sum, point) => sum + point.value, 0)
      return { name: feature.name, usage, total: compactUsage.format(usage) }
    })
    .sort((a, b) => b.usage - a.usage)
  const config: ChartConfig = { usage: { label: 'Usage', color: toneColor('series-1') } }
  const height = Math.max(220, data.length * 36)
  return (
    <ChartContainer
      config={config}
      className="aspect-auto! block! w-full max-w-none px-1 pt-4 pb-2"
      style={{ height }}
    >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 64, left: 8, bottom: 0 }}
          barCategoryGap="28%"
        >
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={NAME_AXIS}
            tick={FeatureTick}
            interval={0}
          />
          <ChartTooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
            content={<ChartTooltipContent />}
          />
          <Bar dataKey="usage" fill="var(--color-usage)" radius={[0, 3, 3, 0]}>
            <LabelList
              dataKey="total"
              position="right"
              className="fill-muted-foreground"
              fontSize={11}
            />
          </Bar>
        </BarChart>
    </ChartContainer>
  )
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
)

const DASH = '—'

/** A date range end: shows the date, edits it in a popover. */
function DateButton({
  label,
  value,
  onChange,
  icon,
  min,
  max,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  icon?: boolean
  min?: string
  max?: string
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 gap-2 px-3" />}>
        {icon ? <CalendarIcon aria-hidden="true" className="size-4" /> : null}
        {label} {value}
        <ChevronDownIcon className="opacity-50" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" aria-label={label}>
        <DayCalendar value={value} onValueChange={onChange} min={min} max={max} />
      </PopoverContent>
    </Popover>
  )
}

export function CustomerAnalyticsView({
  features,
  totals,
  query,
  onQueryChange,
  featureOptions,
  selectedFeatureIds,
  onSelectedFeatureIdsChange,
  isLoading = false,
  error = null,
  onRetry,
  note,
  costNote,
  title,
}: CustomerAnalyticsViewProps) {
  const all = selectedFeatureIds.length === 0
  const chosen = all ? featureOptions.map((f) => f.id) : selectedFeatureIds
  const range = `${query.from} to ${query.to}${query.includeChildren ? ', including child customers' : ''}`

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...chosen, id] : chosen.filter((x) => x !== id)
    // At least one stays chosen; all chosen is the same as no filter.
    if (next.length === 0) return
    onSelectedFeatureIdsChange(next.length === featureOptions.length ? [] : next)
  }

  const filters = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 px-3"
              aria-label="Features"
              disabled={featureOptions.length === 0}
            />
          }
        >
          <LayersIcon aria-hidden="true" className="size-4" />
          {all ? 'All features' : `${chosen.length} features`}
          <ChevronDownIcon className="opacity-50" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Metered features
            </DropdownMenuLabel>
            {featureOptions.map((f) => (
              <DropdownMenuCheckboxItem
                key={f.id}
                closeOnClick={false}
                checked={chosen.includes(f.id)}
                onCheckedChange={(on) => toggle(f.id, on)}
              >
                {f.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DateButton
        icon
        label="From"
        value={query.from}
        max={query.to}
        onChange={(from) => onQueryChange({ ...query, from })}
      />
      <DateButton
        label="To"
        value={query.to}
        min={query.from}
        onChange={(to) => onQueryChange({ ...query, to })}
      />
      <label
        className={`text-muted-foreground flex items-center gap-2 text-[13px] ${title ? '' : 'ml-auto'}`}
      >
        Include children
        <Switch
          checked={query.includeChildren}
          onCheckedChange={(includeChildren) => onQueryChange({ ...query, includeChildren })}
          aria-label="Include children"
        />
      </label>
    </div>
  )

  const body = (
    <div className="flex flex-col gap-5">
      {title ? null : filters}
      {note && !title ? <p className="text-muted-foreground -mt-2 text-xs">{note}</p> : null}

      <dl className="bg-background grid grid-cols-2 divide-x rounded-xl border sm:grid-cols-4">
        {(
          [
            ['Revenue', totals.revenue],
            ['Cost', totals.cost],
            ['Margin', totals.margin],
            ['Margin %', totals.marginPercent],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="px-6 py-4">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="mt-1 text-lg font-medium tabular-nums">
              {isLoading && value === null ? (
                <>
                  <Skeleton aria-hidden className="h-6 w-20" />
                  <span className="sr-only">Loading</span>
                </>
              ) : (
                (value ?? DASH)
              )}
            </dd>
          </div>
        ))}
      </dl>
      {costNote ? (
        <Alert variant="info">
          <InfoIcon aria-hidden="true" />
          <AlertDescription>{costNote}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <ErrorState
          title="Analytics could not be loaded"
          description={error}
          {...(onRetry ? { onRetry } : {})}
        />
      ) : !isLoading && features.length === 0 ? (
        <EmptyState
          size="inline"
          title="No usage in this period"
          description="Events this customer sends for metered features show up here."
        />
      ) : (
        <>
          <Section title="Usage" description={range}>
            {isLoading ? (
              <ChartSkeleton height={260} label="Loading usage by feature" />
            ) : (
              <FeatureBars features={features} />
            )}
          </Section>

          <Section title="Usage breakdown" description={range} flush>
            <DetailTable
              label="Usage breakdown"
              noun="features"
              rows={features}
              isLoading={isLoading}
              getRowId={(f) => f.id}
              columns={[
                {
                  key: 'name',
                  header: 'Feature',
                  cell: (f) => <span className="font-medium">{f.name}</span>,
                },
                {
                  key: 'usage',
                  header: 'Usage',
                  cell: (f) => (
                    <span className="tabular-nums">
                      {f.usage} {f.unit ? <Muted>{f.unit}</Muted> : null}
                    </span>
                  ),
                },
                {
                  key: 'revenue',
                  header: 'Revenue',
                  cell: (f) => <FeatureRevenue feature={f} />,
                },
                {
                  key: 'cost',
                  header: 'Cost',
                  cell: (f) => <Muted>{f.cost ?? DASH}</Muted>,
                },
                {
                  key: 'share',
                  header: 'Share of revenue',
                  cell: (f) => (
                    <span className="flex items-center gap-3">
                      <SegmentMeter value={f.share} segments={24} className="h-4 w-40" />
                      <Muted>{Math.round(f.share * 100)}%</Muted>
                    </span>
                  ),
                },
              ]}
            />
          </Section>
        </>
      )}
    </div>
  )

  if (!title) return body
  return (
    <Section title={title} action={filters}>
      {body}
    </Section>
  )
}

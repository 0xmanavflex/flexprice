import {
  AMORTIZATION_METHOD_LABEL,
  RECOGNITION_METHOD_LABEL,
  RecognitionMethod,
  formatMoney,
  type Money,
  type PerformanceObligation,
  type RevenueMonth,
  type SubscriptionRevenue as SubscriptionRevenueData,
} from '@fp/domain'
import type { ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ui/components/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { SimpleTable, type SimpleColumn } from '../../compositions/detail/DetailKit'
import { SubTabState } from '../../compositions/detail/SubTabState'
import { Section } from '../../compositions/layout/Section'

export const SubscriptionRevenueProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/Section',
    'compositions/detail/DetailKit',
    'compositions/detail/SubTabState',
    'primitives/tooltip',
  ],
  note: "A contract's Revenue tab, after Tabs' contract Revenue tab: the performance obligations, then revenue by obligation × month with month-end deferred and unbilled.",
})

export interface SubscriptionRevenueProps {
  revenue: SubscriptionRevenueData | null | undefined
  isLoading: boolean
  /** The sentence for a failed load. */
  error?: string | null | undefined
  onRetry?: (() => void) | undefined
}

const DAY = 86_400_000
const dayFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const isZero = (value: Money) => /^-?0*(\.0*)?$/.test(value.amount)
const amountOrDash = (value: Money | null) => (value && !isZero(value) ? formatMoney(value) : '—')
const monthLabel = (period: string) => monthFormat.format(new Date(`${period}-01T00:00:00Z`))
/** `YYYY-MM` of today, in UTC like the report's months. */
const currentPeriod = () => new Date().toISOString().slice(0, 7)

/** Earned or scheduled but not yet posted to the journal. */
const unposted = (month: RevenueMonth) => !isZero(month.pending) || !isZero(month.scheduled)

/** How the POB's amount is spread; usage always earns daily over the days it covers, whatever is stored. */
const spreadLabel = (pob: PerformanceObligation) => {
  if (pob.recognitionMethod === RecognitionMethod.AsConsumed) return 'Daily, as used'
  if (pob.recognitionMethod === RecognitionMethod.PointInTime) return 'On deliverance day'
  return pob.amortizationMethod ? AMORTIZATION_METHOD_LABEL[pob.amortizationMethod] : '—'
}

function RevenueAmount({ month }: { month: RevenueMonth | undefined }) {
  if (!month || isZero(month.total)) return <>—</>
  return (
    <Tooltip>
      <TooltipTrigger className={cn('tabular-nums', unposted(month) && 'text-muted-foreground')}>
        {formatMoney(month.total)}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="grid grid-cols-[auto_auto] gap-x-3 tabular-nums">
        <span>Posted</span>
        <span className="text-right">{formatMoney(month.actual)}</span>
        <span>Pending</span>
        <span className="text-right">{formatMoney(month.pending)}</span>
        <span>Scheduled</span>
        <span className="text-right">{formatMoney(month.scheduled)}</span>
      </TooltipContent>
    </Tooltip>
  )
}

interface GridRow {
  id: string
  label: string
  strong?: boolean
  cell: (period: string) => ReactNode
  total: ReactNode
}

export function SubscriptionRevenue({
  revenue,
  isLoading,
  error,
  onRetry,
}: SubscriptionRevenueProps) {
  const rowByPob = new Map((revenue?.waterfall.rows ?? []).map((row) => [row.pobId, row]))
  const obligations = [...(revenue?.obligations ?? [])].sort(
    (a, b) => a.serviceStart.getTime() - b.serviceStart.getTime() || a.name.localeCompare(b.name),
  )
  const periods = revenue?.waterfall.periods ?? []
  const totalByPeriod = new Map((revenue?.waterfall.totals ?? []).map((m) => [m.period, m]))

  const state = {
    hasData: Boolean(revenue),
    isLoading,
    error,
    onRetry,
    empty: {
      scene: 'revenue' as const,
      title: 'No revenue contract yet',
      description:
        'A revenue contract is created with the subscription when revenue recognition is on, or by a backfill.',
    },
  }

  const obligationColumns: SimpleColumn<PerformanceObligation>[] = [
    { key: 'name', header: 'Name', cell: (pob) => pob.name },
    {
      key: 'consideration',
      header: 'Consideration',
      cell: (pob) =>
        pob.recognitionMethod === RecognitionMethod.AsConsumed ? 'Variable' : 'Fixed',
    },
    {
      key: 'recognition',
      header: 'Recognition',
      cell: (pob) =>
        pob.recognitionMethod ? RECOGNITION_METHOD_LABEL[pob.recognitionMethod] : '—',
    },
    { key: 'spread', header: 'Spread', cell: spreadLabel },
    { key: 'start', header: 'Service start', cell: (pob) => dayFormat.format(pob.serviceStart) },
    {
      key: 'end',
      header: 'Service end',
      // The API's end is exclusive; shown as the last day served.
      cell: (pob) =>
        pob.serviceEnd ? dayFormat.format(new Date(pob.serviceEnd.getTime() - DAY)) : 'Ongoing',
    },
    {
      key: 'earned',
      header: 'Recognized to date',
      className: 'text-right tabular-nums',
      cell: (pob) => amountOrDash(rowByPob.get(pob.id)?.earned ?? null),
    },
  ]

  const nameOf = new Map(obligations.map((pob) => [pob.id, pob.name]))
  const gridRows: GridRow[] = [
    ...obligations
      .map((pob) => rowByPob.get(pob.id))
      .concat((revenue?.waterfall.rows ?? []).filter((row) => !nameOf.has(row.pobId)))
      .filter((row) => row !== undefined)
      .map((row) => {
        const byPeriod = new Map(row.months.map((m) => [m.period, m]))
        return {
          id: row.pobId,
          label: nameOf.get(row.pobId) ?? row.pobId,
          cell: (period: string) => <RevenueAmount month={byPeriod.get(period)} />,
          total: amountOrDash(row.total),
        }
      }),
    {
      id: 'total',
      label: 'Total revenue',
      strong: true,
      cell: (period) => <RevenueAmount month={totalByPeriod.get(period)} />,
      total: revenue ? amountOrDash(revenue.waterfall.total) : '—',
    },
    {
      id: 'deferred',
      label: 'Deferred',
      cell: (period) => amountOrDash(totalByPeriod.get(period)?.deferred ?? null),
      total: '—',
    },
    {
      id: 'unbilled',
      label: 'Unbilled',
      cell: (period) => amountOrDash(totalByPeriod.get(period)?.unbilled ?? null),
      total: '—',
    },
  ]

  const thisMonth = currentPeriod()
  const gridColumns: SimpleColumn<GridRow>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <span className={cn(row.strong && 'font-medium')}>{row.label}</span>,
    },
    ...periods.map((period) => ({
      key: period,
      header: monthLabel(period),
      className: cn('text-right tabular-nums', period === thisMonth && 'bg-primary/5'),
      cell: (row: GridRow) => (
        <span className={cn(row.strong && 'font-medium')}>{row.cell(period)}</span>
      ),
    })),
    {
      key: 'total',
      header: 'Total',
      className: 'text-right tabular-nums',
      cell: (row) => <span className="font-medium">{row.total}</span>,
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Section table showTitle title="Performance obligations">
        <SubTabState
          {...state}
          columns={obligationColumns.length}
          loadingLabel="Loading obligations"
        >
          <SimpleTable columns={obligationColumns} rows={obligations} />
        </SubTabState>
      </Section>
      <Section
        table
        showTitle
        title="Revenue by performance obligation"
        description="Grey amounts are not posted yet: earned this month, or invoiced for later months. Hover a month for posted, pending and scheduled. Deferred and unbilled are month-end balances of ended months."
      >
        <SubTabState {...state} columns={4} loadingLabel="Loading revenue">
          <TooltipProvider>
            <SimpleTable columns={gridColumns} rows={gridRows} />
          </TooltipProvider>
        </SubTabState>
      </Section>
    </div>
  )
}

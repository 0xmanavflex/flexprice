import { Section } from '../../compositions'
import { SplitMeter } from '../../compositions/DetailKit'

export interface CostMargin {
  currency: string
  revenue: number
  cost: number
}

/** DEMO numbers: the API sends neither revenue nor cost totals for a cost sheet. */
export const DEMO_COST_MARGIN: CostMargin = { currency: 'USD', revenue: 12400, cost: 4650 }

export function CostMarginCard({ margin = DEMO_COST_MARGIN }: { margin?: CostMargin }) {
  const fmt = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: margin.currency }).format(value)
  const profit = margin.revenue - margin.cost
  const pct = margin.revenue > 0 ? (profit / margin.revenue) * 100 : 0
  return (
    <Section title="Margin" description="Sample numbers: revenue and cost totals are not yet available from the API.">
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-1 gap-x-10 gap-y-4 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">Revenue</dt>
            <dd className="font-medium tabular-nums">{fmt(margin.revenue)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">Cost</dt>
            <dd className="font-medium tabular-nums">{fmt(margin.cost)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">Margin</dt>
            <dd className="font-medium tabular-nums">
              {fmt(profit)} · {pct.toFixed(1)}%
            </dd>
          </div>
        </dl>
        <SplitMeter
          used={margin.cost}
          total={margin.revenue}
          usedLabel={`Cost ${fmt(margin.cost)}`}
          availableLabel={`Margin ${fmt(profit)}`}
        />
      </div>
    </Section>
  )
}

import { Section } from '../../../compositions'

export interface CostMargin {
  currency: string
  revenue: number
  cost: number
}

/** DEMO numbers: the API sends neither revenue nor cost totals for a cost sheet. */
export const DEMO_COST_MARGIN: CostMargin = { currency: 'USD', revenue: 12400, cost: 4650 }

export function CostMarginCard({ margin = DEMO_COST_MARGIN }: { margin?: CostMargin }) {
  const fmt = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currencyDisplay: 'narrowSymbol',
      currency: margin.currency,
    }).format(value)
  const profit = margin.revenue - margin.cost
  const pct = margin.revenue > 0 ? (profit / margin.revenue) * 100 : 0
  return (
    <Section title="Margin">
      <div className="space-y-3">
        <p className="text-2xl font-medium tabular-nums">{pct.toFixed(1)}%</p>
        <p className="text-muted-foreground text-xs">
          {fmt(profit)} margin on {fmt(margin.revenue)} revenue and {fmt(margin.cost)} cost. Sample
          numbers: revenue and cost totals are not yet available from the API.
        </p>
      </div>
    </Section>
  )
}

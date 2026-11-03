import { moneyFormatLocale } from '@fp/domain'
import { EmptyState, Section } from '../../../compositions'

export interface CostMargin {
  currency: string
  revenue: number
  cost: number
}

/**
 * The margin a cost sheet earns. The API sends neither revenue nor cost totals
 * for a cost sheet, so the page passes no `margin` today and this says so; it
 * never shows made-up numbers. Pass `margin` once a real source exists.
 */
export function CostMarginCard({ margin }: { margin?: CostMargin | undefined }) {
  if (!margin) {
    return (
      <Section title="Margin">
        <EmptyState
          scene="settings"
          size="inline"
          title="Margin is not available yet"
          description="Flexprice does not report revenue or cost totals for a cost sheet, so no margin is shown."
        />
      </Section>
    )
  }
  const fmt = (value: number) =>
    new Intl.NumberFormat(moneyFormatLocale(margin.currency), {
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
          {fmt(profit)} margin on {fmt(margin.revenue)} revenue and {fmt(margin.cost)} cost.
        </p>
      </div>
    </Section>
  )
}

import { COUPON_CADENCE_LABEL, CouponCadence, CouponType, formatMoney } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { provenance } from '@ui/provenance'

/**
 * The "How it will look" rail beside the coupon form: the discount as it will
 * read ("20% off", "$25.00 off"), the code, how long it lasts, and the
 * redemption limits and window. Driven by the draft only.
 */
export const CouponPreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['@reui/badge'],
  note: 'Live summary of the coupon being drafted; fetches nothing.',
})

export interface CouponPreviewCardProps {
  name: string
  code: string
  type: CouponType
  percentageOff?: string | undefined
  amountOff?: string | undefined
  currency?: string | undefined
  cadence: CouponCadence
  durationInPeriods?: number | undefined
  maxRedemptions?: number | undefined
  redeemAfter?: Date | undefined
  redeemBefore?: Date | undefined
}

function discountText(props: CouponPreviewCardProps): string {
  if (props.type === CouponType.Percentage) {
    const value = props.percentageOff?.trim()
    return value ? `${value}% off` : '% off'
  }
  const amount = props.amountOff?.trim()
  if (!amount) return 'Amount off'
  const currency = props.currency?.trim()
  if (!currency) return `${amount} off`
  try {
    return `${formatMoney({ amount, currency })} off`
  } catch {
    return `${amount} ${currency} off`
  }
}

function durationText(cadence: CouponCadence, periods: number | undefined): string {
  if (cadence === CouponCadence.Repeated) {
    return periods && Number.isFinite(periods)
      ? `Repeats for ${periods} billing ${periods === 1 ? 'period' : 'periods'}`
      : 'Repeats for a set number of periods'
  }
  if (cadence === CouponCadence.Forever) return 'Applies on every billing period'
  return 'Applies once'
}

const formatDate = (d: Date) =>
  d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

function windowText(from: Date | undefined, until: Date | undefined): string {
  if (from && until) return `Redeemable ${formatDate(from)} to ${formatDate(until)}`
  if (from) return `Redeemable from ${formatDate(from)}`
  if (until) return `Redeemable until ${formatDate(until)}`
  return 'No redemption window'
}

export function CouponPreviewCard(props: CouponPreviewCardProps) {
  const title = props.name.trim() || 'Untitled coupon'
  const max = props.maxRedemptions
  return (
    <aside aria-label="Coupon preview" className="bg-background rounded-xl border p-6">
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-xs">How it will look</p>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{title}</p>
          <Badge variant="outline">{COUPON_CADENCE_LABEL[props.cadence]}</Badge>
        </div>
        <p className="text-2xl font-medium tabular-nums">{discountText(props)}</p>
        <p className="text-muted-foreground font-mono text-xs break-all">
          {props.code.trim() || 'No code'}
        </p>
        <div className="flex flex-col gap-1 border-t pt-3 text-sm">
          <p>{durationText(props.cadence, props.durationInPeriods)}</p>
          <p className="text-muted-foreground text-xs">
            {max && Number.isFinite(max)
              ? `Up to ${max.toLocaleString()} redemptions`
              : 'Unlimited redemptions'}
          </p>
          <p className="text-muted-foreground text-xs">
            {windowText(props.redeemAfter, props.redeemBefore)}
          </p>
        </div>
      </div>
    </aside>
  )
}

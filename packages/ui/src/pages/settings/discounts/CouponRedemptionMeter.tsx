import { Progress } from '@ui/components/primitives/progress'

export interface CouponRedemptionMeterProps {
  redeemed: number
  /** The redemption ceiling, or null when there is none. */
  max: number | null
}

/**
 * Body of the coupon overview's "Redemptions" section: the count against the
 * ceiling, a thin progress bar, and how many are left.
 */
export function CouponRedemptionMeter({ redeemed, max }: CouponRedemptionMeterProps) {
  const pct = max && max > 0 ? Math.min(100, (redeemed / max) * 100) : 0
  return (
    <div className="space-y-3">
      <p className="text-2xl font-medium tabular-nums">
        {redeemed.toLocaleString()}
        <span className="text-muted-foreground text-sm">
          {max !== null ? ` / ${max.toLocaleString()}` : ' redeemed'}
        </span>
      </p>
      {max !== null ? (
        <Progress
          value={pct}
          aria-label="Redemptions used"
          className="**:data-[slot=progress-track]:h-1.5"
        />
      ) : null}
      <p className="text-muted-foreground text-xs tabular-nums">
        {max !== null
          ? `${Math.max(0, max - redeemed).toLocaleString()} left`
          : 'No redemption limit'}
      </p>
    </div>
  )
}

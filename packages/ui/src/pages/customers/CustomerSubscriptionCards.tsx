import { SubscriptionStatus, SUBSCRIPTION_STATUS_LABEL, type Subscription } from '@fp/domain'
import { EntityLink } from '../shared/cells'
import { Button } from '@ui/components/primitives/button'
import { cn } from '@ui/lib/cn'

const DAY_MS = 86_400_000

/** Status dot colour: colour is reserved for status. */
const STATUS_DOT: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.Active]: 'bg-emerald-500',
  [SubscriptionStatus.Trialing]: 'bg-sky-500',
  [SubscriptionStatus.Paused]: 'bg-amber-500',
  [SubscriptionStatus.Cancelled]: 'bg-muted-foreground/50',
  [SubscriptionStatus.Incomplete]: 'bg-muted-foreground/50',
}

/** Where a subscription is in its current billing period, from real period dates. */
export function periodProgress(subscription: Subscription, now = new Date()) {
  const { currentPeriodStart: start, currentPeriodEnd: end } = subscription
  if (!start || !end || end <= start) return null
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS))
  const elapsed = Math.round((now.getTime() - start.getTime()) / DAY_MS) + 1
  const day = Math.min(total, Math.max(1, elapsed))
  return { day, total, percent: Math.round((day / total) * 100) }
}

function SubscriptionCard({
  subscription,
  formatDate,
  onOpenPlan,
  className,
}: {
  subscription: Subscription
  formatDate: (date: Date | null) => string
  onOpenPlan?: ((planId: string) => void) | undefined
  className?: string
}) {
  const progress = periodProgress(subscription)
  const cadence = [subscription.billingPeriodLabel, subscription.currency]
    .filter((part) => part && part !== '—')
    .join(' · ')

  return (
    <article className={cn('bg-card flex flex-col gap-4 rounded-xl border p-5', className)}>
      <div className="flex flex-col gap-1">
        <h3 className="truncate text-sm font-medium">
          {onOpenPlan ? (
            <EntityLink
              label={subscription.planName}
              onOpen={() => onOpenPlan(subscription.planId)}
            />
          ) : (
            subscription.planName
          )}
        </h3>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <span
            aria-hidden
            className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[subscription.status])}
          />
          {SUBSCRIPTION_STATUS_LABEL[subscription.status]}
          {cadence ? <span aria-hidden>·</span> : null}
          {cadence}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-label="Billing period progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress?.percent ?? 0}
          className="bg-muted h-1 overflow-hidden rounded-full"
        >
          <div className="bg-primary h-full rounded-full" style={{ width: `${progress?.percent ?? 0}%` }} />
        </div>
        <p className="text-muted-foreground text-xs tabular-nums">
          {progress ? `Day ${progress.day} of ${progress.total}` : 'Billing period not available'}
        </p>
      </div>

      <dl className="flex items-center justify-between gap-3 text-xs">
        <dt className="text-muted-foreground">Next invoice</dt>
        <dd className="font-medium tabular-nums">{formatDate(subscription.currentPeriodEnd)}</dd>
      </dl>
    </article>
  )
}

/**
 * A customer's subscriptions as quiet cards, never more than two across.
 *
 * 1 is full width, 2 sit side by side, 3 is one full-width card over two, 4 is
 * a 2x2, and 5 or more show four plus a link to the full list.
 */
export function CustomerSubscriptionCards({
  subscriptions,
  formatDate,
  onViewAll,
  onOpenPlan,
}: {
  subscriptions: Subscription[]
  formatDate: (date: Date | null) => string
  onViewAll?: () => void
  onOpenPlan?: ((planId: string) => void) | undefined
}) {
  const collapsed = subscriptions.length >= 5 && onViewAll !== undefined
  const shown = collapsed ? subscriptions.slice(0, 4) : subscriptions
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.map((subscription, index) => (
          <SubscriptionCard
            key={subscription.id}
            subscription={subscription}
            formatDate={formatDate}
            onOpenPlan={onOpenPlan}
            className={cn(shown.length % 2 === 1 && index === 0 && shown.length <= 3
              ? 'sm:col-span-2'
              : undefined)}
          />
        ))}
      </div>
      {collapsed ? (
        <div>
          <Button variant="ghost" onClick={onViewAll}>
            View all {subscriptions.length} subscriptions
          </Button>
        </div>
      ) : null}
    </div>
  )
}

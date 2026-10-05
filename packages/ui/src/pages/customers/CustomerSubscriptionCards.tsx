import { CopyIcon, MoreHorizontalIcon, RepeatIcon } from 'lucide-react'
import { toast } from 'sonner'
import { SubscriptionStatus, SUBSCRIPTION_STATUS_LABEL, type Subscription } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Progress } from '@ui/components/primitives/progress'
import { cn } from '@ui/lib/cn'

const DAY_MS = 86_400_000

/** Cards never go more than two across, and never more than this many before "View all". */
const MAX_CARDS = 4

/** Status dot colour: colour is reserved for status, in semantic tokens. */
const STATUS_DOT: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.Active]: 'bg-success',
  [SubscriptionStatus.Trialing]: 'bg-info',
  [SubscriptionStatus.Paused]: 'bg-warning',
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

/** With an odd count the first card takes the full row. */
function cardSpan(count: number, index: number) {
  return count % 2 === 1 && index === 0 ? 'md:col-span-2' : ''
}

/** A quiet card per subscription. Status is a dot in the meta line, not a pill beside the name. */
function SubscriptionCard({
  subscription,
  formatDate,
  onOpen,
  onOpenPlan,
  className,
}: {
  subscription: Subscription
  formatDate: (date: Date | null) => string
  onOpen?: (() => void) | undefined
  onOpenPlan?: ((planId: string) => void) | undefined
  className?: string
}) {
  const progress = periodProgress(subscription)
  const paused = subscription.status === SubscriptionStatus.Paused
  const cadence =
    subscription.status === SubscriptionStatus.Trialing
      ? `Trial ends ${formatDate(subscription.currentPeriodEnd)}`
      : paused
        ? 'Billing paused'
        : [subscription.billingPeriodLabel, subscription.currency]
            .filter((part) => part && part !== '—')
            .join(' · ')
  const range =
    subscription.currentPeriodStart && subscription.currentPeriodEnd
      ? `${formatDate(subscription.currentPeriodStart)} – ${formatDate(subscription.currentPeriodEnd)}`
      : null
  const open = onOpenPlan ? () => onOpenPlan(subscription.planId) : onOpen

  return (
    <article className={cn('bg-background flex flex-col rounded-xl border', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <button
          type="button"
          onClick={open}
          disabled={!open}
          className="min-w-0 space-y-1 text-left"
        >
          <span className="block truncate text-sm font-medium hover:underline">
            {subscription.planName}
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span
              className={cn('size-1.5 rounded-full', STATUS_DOT[subscription.status])}
              aria-hidden="true"
            />
            {SUBSCRIPTION_STATUS_LABEL[subscription.status]}
            {cadence ? <span aria-hidden="true">·</span> : null}
            {cadence}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground -mr-2 size-8"
                aria-label={`Actions for ${subscription.planName}`}
              />
            }
          >
            <MoreHorizontalIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {open ? (
              <DropdownMenuItem onClick={open}>
                <RepeatIcon className="text-muted-foreground" aria-hidden="true" />
                {onOpenPlan ? 'Open plan' : 'View subscriptions'}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard?.writeText(subscription.id)
                toast.success('ID copied')
              }}
            >
              <CopyIcon className="text-muted-foreground" aria-hidden="true" />
              Copy subscription ID
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1.5 px-5 pt-4 pb-4">
        <Progress
          value={progress?.percent ?? 0}
          aria-label="Billing period progress"
          className={cn('**:data-[slot=progress-track]:h-1', paused && 'opacity-40')}
        />
        <div className="text-muted-foreground flex justify-between text-[11px] tabular-nums">
          <span>{range ?? 'Billing period not available'}</span>
          {progress ? <span>{`Day ${progress.day} of ${progress.total}`}</span> : null}
        </div>
      </div>

      <p className="text-muted-foreground mt-auto border-t px-5 py-3 text-xs">
        {paused ? (
          'No invoice while paused'
        ) : (
          <>
            Next invoice{' '}
            <span className="text-foreground">{formatDate(subscription.currentPeriodEnd)}</span>
          </>
        )}
      </p>
    </article>
  )
}

/**
 * A customer's subscriptions as quiet cards, never more than two across.
 *
 * 1 is full width, 2 sit side by side, 3 is one full-width card over two, 4 is
 * a 2x2, and 5 or more show four plus a dashed link to the full list.
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
  const shown = subscriptions.slice(0, MAX_CARDS)
  return (
    <div className={cn('grid gap-4', subscriptions.length > 1 && 'md:grid-cols-2')}>
      {shown.map((subscription, index) => (
        <SubscriptionCard
          key={subscription.id}
          subscription={subscription}
          formatDate={formatDate}
          onOpen={onViewAll}
          onOpenPlan={onOpenPlan}
          className={cardSpan(shown.length, index)}
        />
      ))}
      {subscriptions.length > MAX_CARDS && onViewAll ? (
        <button
          type="button"
          onClick={onViewAll}
          className="text-muted-foreground hover:bg-muted/40 hover:text-foreground rounded-xl border border-dashed py-3 text-[13px] md:col-span-2"
        >
          View all {subscriptions.length} subscriptions
        </button>
      ) : null}
    </div>
  )
}

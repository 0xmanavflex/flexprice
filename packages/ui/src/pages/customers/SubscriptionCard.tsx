import { CopyIcon, EyeIcon, MoreHorizontalIcon } from '@ui/icons'
import { SUBSCRIPTION_STATUS_LABEL, SubscriptionStatus, type Subscription } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Progress } from '@ui/components/primitives/progress'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { SUBSCRIPTION_STATUS_TONE, TONE_DOT } from '../shared/statusTones'

export const SubscriptionCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/progress', 'ui/dropdown-menu', 'ui/button'],
  note: 'A quiet card per contract: plan and status dot, a thin progress line through the billing period, the next invoice date.',
})

const DAY = 86_400_000

/** The shared tone per status, as a dot. */
const STATUS_DOT = Object.fromEntries(
  Object.entries(SUBSCRIPTION_STATUS_TONE).map(([status, tone]) => [status, TONE_DOT[tone]]),
) as Record<SubscriptionStatus, string>

export interface SubscriptionCardProps {
  subscription: Subscription
  formatDate: (value: Date | null) => string
  onOpen: () => void
  /** The moment "Day N of M" is measured at. Defaults to now. */
  now?: Date
  className?: string
}

/**
 * One running contract on a customer's Overview. Status is a dot in the meta
 * line, not a pill beside the name. The API carries no price on a contract, so
 * the card shows where the customer is in the cycle and when the next invoice
 * lands, and nothing it would have to invent.
 */
export function SubscriptionCard({
  subscription: s,
  formatDate,
  onOpen,
  now = new Date(),
  className,
}: SubscriptionCardProps) {
  const start = s.currentPeriodStart ? s.currentPeriodStart.getTime() : null
  const end = s.currentPeriodEnd ? s.currentPeriodEnd.getTime() : null
  const span = start !== null && end !== null && end > start ? end - start : null
  const elapsed = span !== null && start !== null ? now.getTime() - start : 0
  const pct = span !== null ? Math.min(100, Math.max(0, (elapsed / span) * 100)) : 0
  const days = span !== null ? Math.round(span / DAY) : 0
  const day = Math.min(days, Math.max(1, Math.round(elapsed / DAY)))
  const paused = s.status === SubscriptionStatus.Paused
  const meta =
    s.status === SubscriptionStatus.Trialing && s.currentPeriodEnd
      ? `Trial ends ${formatDate(s.currentPeriodEnd)}`
      : paused
        ? 'Billing paused'
        : s.billingPeriodLabel

  return (
    <article className={cn('bg-background flex flex-col rounded-xl border', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <button type="button" onClick={onOpen} className="min-w-0 space-y-1 text-left">
          <span className="block truncate text-sm font-medium hover:underline">
            {s.planName} subscription
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span
              aria-hidden="true"
              className={cn('size-1.5 rounded-full', STATUS_DOT[s.status])}
            />
            {SUBSCRIPTION_STATUS_LABEL[s.status]}
            {meta ? (
              <>
                <span aria-hidden="true">·</span>
                {meta}
              </>
            ) : null}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground -mr-2 size-8"
                aria-label={`Actions for ${s.planName} subscription`}
              />
            }
          >
            <MoreHorizontalIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onOpen}>
                <EyeIcon className="text-muted-foreground" aria-hidden="true" />
                View subscription
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void navigator.clipboard?.writeText(s.id)}>
                <CopyIcon className="text-muted-foreground" aria-hidden="true" />
                Copy subscription ID
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {span !== null ? (
        <div className="space-y-1.5 px-5 pt-5 pb-4">
          <Progress
            value={pct}
            aria-label={`Billing period, day ${day} of ${days}`}
            className={cn('**:data-[slot=progress-track]:h-1', paused && 'opacity-40')}
          />
          <div className="text-muted-foreground flex justify-between text-[11px] tabular-nums">
            <span>
              {formatDate(s.currentPeriodStart)} – {formatDate(s.currentPeriodEnd)}
            </span>
            <span>
              Day {day} of {days}
            </span>
          </div>
        </div>
      ) : (
        <div className="pb-4" />
      )}

      <p className="text-muted-foreground mt-auto border-t px-5 py-3 text-xs">
        {paused ? (
          'No invoice while paused'
        ) : s.currentPeriodEnd ? (
          <>
            Next invoice <span className="text-foreground">{formatDate(s.currentPeriodEnd)}</span>
          </>
        ) : (
          'No upcoming invoice'
        )}
      </p>
    </article>
  )
}

import {
  AccountState,
  type SelfBillingSummary,
  URGENT_DAYS,
  URGENT_SHARE,
  accountCopy,
  accountPill,
  trialProgress,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Dialog, DialogContent, DialogTitle } from '@ui/components/primitives/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/primitives/popover'
import { Progress } from '@ui/components/primitives/progress'
import { AlertCircleIcon, ClockIcon, InfoIcon, LockIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The tenant's own Flexprice account, as the shell shows it: a pill in the top
 * bar on every page while the account is in its trial or locked, and the card
 * it opens on hover. The same card is the dialog a refused write opens, and the
 * "Creating is paused" screen a create page shows while the account is locked.
 */
export const AccountStatusProvenance = provenance({
  source: 'composition',
  composes: ['@reui/badge', 'ui/button', 'ui/popover', 'ui/progress', 'ui/dialog'],
  note: 'Self-billing account pill + hover card, the locked dialog and the Creating is paused screen (reference account-banner, read-only).',
})

export interface AccountStatusProps {
  summary: SelfBillingSummary
  /** Today, as `YYYY-MM-DD`; injectable for stories and tests. */
  today: string
  onViewDetails: () => void
  onUpgrade: () => void
}

const daysText = (n: number) => (n === 1 ? '1 day' : `${n} days`)

function Meter({
  label,
  value,
  share,
  urgent,
}: {
  label: string
  value: string
  share: number
  urgent: boolean
}) {
  return (
    <Progress
      value={Math.min(100, Math.max(0, share * 100))}
      aria-label={label}
      className={cn('gap-1.5', urgent && '[&_[data-slot=progress-indicator]]:bg-warning')}
    >
      <div className="flex w-full justify-between text-[13px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
    </Progress>
  )
}

/** Why, the trial's two meters, View details and Upgrade. */
export function AccountCard({ summary, today, onViewDetails, onUpgrade }: AccountStatusProps) {
  const locked = summary.state === AccountState.Suspended
  const trial = trialProgress(summary, today)
  const cap = summary.events?.cap ?? null
  return (
    <div className="flex flex-col gap-4 p-1.5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{locked ? 'Account locked' : 'Free trial'}</p>
        <p
          className={cn(
            'text-[13px]',
            !locked && trial.urgent ? 'text-warning-foreground' : 'text-muted-foreground',
          )}
        >
          {accountCopy(summary, today)}
        </p>
      </div>
      {locked ? null : (
        <div className="flex flex-col gap-3">
          <Meter
            label="Trial"
            value={`${daysText(trial.daysLeft)} left`}
            share={1 - trial.daysLeft / 30}
            urgent={trial.daysLeft <= URGENT_DAYS}
          />
          {cap ? (
            <Meter
              label="Events"
              value={`${(summary.events?.used ?? 0).toLocaleString('en-US')} of ${cap.toLocaleString('en-US')}`}
              share={trial.share}
              urgent={trial.share >= URGENT_SHARE}
            />
          ) : null}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={onViewDetails}>
          <InfoIcon aria-hidden />
          View details
        </Button>
        <Button size="sm" onClick={onUpgrade}>
          Upgrade
        </Button>
      </div>
    </div>
  )
}

const PILL_VARIANT = {
  trial: 'info-light',
  urgent: 'warning-light',
  locked: 'destructive-light',
} as const

/** The top-bar pill. Nothing once the account is active. Hover opens the card; it closes 200ms after the pointer leaves. */
export function AccountStatusPill(props: AccountStatusProps) {
  const pill = accountPill(props.summary, props.today)
  if (!pill) return null
  const Icon =
    pill.tone === 'locked' ? LockIcon : pill.tone === 'urgent' ? AlertCircleIcon : ClockIcon
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={120}
        closeDelay={200}
        render={
          <Badge
            variant={PILL_VARIANT[pill.tone]}
            size="lg"
            className="h-8 cursor-default gap-1.5 px-2.5 text-[13px] [&_svg]:size-3.5"
            render={<button type="button" />}
          />
        }
      >
        <Icon aria-hidden />
        {pill.label}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80"
        aria-label={pill.tone === 'locked' ? 'Account locked' : 'Free trial'}
      >
        <AccountCard {...props} />
      </PopoverContent>
    </Popover>
  )
}

/** A write the API refused because the account is locked: the pill's card, as a small dialog. */
export function AccountLockedDialog({
  open,
  onOpenChange,
  ...props
}: AccountStatusProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="sr-only">Account locked</DialogTitle>
        <AccountCard {...props} />
      </DialogContent>
    </Dialog>
  )
}

/** A create page opened while the account is locked: say so, instead of a form that cannot save. */
export function CreatingPausedScreen({
  summary,
  today,
  onViewDetails,
  onUpgrade,
}: AccountStatusProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-10 py-16">
      <div className="flex max-w-sm flex-col items-center gap-6 text-center">
        <span className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-full">
          <LockIcon aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-medium tracking-tight">Creating is paused</h1>
          <p className="text-muted-foreground text-sm">{accountCopy(summary, today)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onViewDetails}>
            <InfoIcon aria-hidden />
            View details
          </Button>
          <Button onClick={onUpgrade}>Upgrade</Button>
        </div>
      </div>
    </div>
  )
}

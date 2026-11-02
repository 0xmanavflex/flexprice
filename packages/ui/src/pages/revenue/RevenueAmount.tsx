import { formatMoney, type Money, type RevenueMonth } from '@fp/domain'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { cn } from '@ui/lib/cn'

const monthFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export const isZeroMoney = (value: Money) => /^-?0*(\.0*)?$/.test(value.amount)
export const amountOrDash = (value: Money | null | undefined) =>
  value && !isZeroMoney(value) ? formatMoney(value) : '—'
export const monthLabel = (period: string) => monthFormat.format(new Date(`${period}-01T00:00:00Z`))
/** `YYYY-MM` of today, in UTC like the report's months. */
export const currentPeriod = () => new Date().toISOString().slice(0, 7)

/** Earned or scheduled but not yet posted to the journal. */
const unposted = (month: RevenueMonth) =>
  !isZeroMoney(month.pending) || !isZeroMoney(month.scheduled)

/** A month's revenue: grey while not posted, with posted, pending and scheduled on hover. Needs a `TooltipProvider` above. */
export function RevenueAmount({ month }: { month: RevenueMonth | undefined }) {
  if (!month || isZeroMoney(month.total)) return <>—</>
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

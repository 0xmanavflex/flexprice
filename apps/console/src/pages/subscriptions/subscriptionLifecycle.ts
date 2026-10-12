import type { SubscriptionDetail } from '@fp/domain'
import type { SubscriptionActivity } from '@fp/ui/pages'

/**
 * The contract's lifecycle, read from the timestamps the subscription record
 * itself carries (created, trial, started, cancelled). These are facts the API
 * returned, not an audit log: plan changes, pauses and who acted are not
 * recorded here, and the view labels it accordingly.
 *
 * Nothing speculative is listed. A renewal or scheduled end is shown as a
 * date on the page, never as an event that has happened.
 */
const day = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    : null

export function subscriptionLifecycle(subscription: SubscriptionDetail): SubscriptionActivity[] {
  const events: SubscriptionActivity[] = []
  const push = (
    title: string,
    at: Date | null,
    summary: string,
    status: 'completed' | 'issue' = 'completed',
  ) => {
    if (at) events.unshift({ id: events.length + 1, title, at: day(at) ?? '', status, summary })
  }
  push('Contract created', subscription.createdAt, 'The contract was created.')
  push('Trial started', subscription.trialStart, 'The free trial began.')
  push('Contract started', subscription.startDate, 'Billing began.')
  push('Trial ended', subscription.trialEnd, 'The free trial finished.')
  push('Cancelled', subscription.cancelledAt, 'The contract was cancelled.', 'issue')
  return events
}

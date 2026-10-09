import { SubscriptionStatus, type SubscriptionDetail } from '@fp/domain'
import type { SubscriptionActivity } from '@fp/ui/pages'

/**
 * MOCK — the contract activity log, until the Activity API lands.
 *
 * Everything the contract detail rail shows under "Activity" comes from this one
 * adapter. It builds the log from the lifecycle timestamps the subscription
 * carries (created, started, trial, cancelled) plus the upcoming steps its state
 * implies. When the Activity API arrives, replace `mockSubscriptionActivity` with
 * a mapper over that endpoint's events and delete this file; nothing else in the
 * page needs to change.
 */
export const SUBSCRIPTION_ACTIVITY_IS_MOCK = true

const day = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    : null

export function mockSubscriptionActivity(subscription: SubscriptionDetail): SubscriptionActivity[] {
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

  const ended =
    subscription.status === SubscriptionStatus.Cancelled || Boolean(subscription.cancelledAt)
  const upcoming: SubscriptionActivity[] = []
  if (!ended) {
    const endsOn =
      subscription.cancelAt ??
      (subscription.cancelAtPeriodEnd ? subscription.currentPeriodEnd : null)
    if (endsOn) {
      upcoming.push({
        id: 0,
        title: 'Contract ends',
        at: day(endsOn) ?? '',
        status: 'pending',
        summary: 'The contract will be cancelled and will not renew.',
      })
    } else if (subscription.currentPeriodEnd) {
      upcoming.push({
        id: 0,
        title: 'Renews',
        at: day(subscription.currentPeriodEnd) ?? '',
        status: 'pending',
        summary: 'The next billing period starts.',
      })
    }
  }
  events.unshift(...upcoming.map((event, index) => ({ ...event, id: events.length + 1 + index })))
  return events
}

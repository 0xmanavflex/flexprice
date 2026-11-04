import { describe, expect, it } from 'vitest'
import {
  SUBSCRIPTION_STATUS_LABEL,
  SubscriptionStatus,
  canPauseSubscription,
  isUnstartedSubscription,
} from './subscription'

describe('subscription status', () => {
  it('labels a draft contract Draft, not Incomplete', () => {
    expect(SUBSCRIPTION_STATUS_LABEL[SubscriptionStatus.Draft]).toBe('Draft')
  })

  it('treats a draft and an incomplete contract as not started', () => {
    expect(isUnstartedSubscription(SubscriptionStatus.Draft)).toBe(true)
    expect(isUnstartedSubscription(SubscriptionStatus.Incomplete)).toBe(true)
    expect(isUnstartedSubscription(SubscriptionStatus.Active)).toBe(false)
    expect(isUnstartedSubscription(SubscriptionStatus.Trialing)).toBe(false)
  })

  it('offers Pause only where the API takes it: active, and not a child contract', () => {
    const contract = (status: SubscriptionStatus, subscriptionType = 'standalone') => ({
      status,
      subscriptionType,
    })
    expect(canPauseSubscription(contract(SubscriptionStatus.Active))).toBe(true)
    expect(canPauseSubscription(contract(SubscriptionStatus.Active, 'parent'))).toBe(true)
    // "Only active subscriptions can be paused" (QA #53).
    expect(canPauseSubscription(contract(SubscriptionStatus.Trialing))).toBe(false)
    expect(canPauseSubscription(contract(SubscriptionStatus.Paused))).toBe(false)
    // "Pause the parent subscription instead" (QA #53).
    expect(canPauseSubscription(contract(SubscriptionStatus.Active, 'inherited'))).toBe(false)
    expect(canPauseSubscription(contract(SubscriptionStatus.Active, 'grouped_invoicing'))).toBe(
      false,
    )
  })
})

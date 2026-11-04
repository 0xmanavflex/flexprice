import { describe, expect, it } from 'vitest'
import {
  SUBSCRIPTION_STATUS_LABEL,
  SubscriptionStatus,
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
})

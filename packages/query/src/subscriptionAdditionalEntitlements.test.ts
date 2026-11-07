import { describe, expect, it, vi } from 'vitest'
import { emptySubscription, FeatureType } from '@fp/domain'
import { createSubscriptionWithEntitlements } from './subscriptions'

const draft = () => ({
  ...emptySubscription(),
  additionalEntitlements: [
    { featureId: 'support', featureType: FeatureType.Boolean, isEnabled: true },
    { featureId: 'region', featureType: FeatureType.Static, staticValue: 'EU' },
  ],
})

describe('contract-specific entitlements at creation', () => {
  it('attaches every entitlement to the created contract', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'subs_new' })
    const attach = vi.fn().mockResolvedValue(undefined)
    const value = draft()
    const result = await createSubscriptionWithEntitlements(value, create, attach)
    expect(create).toHaveBeenCalledTimes(1)
    expect(attach).toHaveBeenNthCalledWith(1, 'subs_new', value.additionalEntitlements[0])
    expect(attach).toHaveBeenNthCalledWith(2, 'subs_new', value.additionalEntitlements[1])
    expect(result.entitlementFailures).toEqual([])
  })
  it('reports partial failure, continues other attachments and preserves the created ID', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'subs_new' })
    const attach = vi
      .fn()
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce(undefined)
    await expect(createSubscriptionWithEntitlements(draft(), create, attach)).resolves.toEqual({
      id: 'subs_new',
      entitlementFailures: ['support'],
    })
    expect(create).toHaveBeenCalledTimes(1)
    expect(attach).toHaveBeenCalledTimes(2)
  })
  it('never attaches when creation fails', async () => {
    const attach = vi.fn()
    await expect(
      createSubscriptionWithEntitlements(
        draft(),
        async () => {
          throw new Error('Rejected')
        },
        attach,
      ),
    ).rejects.toThrow('Rejected')
    expect(attach).not.toHaveBeenCalled()
  })
  it('leaves the existing flow unchanged when there are no additions', async () => {
    const attach = vi.fn()
    await expect(
      createSubscriptionWithEntitlements(
        emptySubscription(),
        async () => ({ id: 'subs_new' }),
        attach,
      ),
    ).resolves.toEqual({ id: 'subs_new', entitlementFailures: [] })
    expect(attach).not.toHaveBeenCalled()
  })
})

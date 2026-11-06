import { describe, expect, it, vi } from 'vitest'
import type { Flexprice } from '@fp/api'
import { fetchContractChargeAlerts } from './contractChargeAlerts'
import { toSubscriptionCoupon } from './subscriptions'

describe('contract charge coverage', () => {
  it('batches alert reads by contract and preserves below and percentage thresholds', async () => {
    const valid = {
      entityId: 'line-1',
      parentEntityId: 'sub-1',
      entityType: 'subscription_line_item',
      enabled: true,
      config: {
        alertEnabled: true,
        alertThresholdType: 'percentage',
        warning: { condition: 'below', threshold: '80' },
      },
    }
    const search = vi.fn().mockResolvedValue({
      items: [
        valid,
        { ...valid, entityId: 'other', parentEntityId: 'sub-2' },
        { ...valid, entityId: 'disabled', config: { ...valid.config, alertEnabled: false } },
      ],
    })
    const client = { alertSettings: { queryAlertSettings: search } } as unknown as Flexprice
    const result = await fetchContractChargeAlerts(client, 'sub-1')
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        parentEntityId: 'sub-1',
        entityType: 'subscription_line_item',
        limit: 100,
      }),
      expect.anything(),
    )
    expect([...result]).toEqual([
      [
        'line-1',
        [
          {
            level: 'Warning',
            condition: 'below',
            value: '80%',
            thresholdType: 'percentage',
            threshold: '80',
          },
        ],
      ],
    ])
  })
  it('reads all alert pages without issuing per-line requests', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, () => ({})),
        pagination: { total: 101 },
      })
      .mockResolvedValueOnce({
        items: [
          {
            entityId: 'last',
            parentEntityId: 'sub-1',
            entityType: 'subscription_line_item',
            config: {
              alertThresholdType: 'absolute',
              info: { threshold: '0', condition: 'above' },
            },
          },
        ],
        pagination: { total: 101 },
      })
    const client = { alertSettings: { queryAlertSettings: search } } as unknown as Flexprice
    const result = await fetchContractChargeAlerts(client, 'sub-1')
    expect(search).toHaveBeenCalledTimes(2)
    expect(search.mock.calls[1]?.[0]).toMatchObject({ offset: 100, parentEntityId: 'sub-1' })
    expect(result.get('last')?.[0]?.value).toBe('0 (absolute)')
  })
  it('does not hide failed alert reads as empty configuration', async () => {
    const client = {
      alertSettings: { queryAlertSettings: vi.fn().mockRejectedValue(new Error('offline')) },
    } as unknown as Flexprice
    await expect(fetchContractChargeAlerts(client, 'sub-1')).rejects.toThrow()
  })
  it('retains coupon line scope and excludes future, expired and archived associations', () => {
    const now = new Date('2026-10-16T00:00:00Z')
    const wire = {
      subscriptionLineItemId: 'line-1',
      coupon: { name: 'Launch', type: 'percentage', percentageOff: '15' },
    }
    expect(toSubscriptionCoupon(wire, now)).toMatchObject({
      lineItemId: 'line-1',
      active: true,
      discount: '15% off',
    })
    expect(toSubscriptionCoupon({ ...wire, startDate: new Date('2027-01-01') }, now).active).toBe(
      false,
    )
    expect(toSubscriptionCoupon({ ...wire, endDate: new Date('2026-01-01') }, now).active).toBe(
      false,
    )
    expect(toSubscriptionCoupon({ ...wire, status: 'archived' }, now).active).toBe(false)
    expect(toSubscriptionCoupon({ coupon: wire.coupon }, now).lineItemId).toBeUndefined()
  })
})

it('labels future coupons as scheduled', () => {
  expect(
    toSubscriptionCoupon({ startDate: new Date('2027-01-01') }, new Date('2026-01-01')).status,
  ).toBe('Scheduled')
  expect(
    toSubscriptionCoupon(
      { status: 'archived', startDate: new Date('2027-01-01') },
      new Date('2026-01-01'),
    ).status,
  ).toBe('Ended')
})

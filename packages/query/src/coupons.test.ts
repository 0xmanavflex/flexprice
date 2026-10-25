import { describe, expect, it } from 'vitest'
import { CouponCadence, CouponStatus, CouponType, DEFAULT_COUPON_QUERY } from '@fp/domain'
import { toCoupon, toCouponFilter, type CouponWire } from './coupons'

describe('toCoupon', () => {
  it('joins a fixed discount into a Money and leaves percentageOff null', () => {
    const coupon = toCoupon({
      id: 'coupon_1',
      name: 'Annual credit',
      couponCode: 'ANNUAL50',
      type: 'fixed',
      amountOff: '50.00',
      currency: 'usd',
      cadence: 'once',
    })

    expect(coupon.type).toBe(CouponType.Fixed)
    expect(coupon.amountOff).toEqual({ amount: '50.00', currency: 'USD' })
    expect(coupon.percentageOff).toBeNull()
  })

  it('keeps a percentage as the raw string and leaves amountOff null', () => {
    const coupon = toCoupon({ type: 'percentage', percentageOff: '20', cadence: 'once' })

    expect(coupon.type).toBe(CouponType.Percentage)
    expect(coupon.percentageOff).toBe('20')
    expect(coupon.amountOff).toBeNull()
  })

  it('carries durationInPeriods only for a repeating cadence', () => {
    const repeated = toCoupon({ type: 'percentage', cadence: 'repeated', durationInPeriods: 3 })
    expect(repeated.cadence).toBe(CouponCadence.Repeated)
    expect(repeated.durationInPeriods).toBe(3)

    const once = toCoupon({ type: 'percentage', cadence: 'once', durationInPeriods: 3 })
    expect(once.durationInPeriods).toBeNull()
  })

  it('parses the redeem window from ISO strings, and null when absent', () => {
    const coupon = toCoupon({
      type: 'fixed',
      redeemAfter: '2026-01-01T00:00:00Z',
      redeemBefore: '2026-06-30T00:00:00Z',
    })
    expect(coupon.redeemAfter).toEqual(new Date('2026-01-01T00:00:00Z'))
    expect(coupon.redeemBefore).toEqual(new Date('2026-06-30T00:00:00Z'))

    const open = toCoupon({ type: 'fixed' })
    expect(open.redeemAfter).toBeNull()
    expect(open.redeemBefore).toBeNull()
  })

  it('preserves an unlimited ceiling as null rather than zero', () => {
    expect(toCoupon({ type: 'fixed', totalRedemptions: 87 }).maxRedemptions).toBeNull()
    expect(toCoupon({ type: 'fixed', totalRedemptions: 87 }).totalRedemptions).toBe(87)
  })

  it('falls back to safe defaults for unknown enum values', () => {
    const coupon = toCoupon({
      type: 'mystery',
      cadence: 'sometimes',
      status: 'deleted',
    } as CouponWire)
    expect(coupon.type).toBe(CouponType.Fixed)
    expect(coupon.cadence).toBe(CouponCadence.Once)
    expect(coupon.status).toBe(CouponStatus.Published)
    expect(coupon.name).toBe('Untitled coupon')
  })
})

describe('toCouponFilter', () => {
  it('maps a domain sort field to its wire name and computes the offset', () => {
    const filter = toCouponFilter({
      ...DEFAULT_COUPON_QUERY,
      page: 3,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    })
    expect(filter).toMatchObject({
      limit: 25,
      offset: 50,
      sort: [
        { field: 'updated_at', direction: 'desc' },
        { field: 'id', direction: 'desc' },
      ],
    })
  })

  it('omits the search key when the query has no search term', () => {
    expect(toCouponFilter(DEFAULT_COUPON_QUERY)).not.toHaveProperty('filters')
  })

  // `CouponFilter` has no `nameContains`, and the SDK strips keys its generated
  // schema does not declare: so a name search has to go through the filter DSL
  // or it never reaches the network at all.
  it('searches by name through the filter DSL', () => {
    expect(toCouponFilter({ ...DEFAULT_COUPON_QUERY, search: 'launch' })).toMatchObject({
      filters: [
        { field: 'name', operator: 'contains', dataType: 'string', value: { string: 'launch' } },
      ],
    })
  })
})

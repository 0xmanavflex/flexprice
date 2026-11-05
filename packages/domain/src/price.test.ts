import { describe, expect, it } from 'vitest'
import {
  chargeHasEnded,
  decimalAmountToPercent,
  formatPercentageAmount,
  isPercentagePrice,
  liveChargeCount,
  percentToDecimalAmount,
  tierUnitLabel,
  withPackageSize,
  type Tier,
} from './price'

describe('chargeHasEnded / liveChargeCount', () => {
  const now = Date.UTC(2026, 5, 1)
  const ended = { endDate: new Date(Date.UTC(2026, 0, 1)) }
  const scheduled = { endDate: new Date(Date.UTC(2027, 0, 1)) }
  const open = { endDate: null }

  it('treats a future end date as still billing', () => {
    expect(chargeHasEnded(scheduled, now)).toBe(false)
    expect(chargeHasEnded(open, now)).toBe(false)
    expect(chargeHasEnded(ended, now)).toBe(true)
  })

  it('counts end-dated charges whose end is ahead, so a fixed-term contract is not zero', () => {
    expect(liveChargeCount([scheduled, scheduled], now)).toBe(2)
    expect(liveChargeCount([scheduled, open, ended], now)).toBe(2)
  })
})

const band: Tier = { upTo: null, unitAmount: '1000' }

describe('withPackageSize', () => {
  it('sets a new size rounding up', () => {
    expect(withPackageSize(band, '100').transformQuantity).toEqual({ divideBy: 100, round: 'up' })
  })

  it('keeps the rounding the band already has', () => {
    const down: Tier = { ...band, transformQuantity: { divideBy: 100, round: 'down' } }
    expect(withPackageSize(down, '250').transformQuantity).toEqual({ divideBy: 250, round: 'down' })
  })

  it('reads digits only', () => {
    expect(withPackageSize(band, '1,000').transformQuantity?.divideBy).toBe(1000)
  })

  it.each(['', '0', 'abc'])('leaves a per-unit band per unit for %j', (input) => {
    expect('transformQuantity' in withPackageSize(band, input)).toBe(false)
  })

  it('keeps the rounding while the size is cleared and retyped', () => {
    const down: Tier = { ...band, transformQuantity: { divideBy: 100, round: 'down' } }
    const cleared = withPackageSize(down, '')
    expect(tierUnitLabel(cleared)).toBe('per unit')
    expect(withPackageSize(cleared, '250').transformQuantity).toEqual({
      divideBy: 250,
      round: 'down',
    })
  })
})

describe('tierUnitLabel', () => {
  it('names the unit a band is priced in', () => {
    expect(tierUnitLabel(band)).toBe('per unit')
    expect(tierUnitLabel({ ...band, transformQuantity: { divideBy: 1000000, round: 'up' } })).toBe(
      'per 1,000,000 units',
    )
  })
})

describe('percentage amounts', () => {
  it('converts between a percent and the stored decimal without float error', () => {
    expect(percentToDecimalAmount('7.125')).toBe('0.07125')
    expect(percentToDecimalAmount('1.1')).toBe('0.011')
    expect(percentToDecimalAmount('250')).toBe('2.5')
    expect(decimalAmountToPercent('0.07125')).toBe('7.125')
    expect(decimalAmountToPercent('0.5')).toBe('50')
    expect(formatPercentageAmount('0.07125')).toBe('7.125%')
  })

  it('reads the V1 marker only on a flat fee', () => {
    const marker = { billing_model: 'percentage' }
    expect(isPercentagePrice('FLAT_FEE', marker)).toBe(true)
    expect(isPercentagePrice('TIERED', marker)).toBe(false)
    expect(isPercentagePrice('FLAT_FEE', {})).toBe(false)
    expect(isPercentagePrice('FLAT_FEE', undefined)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { tierUnitLabel, withPackageSize, type Tier } from './price'

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

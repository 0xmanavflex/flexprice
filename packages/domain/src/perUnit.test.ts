import { describe, expect, it } from 'vitest'
import { money, perUnit } from './money'

describe('perUnit', () => {
  it('divides exactly, without floating point', () => {
    expect(perUnit(money('100', 'USD'), '4')?.amount).toBe('25')
    expect(perUnit(money('0.3', 'USD'), '3')?.amount).toBe('0.1')
    expect(perUnit(money('10', 'USD'), '3')?.amount).toBe('3.333333')
    expect(perUnit(money('20', 'USD'), '3')?.amount).toBe('6.666667')
  })

  it('reads decimal and grouped quantities', () => {
    expect(perUnit(money('15', 'USD'), '1.5')?.amount).toBe('10')
    expect(perUnit(money('2500', 'USD'), '1,000')?.amount).toBe('2.5')
  })

  it('keeps the sign and the currency', () => {
    expect(perUnit(money('-9', 'EUR'), '2')).toEqual({ amount: '-4.5', currency: 'EUR' })
  })

  it('has no unit price without a positive quantity', () => {
    expect(perUnit(money('10', 'USD'), '0')).toBeNull()
    expect(perUnit(money('10', 'USD'), '')).toBeNull()
    expect(perUnit(money('10', 'USD'), '-2')).toBeNull()
  })
})

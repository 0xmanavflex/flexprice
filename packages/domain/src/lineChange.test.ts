import { describe, expect, it } from 'vitest'
import { validateLineChange } from './subscription'

const line = {
  quantity: '2',
  amount: { amount: '100', currency: 'USD' },
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: null,
  amountEditable: true,
}
const period = { start: new Date('2026-10-01T00:00:00Z'), end: new Date('2026-11-01T00:00:00Z') }
const draft = { quantity: '', amount: '', effectiveDate: '' }

describe('validateLineChange', () => {
  it('needs at least one real change', () => {
    expect(validateLineChange(line, draft, period).form).toMatch(/quantity or the price/)
    expect(validateLineChange(line, { ...draft, quantity: '2' }, period).form).toBeDefined()
    expect(validateLineChange(line, { ...draft, quantity: '3' }, period)).toEqual({})
  })

  it('only offers the price on a charge whose price can change', () => {
    const fixed = { ...line, amountEditable: false }
    expect(validateLineChange(fixed, { ...draft, amount: '120' }, period).form).toMatch(
      /Change the quantity to/,
    )
    expect(validateLineChange(line, { ...draft, amount: '120' }, period)).toEqual({})
  })

  it('accepts zero but not negatives or text', () => {
    expect(validateLineChange(line, { ...draft, quantity: '0' }, period)).toEqual({})
    expect(validateLineChange(line, { ...draft, quantity: '-1' }, period).quantity).toBeDefined()
    expect(validateLineChange(line, { ...draft, amount: 'abc' }, period).amount).toBeDefined()
  })

  it('keeps the effective date inside the period, end exclusive', () => {
    const q = { ...draft, quantity: '3' }
    expect(validateLineChange(line, { ...q, effectiveDate: '2026-10-15' }, period)).toEqual({})
    expect(
      validateLineChange(line, { ...q, effectiveDate: '2026-09-30' }, period).effectiveDate,
    ).toBeDefined()
    expect(
      validateLineChange(line, { ...q, effectiveDate: '2026-11-02' }, period).effectiveDate,
    ).toBeDefined()
  })
})

it('keeps the exact billing boundary and rejects invalid instants', () => {
  const q = { ...draft, quantity: '3' }
  expect(
    validateLineChange(
      line,
      { ...q, effectiveDate: new Date(period.end.getTime() - 1).toISOString() },
      period,
    ),
  ).toEqual({})
  expect(
    validateLineChange(line, { ...q, effectiveDate: 'invalid' }, period).effectiveDate,
  ).toBeDefined()
})

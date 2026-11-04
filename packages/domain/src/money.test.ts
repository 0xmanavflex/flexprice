import { describe, expect, it } from 'vitest'
import {
  InvalidMoneyError,
  currencySymbol,
  compareMoney,
  formatMoney,
  formatUnitAmount,
  isNegativeMoney,
  isZeroMoney,
  money,
  moneyOr,
} from './money'

describe('money', () => {
  it('keeps the exact string the API sent', () => {
    expect(money('1234.56', 'usd')).toEqual({ amount: '1234.56', currency: 'USD' })
  })

  it('rejects anything that is not a plain decimal', () => {
    for (const bad of ['', 'NaN', '1e3', '1,234.56', 'abc', '1.2.3', '$5']) {
      expect(() => money(bad, 'USD'), bad).toThrow(InvalidMoneyError)
    }
  })

  it('defaults an absent amount to zero rather than each call site inventing one', () => {
    expect(moneyOr(undefined, 'EUR')).toEqual({ amount: '0', currency: 'EUR' })
    expect(moneyOr(null, null)).toEqual({ amount: '0', currency: 'USD' })
    expect(moneyOr('9.99', 'gbp')).toEqual({ amount: '9.99', currency: 'GBP' })
  })

  it('rejects a blank currency, and treats one as absent in moneyOr', () => {
    expect(() => money('1.00', '')).toThrow(InvalidMoneyError)
    expect(() => money('1.00', '   ')).toThrow(InvalidMoneyError)
    expect(moneyOr('1.00', '')).toEqual({ amount: '1.00', currency: 'USD' })
    expect(moneyOr('1.00', '  ')).toEqual({ amount: '1.00', currency: 'USD' })
  })
})

describe('formatUnitAmount', () => {
  it('keeps a sub-cent rate and names its currency', () => {
    expect(formatUnitAmount('0.0005', 'usd')).toBe('$0.0005')
    expect(formatUnitAmount('0.0002', 'USD')).toBe('$0.0002')
    expect(formatUnitAmount('12', 'USD')).toBe('$12.00')
  })

  it('falls back to the raw text when it cannot format', () => {
    expect(formatUnitAmount('', 'USD')).toBe('USD')
    expect(formatUnitAmount('2.4', '')).toBe('2.4')
  })
})

describe('formatMoney', () => {
  it('formats without routing through a float', () => {
    // The whole reason this type exists: Number() loses the last cents.
    const exact = money('12345678901234567.89', 'USD')

    expect(formatMoney(exact, 'en-US')).toBe('$12,345,678,901,234,567.89')
    expect(
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
        Number(exact.amount),
      ),
    ).toBe('$12,345,678,901,234,568.00')
  })

  it('formats ordinary amounts per locale', () => {
    expect(formatMoney(money('1234.5', 'USD'), 'en-US')).toBe('$1,234.50')
    expect(formatMoney(money('-42', 'USD'), 'en-US')).toBe('-$42.00')
  })

  it('groups INR in lakhs and crores, and every other currency in thousands', () => {
    expect(formatMoney(money('8113946.26', 'INR'))).toBe('₹81,13,946.26')
    expect(formatMoney(money('8113946.26', 'INR'), 'en-US')).toBe('₹81,13,946.26')
    expect(formatMoney(money('8113946.26', 'USD'))).toBe('$8,113,946.26')
    expect(formatMoney(money('8113946.26', 'EUR'), 'en-IN')).toBe('€8,113,946.26')
  })
})

describe('compareMoney', () => {
  it('orders amounts that floats get wrong', () => {
    // 0.1 + 0.2 === 0.30000000000000004 as doubles. As decimals it is exact.
    expect(compareMoney(money('0.30', 'USD'), money('0.3', 'USD'))).toBe(0)
    expect(compareMoney(money('0.1', 'USD'), money('0.2', 'USD'))).toBeLessThan(0)
  })

  it('orders amounts too large for a double to hold', () => {
    const a = money('12345678901234567.89', 'USD')
    const b = money('12345678901234567.88', 'USD')

    expect(compareMoney(a, b)).toBeGreaterThan(0)
    // Both collapse to the same double, so Number() would call them equal.
    expect(Number(a.amount) === Number(b.amount)).toBe(true)
  })

  it.each([
    ['5', '10', -1],
    ['10', '5', 1],
    ['10', '10.00', 0],
    ['-5', '5', -1],
    ['-10', '-5', -1],
    ['-5', '-10', 1],
    ['0', '-0.00', 0],
  ])('compares %s to %s', (left, right, expected) => {
    expect(Math.sign(compareMoney(money(left, 'USD'), money(right, 'USD')))).toBe(expected)
  })

  it('sorts a list correctly', () => {
    const amounts = ['100.5', '-3', '0', '100.50', '9.99'].map((a) => money(a, 'USD'))
    expect(amounts.sort(compareMoney).map((m) => m.amount)).toEqual([
      '-3',
      '0',
      '9.99',
      '100.5',
      '100.50',
    ])
  })

  // Comparing USD to EUR is a question with no answer. Returning one hides a bug.
  it('refuses to compare different currencies', () => {
    expect(() => compareMoney(money('1', 'USD'), money('1', 'EUR'))).toThrow(/USD with EUR/)
  })
})

describe('predicates', () => {
  it.each(['0', '0.00', '-0.00', '000'])('treats %s as zero', (amount) => {
    expect(isZeroMoney(money(amount, 'USD'))).toBe(true)
    // Negative zero is not negative.
    expect(isNegativeMoney(money(amount, 'USD'))).toBe(false)
  })

  it('identifies real negatives and non-zeros', () => {
    expect(isNegativeMoney(money('-0.01', 'USD'))).toBe(true)
    expect(isZeroMoney(money('0.01', 'USD'))).toBe(false)
  })
})

describe('currencySymbol', () => {
  it('keeps dollar currencies apart', () => {
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('CAD')).toBe('CA$')
    expect(currencySymbol('AUD')).toBe('A$')
    expect(currencySymbol('EUR')).toBe('€')
  })

  it('falls back to the code', () => {
    expect(currencySymbol('tok')).toBe('tok'.toUpperCase())
    expect(currencySymbol('credits')).toBe('CREDITS')
  })
})

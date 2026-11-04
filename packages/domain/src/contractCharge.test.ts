import { describe, expect, it } from 'vitest'
import {
  CommitmentKind,
  NO_USAGE_TERMS,
  hasTermsErrors,
  startingNow,
  validateContractTerms,
  type AddContractCharge,
} from './contractCharge'

const commitment = {
  kind: CommitmentKind.Amount,
  value: '500',
  windowed: false,
  overageFactor: '1',
  trueUp: false,
}

describe('validateContractTerms', () => {
  it('needs a whole quantity of 1 or more on a fixed charge', () => {
    expect(validateContractTerms({ quantity: '3' })).toEqual({})
    for (const bad of ['', '0', '-1', '1.5', 'x'])
      expect(validateContractTerms({ quantity: bad }).quantity).toBeDefined()
  })

  it('does not ask a metered charge for a quantity', () => {
    expect(validateContractTerms({ terms: NO_USAGE_TERMS })).toEqual({})
  })

  it('accepts a bucket with no commitment', () => {
    const errors = validateContractTerms({ terms: { bucketSize: 'DAY', commitment: null } })
    expect(hasTermsErrors(errors)).toBe(false)
  })

  it('needs a commitment above zero, and whole units for a quantity commitment', () => {
    const terms = (value: string, kind: CommitmentKind = CommitmentKind.Amount) => ({
      bucketSize: '' as const,
      commitment: { ...commitment, kind, value },
    })
    expect(validateContractTerms({ terms: terms('500.50') })).toEqual({})
    expect(validateContractTerms({ terms: terms('0') }).commitmentValue).toBeDefined()
    expect(validateContractTerms({ terms: terms('') }).commitmentValue).toBeDefined()
    expect(
      validateContractTerms({ terms: terms('10.5', CommitmentKind.Quantity) }).commitmentValue,
    ).toMatch(/whole number/)
    expect(validateContractTerms({ terms: terms('10', CommitmentKind.Quantity) })).toEqual({})
  })

  it('keeps the overage factor at 1 or more', () => {
    const at = (overageFactor: string) => ({
      bucketSize: '' as const,
      commitment: { ...commitment, overageFactor },
    })
    expect(validateContractTerms({ terms: at('1.5') })).toEqual({})
    expect(validateContractTerms({ terms: at('0.5') }).overageFactor).toBeDefined()
    expect(validateContractTerms({ terms: at('') }).overageFactor).toBeDefined()
  })
})

describe('startingNow', () => {
  const now = new Date(2026, 10, 4, 12, 39)
  const draft = (startDate: string) => ({ startDate }) as unknown as AddContractCharge

  it('sends "Now" (empty) and today as the instant now (QA #66)', () => {
    expect(startingNow(draft(''), now).startDate).toBe(now.toISOString())
    expect(startingNow(draft('2026-11-04'), now).startDate).toBe(now.toISOString())
  })

  it('leaves another day and a chosen instant alone', () => {
    expect(startingNow(draft('2026-11-20'), now).startDate).toBe('2026-11-20')
    expect(startingNow(draft('2099-03-01T15:30:00.000Z'), now).startDate).toBe(
      '2099-03-01T15:30:00.000Z',
    )
  })
})

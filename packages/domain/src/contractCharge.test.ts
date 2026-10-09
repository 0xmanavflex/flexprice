import { describe, expect, it } from 'vitest'
import {
  CommitmentKind,
  NO_USAGE_TERMS,
  hasTermsErrors,
  validateContractTerms,
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

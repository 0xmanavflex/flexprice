import { describe, expect, it } from 'vitest'
import { CommitmentKind, validateContractTerms, type UsageTerms } from './contractCharge'
import { emptySpendingAllowance, spendingAllowanceSchema } from './spendingAllowance'
const terms = (): UsageTerms => ({
  bucketSize: '',
  commitment: {
    kind: CommitmentKind.Amount,
    value: '10',
    windowed: true,
    overageFactor: '1',
    trueUp: false,
    windows: [
      { id: 'night', start: '22:00', end: '06:00', value: '5', overageFactor: '1', trueUp: false },
    ],
  },
})
describe('existing charge windows', () => {
  it('keeps valid overnight windows editable', () => {
    expect(validateContractTerms({ terms: terms() })).toEqual({})
  })
  it('rejects overlapping windows across midnight', () => {
    const value = terms()
    value.commitment!.windows!.push({
      id: 'morning',
      start: '05:00',
      end: '08:00',
      value: '2',
      overageFactor: '1',
      trueUp: false,
    })
    expect(validateContractTerms({ terms: value }).windows).toMatch(/overlap/)
  })
  it('rejects invalid times and overage factors', () => {
    const value = terms()
    value.commitment!.windows![0]!.start = '25:00'
    expect(validateContractTerms({ terms: value }).windows).toBeTruthy()
    value.commitment!.windows![0]!.start = '22:00'
    value.commitment!.windows![0]!.overageFactor = '0'
    expect(validateContractTerms({ terms: value }).windows).toBeTruthy()
  })
  it('allows no base commitment when specific windows carry it', () => {
    const value = terms()
    value.commitment!.value = '0'
    expect(validateContractTerms({ terms: value })).toEqual({})
  })
})
describe('spending allowances', () => {
  it('validates positive decimal amounts', () => {
    expect(
      spendingAllowanceSchema.safeParse({ ...emptySpendingAllowance(), quota: '50.25' }).success,
    ).toBe(true)
    expect(
      spendingAllowanceSchema.safeParse({ ...emptySpendingAllowance(), quota: '0' }).success,
    ).toBe(false)
  })
  it('rejects reversed dates', () => {
    expect(
      spendingAllowanceSchema.safeParse({
        ...emptySpendingAllowance(),
        quota: '100',
        startDate: '2026-12-01',
        endDate: '2026-11-01',
      }).success,
    ).toBe(false)
  })
})

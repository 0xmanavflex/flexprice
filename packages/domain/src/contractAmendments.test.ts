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

describe('spending allowance reset modes', () => {
  it('ignores the hidden count when returning to billing-period reset', () => {
    expect(
      spendingAllowanceSchema.parse({
        ...emptySpendingAllowance(),
        quota: '25.50',
        every: 0,
        allocation: 'unit_start',
      }),
    ).toMatchObject({ every: 1, allocation: 'first_usage' })
  })
  it('requires whole positive counts only for timed windows', () => {
    for (const every of [0, -1, 1.5]) {
      const result = spendingAllowanceSchema.safeParse({
        ...emptySpendingAllowance(),
        quota: '25',
        unit: 'day',
        every,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.issues[0]?.path).toEqual(['every'])
    }
  })
  it('rejects text and unbounded numeric input before sending it', () => {
    for (const quota of ['allowance', '9'.repeat(400), '-5', '']) {
      expect(
        spendingAllowanceSchema.safeParse({ ...emptySpendingAllowance(), quota }).success,
      ).toBe(false)
    }
  })
})

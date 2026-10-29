import { describe, expect, it } from 'vitest'
import {
  type BonusCreditsConfig,
  bonusCreditsConfigSchema,
  bonusExpiryText,
  bonusText,
  emptyBonusSlab,
  resolveBonus,
  sortBonusSlabs,
} from './bonusCredits'

const CONFIG: BonusCreditsConfig = {
  enabled: true,
  slabs: [
    { ...emptyBonusSlab(), threshold: '100', bonusType: 'flat', bonusValue: '50' },
    { ...emptyBonusSlab(), threshold: '200', bonusType: 'percentage', bonusValue: '10' },
  ],
}

describe('resolveBonus', () => {
  it('takes the highest slab the top-up clears, whatever order they were typed in', () => {
    expect(resolveBonus(CONFIG, '500')?.credits).toBe('50')
    expect(resolveBonus(CONFIG, '150')?.credits).toBe('50')
    expect(resolveBonus(CONFIG, '200')?.slab.bonusType).toBe('percentage')
  })

  it('earns nothing below every slab, when off, or for no credits', () => {
    expect(resolveBonus(CONFIG, '99')).toBeNull()
    expect(resolveBonus({ ...CONFIG, enabled: false }, '500')).toBeNull()
    expect(resolveBonus(CONFIG, '')).toBeNull()
    expect(resolveBonus(null, '500')).toBeNull()
  })
})

describe('the config schema', () => {
  it('needs a slab when it is on', () => {
    expect(bonusCreditsConfigSchema.safeParse({ enabled: true, slabs: [] }).success).toBe(false)
    expect(bonusCreditsConfigSchema.safeParse({ enabled: false, slabs: [] }).success).toBe(true)
  })

  it('refuses two slabs at the same threshold, which the backend would reject', () => {
    const result = bonusCreditsConfigSchema.safeParse({
      enabled: true,
      slabs: [
        { ...emptyBonusSlab(), threshold: '100' },
        { ...emptyBonusSlab(), threshold: '100.0' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('takes a blank expiry as never, and refuses a zero one', () => {
    const slab = { ...emptyBonusSlab(), threshold: '10' }
    expect(bonusCreditsConfigSchema.safeParse({ enabled: true, slabs: [slab] }).success).toBe(true)
    expect(
      bonusCreditsConfigSchema.safeParse({
        enabled: true,
        slabs: [{ ...slab, expiryDuration: '0' }],
      }).success,
    ).toBe(false)
  })
})

describe('words', () => {
  it('sorts highest threshold first', () => {
    expect(sortBonusSlabs(CONFIG.slabs).map((s) => s.threshold)).toEqual(['200', '100'])
  })

  it('says what a slab gives and when it lapses', () => {
    expect(bonusText({ bonusType: 'flat', bonusValue: '50' })).toBe('50 credits')
    expect(bonusText({ bonusType: 'percentage', bonusValue: '10' })).toBe('10% of the top-up')
    expect(bonusExpiryText({ expiryDuration: '', expiryUnit: 'MONTH' })).toBe('never expires')
    expect(bonusExpiryText({ expiryDuration: '1', expiryUnit: 'MONTH' })).toBe(
      'expires 1 month after the top-up',
    )
    expect(bonusExpiryText({ expiryDuration: '30', expiryUnit: 'DAY' })).toBe(
      'expires 30 days after the top-up',
    )
  })
})

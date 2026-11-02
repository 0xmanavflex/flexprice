import { describe, expect, it } from 'vitest'
import { emptyBonusSlab } from '@fp/domain'
import { toBonusCreditsConfig, toBonusCreditsConfigRequest } from './settings'

describe('bonus_credits_topup_config', () => {
  it('reads the API example, slabs and expiry included', () => {
    expect(
      toBonusCreditsConfig({
        enabled: true,
        slabs: [
          {
            threshold: '200',
            operator: 'gte',
            bonus: { type: 'percentage', value: '10' },
            expiration_duration: 3,
            expiration_duration_unit: 'MONTH',
          },
          { threshold: '100', operator: 'gte', bonus: { type: 'flat', value: '50' } },
        ],
      }),
    ).toEqual({
      enabled: true,
      slabs: [
        {
          threshold: '200',
          bonusType: 'percentage',
          bonusValue: '10',
          expiryDuration: '3',
          expiryUnit: 'MONTH',
        },
        {
          threshold: '100',
          bonusType: 'flat',
          bonusValue: '50',
          expiryDuration: '',
          expiryUnit: 'MONTH',
        },
      ],
    })
  })

  it('reads nothing stored as off', () => {
    expect(toBonusCreditsConfig(undefined)).toEqual({ enabled: false, slabs: [] })
  })

  it('writes slabs highest first with gte, and expiry fields together or not at all', () => {
    const request = toBonusCreditsConfigRequest({
      enabled: true,
      slabs: [
        { ...emptyBonusSlab(), threshold: '100', bonusType: 'flat', bonusValue: '50' },
        {
          ...emptyBonusSlab(),
          threshold: '200',
          bonusValue: '10',
          expiryDuration: '30',
          expiryUnit: 'DAY',
        },
      ],
    })
    expect(request).toEqual({
      enabled: true,
      slabs: [
        {
          threshold: '200',
          operator: 'gte',
          bonus: { type: 'percentage', value: '10' },
          expiration_duration: 30,
          expiration_duration_unit: 'DAY',
        },
        { threshold: '100', operator: 'gte', bonus: { type: 'flat', value: '50' } },
      ],
    })
  })
})

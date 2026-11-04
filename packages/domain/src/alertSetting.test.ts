import { describe, expect, it } from 'vitest'
import { AlertCondition, AlertThresholdType, alertSettingConfigSchema } from './alertSetting'

const config = (thresholdType: AlertThresholdType, threshold: string) => ({
  alertEnabled: true,
  thresholdType,
  critical: { condition: AlertCondition.Below, threshold },
})

describe('alertSettingConfigSchema', () => {
  it('accepts a negative absolute threshold: a wallet balance can go below zero', () => {
    expect(
      alertSettingConfigSchema.safeParse(config(AlertThresholdType.Absolute, '-3')).success,
    ).toBe(true)
  })

  it('keeps a percentage between 0 and 100', () => {
    const below = alertSettingConfigSchema.safeParse(config(AlertThresholdType.Percentage, '-5'))
    expect(below.success).toBe(false)
    expect(below.error?.issues[0]?.message).toBe('A percentage cannot be below 0')
    expect(
      alertSettingConfigSchema.safeParse(config(AlertThresholdType.Percentage, '101')).success,
    ).toBe(false)
  })

  it('still rejects what is not a number', () => {
    expect(
      alertSettingConfigSchema.safeParse(config(AlertThresholdType.Absolute, '-')).success,
    ).toBe(false)
  })

  it('saves a disabled alert with its thresholds', () => {
    const parsed = alertSettingConfigSchema.safeParse({
      ...config(AlertThresholdType.Absolute, '1'),
      alertEnabled: false,
    })
    expect(parsed.success).toBe(true)
  })
})

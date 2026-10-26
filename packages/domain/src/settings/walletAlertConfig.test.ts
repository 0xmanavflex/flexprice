import { describe, expect, it } from 'vitest'
import { AlertCondition, AlertThresholdType } from '../alertSetting'
import { defaultWalletAlertConfig, walletAlertConfigSchema } from './walletAlertConfig'

describe('walletAlertConfigSchema', () => {
  /**
   * The live default is alerting *off*, with a critical threshold of "below
   * 0" already sitting there. It has to parse: it is what every environment
   * that has never touched this setting reads back.
   */
  it('accepts the backend’s default, thresholds present and alerting off', () => {
    expect(walletAlertConfigSchema.safeParse(defaultWalletAlertConfig()).success).toBe(true)
  })

  it('accepts an off alert with no thresholds at all', () => {
    expect(
      walletAlertConfigSchema.safeParse({
        alertEnabled: false,
        thresholdType: AlertThresholdType.Absolute,
        info: null,
        warning: null,
        critical: null,
      }).success,
    ).toBe(true)
  })

  /**
   * An enabled alert with no thresholds never fires, so it is indistinguishable
   * from an alert that is off: except that its owner believes it is watching.
   */
  it('refuses an enabled alert with nothing to trigger it', () => {
    const result = walletAlertConfigSchema.safeParse({
      alertEnabled: true,
      thresholdType: AlertThresholdType.Absolute,
      info: null,
      warning: null,
      critical: null,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toMatch(/at least one threshold/i)
  })

  it('refuses a percentage above 100, which can never be reached', () => {
    const result = walletAlertConfigSchema.safeParse({
      alertEnabled: true,
      thresholdType: AlertThresholdType.Percentage,
      info: null,
      warning: { condition: AlertCondition.Below, threshold: '120' },
      critical: null,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['warning'])
  })

  it('allows the same number as an absolute threshold', () => {
    expect(
      walletAlertConfigSchema.safeParse({
        alertEnabled: true,
        thresholdType: AlertThresholdType.Absolute,
        info: null,
        warning: { condition: AlertCondition.Below, threshold: '120' },
        critical: null,
      }).success,
    ).toBe(true)
  })

  /**
   * Thresholds are decimal strings, like every amount in this workspace. A
   * number here would be a float, and a float is a rounding error waiting for
   * a large enough balance.
   */
  it('rejects a threshold that is not a decimal string', () => {
    expect(
      walletAlertConfigSchema.safeParse({
        ...defaultWalletAlertConfig(),
        critical: { condition: AlertCondition.Below, threshold: 'soon' },
      }).success,
    ).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  AlertCondition,
  AlertEntityType,
  AlertThresholdType,
  type AlertSettingQuery,
  configuredSeverities,
  toAlertSettingConfig,
} from '@fp/domain'
import {
  toAlertSetting,
  toAlertSettingFilter,
  toCreateAlertSettingRequest,
  toUpdateAlertSettingRequest,
} from './alertSettings'

/** An `AlertSettingsResponse` row, camelCased as the SDK delivers it. */
const settingWire = {
  id: 'alert_01J000000000000000000000',
  entityId: 'subs_01KVSNYVN19M36R1E7HRYBGX9S',
  entityType: 'subscription',
  enabled: true,
  config: {
    alertEnabled: true,
    alertThresholdType: 'percentage',
    warning: { condition: 'above', threshold: '80' },
    critical: { condition: 'above', threshold: '95' },
  },
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-02T00:00:00Z'),
}

describe('toAlertSetting', () => {
  it('maps a per-entity alert and its thresholds', () => {
    const setting = toAlertSetting(settingWire)
    expect(setting.id).toBe('alert_01J000000000000000000000')
    expect(setting.entityType).toBe(AlertEntityType.Subscription)
    expect(setting.entityId).toBe('subs_01KVSNYVN19M36R1E7HRYBGX9S')
    expect(setting.thresholdType).toBe(AlertThresholdType.Percentage)
    expect(setting.warning).toEqual({ condition: AlertCondition.Above, threshold: '80' })
    expect(setting.critical).toEqual({ condition: AlertCondition.Above, threshold: '95' })
  })

  it('leaves an unconfigured severity null rather than inventing a zero', () => {
    const setting = toAlertSetting(settingWire)
    expect(setting.info).toBeNull()
    expect(configuredSeverities(setting)).toEqual(['warning', 'critical'])
  })

  it('treats a threshold object with no number as unconfigured', () => {
    const setting = toAlertSetting({
      ...settingWire,
      config: { ...settingWire.config, info: {} },
    })
    expect(setting.info).toBeNull()
  })

  it('keeps thresholds as decimal strings, never floats', () => {
    const setting = toAlertSetting({
      ...settingWire,
      config: { ...settingWire.config, warning: { condition: 'below', threshold: '0.10' } },
    })
    expect(setting.warning?.threshold).toBe('0.10')
    expect(setting.warning?.condition).toBe(AlertCondition.Below)
  })

  it('carries the parent subscription for a line-item alert', () => {
    const setting = toAlertSetting({
      ...settingWire,
      entityType: 'subscription_line_item',
      parentEntityId: 'subs_01KVSNYVN19M36R1E7HRYBGX9S',
      parentEntityType: 'subscription',
    })
    expect(setting.entityType).toBe(AlertEntityType.SubscriptionLineItem)
    expect(setting.parentEntityId).toBe('subs_01KVSNYVN19M36R1E7HRYBGX9S')
  })

  it('falls back to the record switch when the config omits one', () => {
    expect(
      toAlertSetting({ ...settingWire, config: { alertThresholdType: 'absolute' } }).enabled,
    ).toBe(true)
    expect(toAlertSetting({ enabled: false }).enabled).toBe(false)
  })

  it('is total for an empty record', () => {
    const setting = toAlertSetting({})
    expect(setting.id).toBe('')
    expect(setting.entityType).toBe(AlertEntityType.Subscription)
    expect(configuredSeverities(setting)).toEqual([])
  })
})

describe('toAlertSettingFilter', () => {
  const query: AlertSettingQuery = {
    page: 3,
    pageSize: 10,
    entityType: null,
    entityId: '',
    enabled: null,
  }

  it('sends only paging when nothing is narrowed', () => {
    expect(toAlertSettingFilter(query)).toEqual({ limit: 10, offset: 20 })
  })

  it('uses the SDK camelCase keys the filter model declares', () => {
    // `entity_type` written literally would be stripped by the generated zod
    // schema and the list would silently return every alert.
    const filter = toAlertSettingFilter({
      ...query,
      entityType: AlertEntityType.Wallet,
      entityId: 'wallet_1',
    })
    expect(filter).toMatchObject({ entityType: 'wallet', entityId: 'wallet_1' })
    expect(filter).not.toHaveProperty('entity_type')
  })

  it('sends enabled:false, which is a filter value and not an absence', () => {
    expect(toAlertSettingFilter({ ...query, enabled: false })).toMatchObject({ enabled: false })
    expect(toAlertSettingFilter({ ...query, enabled: true })).toMatchObject({ enabled: true })
    expect(toAlertSettingFilter(query)).not.toHaveProperty('enabled')
  })
})

describe('toCreateAlertSettingRequest', () => {
  const config = {
    alertEnabled: true,
    thresholdType: AlertThresholdType.Percentage,
    warning: { condition: AlertCondition.Above, threshold: '80' },
  }

  it('sends the entity and a config block', () => {
    expect(
      toCreateAlertSettingRequest({
        entityId: 'subs_1',
        entityType: AlertEntityType.Subscription,
        config,
      }),
    ).toEqual({
      entityId: 'subs_1',
      entityType: 'subscription',
      config: {
        alertEnabled: true,
        alertThresholdType: 'percentage',
        warning: { condition: 'above', threshold: '80' },
      },
    })
  })

  it('omits an unset severity rather than sending null', () => {
    const request = toCreateAlertSettingRequest({
      entityId: 'subs_1',
      entityType: AlertEntityType.Subscription,
      config,
    })
    const sent = request['config'] as Record<string, unknown>
    expect(sent).not.toHaveProperty('info')
    expect(sent).not.toHaveProperty('critical')
  })

  it('omits the parent when the alert is subscription-level', () => {
    const request = toCreateAlertSettingRequest({
      entityId: 'subs_1',
      entityType: AlertEntityType.Subscription,
      config,
    })
    expect(request).not.toHaveProperty('parentEntityId')
  })

  it('sends the parent for a line-item alert, which requires one', () => {
    expect(
      toCreateAlertSettingRequest({
        entityId: 'li_1',
        entityType: AlertEntityType.SubscriptionLineItem,
        parentEntityId: 'subs_1',
        parentEntityType: AlertEntityType.Subscription,
        config,
      }),
    ).toMatchObject({ parentEntityId: 'subs_1', parentEntityType: 'subscription' })
  })
})

describe('toUpdateAlertSettingRequest', () => {
  it('sends only the config: the watched entity cannot be repointed', () => {
    const request = toUpdateAlertSettingRequest(toAlertSettingConfig(toAlertSetting(settingWire)))
    expect(Object.keys(request)).toEqual(['config'])
    expect(request['config']).toMatchObject({
      alertThresholdType: 'percentage',
      warning: { condition: 'above', threshold: '80' },
      critical: { condition: 'above', threshold: '95' },
    })
  })

  it('round-trips a loaded setting back into an equivalent request', () => {
    const setting = toAlertSetting(settingWire)
    const config = toAlertSettingConfig(setting)
    expect(config.thresholdType).toBe(setting.thresholdType)
    expect(config.warning).toEqual(setting.warning)
    expect(config).not.toHaveProperty('info')
  })
})

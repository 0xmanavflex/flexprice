import { beforeEach, describe, expect, it, vi } from 'vitest'

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  register: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  captureException: vi.fn(),
}))
vi.mock('posthog-js', () => ({ default: posthog }))

import {
  analyticsEnabled,
  captureError,
  identifyUser,
  resetAnalytics,
  resetAnalyticsModuleForTests,
  startAnalytics,
  type AnalyticsConfig,
} from './posthog'

const config: AnalyticsConfig = {
  enabled: true,
  key: 'phc_test',
  host: 'https://eu.i.posthog.com',
  useMocks: false,
  region: 'in',
  appVersion: 'abc123',
}

beforeEach(() => {
  resetAnalyticsModuleForTests()
  vi.clearAllMocks()
})

describe('analytics', () => {
  it('stays off without the flag, without a key, and under mocks', () => {
    expect(analyticsEnabled({ ...config, enabled: false })).toBe(false)
    expect(analyticsEnabled({ ...config, key: '' })).toBe(false)
    expect(analyticsEnabled({ ...config, useMocks: true })).toBe(false)
    expect(analyticsEnabled(config)).toBe(true)
  })

  it('loads nothing and records nothing when off', async () => {
    expect(await startAnalytics({ ...config, enabled: false })).toBeNull()
    identifyUser({ id: 'u1', email: 'a@example.com' })
    resetAnalytics()
    expect(posthog.init).not.toHaveBeenCalled()
    expect(posthog.identify).not.toHaveBeenCalled()
    expect(posthog.reset).not.toHaveBeenCalled()
  })

  it('starts with the deployment key and host and tags every event with the region', async () => {
    await startAnalytics(config)
    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://eu.i.posthog.com',
        capture_pageview: 'history_change',
      }),
    )
    expect(posthog.register).toHaveBeenCalledWith({
      app: 'console',
      region: 'in',
      app_version: 'abc123',
    })
  })

  it('labels a deployment outside the hosted regions as self-hosted', async () => {
    await startAnalytics({ ...config, region: null, appVersion: null })
    expect(posthog.register).toHaveBeenCalledWith({ app: 'console', region: 'self-hosted' })
  })

  it('identifies by email with V1’s person properties, even if asked before loading finished', async () => {
    const started = startAnalytics(config)
    identifyUser({ id: 'u1', email: 'a@example.com', tenantId: 't1', tenantName: 'Acme' })
    expect(posthog.identify).not.toHaveBeenCalled()
    await started
    expect(posthog.identify).toHaveBeenCalledWith('a@example.com', {
      id: 'u1',
      email: 'a@example.com',
      name: 'Acme',
      tenant_name: 'Acme',
      tenant_id: 't1',
    })
  })

  it('resets on sign-out and reports caught errors', async () => {
    await startAnalytics(config)
    resetAnalytics()
    const error = new Error('boom')
    captureError(error, { source: 'route-error' })
    expect(posthog.reset).toHaveBeenCalledTimes(1)
    expect(posthog.captureException).toHaveBeenCalledWith(error, { source: 'route-error' })
  })
})

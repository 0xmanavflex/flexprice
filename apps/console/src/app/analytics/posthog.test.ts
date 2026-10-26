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
  scrubEvent,
  scrubUrl,
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
    expect(posthog.register).toHaveBeenCalledWith({
      app: 'console',
      region: 'self-hosted',
      app_version: 'unknown',
    })
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

  it('never sends URL fragments, masks text and inputs, and scrubs every event', async () => {
    await startAnalytics(config)
    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        disable_capture_url_hashes: true,
        before_send: scrubEvent,
        mask_all_text: true,
        session_recording: { maskAllInputs: true, maskTextSelector: '*' },
      }),
    )
  })
})

describe('scrubUrl', () => {
  it('drops the fragment, where sign-in and reset links carry their tokens', () => {
    expect(
      scrubUrl('https://app.flexprice.io/reset-password#access_token=eyJ.a.b&type=recovery'),
    ).toBe('https://app.flexprice.io/reset-password')
  })

  it('redacts credential-like query values and keeps the rest', () => {
    expect(
      scrubUrl(
        'https://app.flexprice.io/tools/integrations/oauth/callback?code=abc&state=xyz&tab=all',
      ),
    ).toBe(
      'https://app.flexprice.io/tools/integrations/oauth/callback?code=redacted&state=redacted&tab=all',
    )
    expect(scrubUrl('/p?token=secret')).toBe('/p?token=redacted')
  })

  it('redacts the token in a hosted invoice path', () => {
    expect(scrubUrl('https://app.flexprice.io/i/in/tok_123')).toBe(
      'https://app.flexprice.io/i/in/redacted',
    )
  })

  it('leaves anything that is not a URL alone', () => {
    expect(scrubUrl('Acme Robotics')).toBe('Acme Robotics')
  })

  it('scrubs event, $set and $set_once properties', () => {
    const event = scrubEvent({
      uuid: 'u',
      event: '$pageview',
      properties: { $current_url: 'https://app.flexprice.io/sign-up/confirm#access_token=t', n: 1 },
      $set_once: { $initial_current_url: 'https://app.flexprice.io/x?token=t' },
    })
    expect(event?.properties).toEqual({
      $current_url: 'https://app.flexprice.io/sign-up/confirm',
      n: 1,
    })
    expect(event?.$set_once).toEqual({
      $initial_current_url: 'https://app.flexprice.io/x?token=redacted',
    })
  })
})

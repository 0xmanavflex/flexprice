import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_CONTACT,
  DEFAULT_PLATFORM_CONFIG,
  parsePlatformConfig,
  resolveApiConfig,
} from './env'

describe('parsePlatformConfig (VITE_PLATFORM_CONFIG, as V1)', () => {
  it('uses the defaults when nothing is configured', () => {
    expect(parsePlatformConfig(undefined)).toEqual(DEFAULT_PLATFORM_CONFIG)
    expect(DEFAULT_PLATFORM_CONFIG).toEqual({
      production: { enabled: false },
      contact: DEFAULT_CONTACT,
    })
  })

  it('reads production and each contact option, keeping the defaults left out', () => {
    expect(
      parsePlatformConfig(
        JSON.stringify({
          production: { enabled: true },
          contact_us: { slack_url: ' https://acme.slack.com/invite ', email: 'billing@acme.com' },
        }),
      ),
    ).toEqual({
      production: { enabled: true },
      contact: {
        slackUrl: 'https://acme.slack.com/invite',
        email: 'billing@acme.com',
        bookCallUrl: DEFAULT_CONTACT.bookCallUrl,
      },
    })
  })

  it('hides one option set to "", and all of them when contact_us is off', () => {
    expect(
      parsePlatformConfig('{"contact_us":{"book_call_url":""}}').contact.bookCallUrl,
    ).toBeNull()
    expect(parsePlatformConfig('{"contact_us":{"enabled":false}}').contact).toEqual({
      slackUrl: null,
      email: null,
      bookCallUrl: null,
    })
    expect(parsePlatformConfig('{"contact_us":false}').contact.email).toBeNull()
  })

  it("accepts V1's other keys, and ignores invalid JSON with a warning", () => {
    expect(parsePlatformConfig('{"revenue":{"enabled":false},"signup":{"enabled":true}}')).toEqual(
      DEFAULT_PLATFORM_CONFIG,
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(parsePlatformConfig('{not json')).toEqual(DEFAULT_PLATFORM_CONFIG)
    expect(parsePlatformConfig('[1,2]')).toEqual(DEFAULT_PLATFORM_CONFIG)
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})

describe('resolveApiConfig', () => {
  const API = 'https://api.cloud.flexprice.io/v1'

  it('talks to a configured API, trimmed', () => {
    expect(resolveApiConfig(`  ${API} `, 'false', true)).toEqual({
      useMocks: false,
      apiUrl: API,
      problem: null,
    })
  })

  it('falls back to mocks without an API URL in development only', () => {
    expect(resolveApiConfig(undefined, undefined, false)).toMatchObject({
      useMocks: true,
      problem: null,
    })
    const production = resolveApiConfig(undefined, undefined, true)
    expect(production.useMocks).toBe(false)
    expect(production.problem?.detail).toMatch(/does not fall back to demo data/)
  })

  it('keeps an explicit VITE_USE_MOCKS=true in a production build', () => {
    expect(resolveApiConfig(undefined, 'true', true)).toMatchObject({
      useMocks: true,
      problem: null,
    })
  })

  it('treats an API URL of only spaces as unset', () => {
    expect(resolveApiConfig('   ', undefined, true).problem?.title).toBe(
      'Flexprice is not configured',
    )
    expect(resolveApiConfig('   ', undefined, false).useMocks).toBe(true)
  })

  it('reports an API URL that is not a URL instead of handing it on', () => {
    const config = resolveApiConfig('api.flexprice.io', 'false', true)
    expect(config.useMocks).toBe(false)
    expect(config.problem?.detail).toMatch(/not an http\(s\) URL/)
    expect(() => new URL(config.apiUrl)).not.toThrow()
  })
})

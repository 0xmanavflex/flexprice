import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONTACT, DEFAULT_PLATFORM_CONFIG, parsePlatformConfig } from './env'

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

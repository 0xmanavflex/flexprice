import { describe, expect, it } from 'vitest'
import { DEFAULT_CONTACT, resolveContact } from './env'

describe('resolveContact', () => {
  it("uses Flexprice's own contact details when nothing is configured", () => {
    expect(resolveContact({})).toEqual(DEFAULT_CONTACT)
  })

  it('takes each configured value, trimmed', () => {
    expect(
      resolveContact({
        slackUrl: ' https://acme.slack.com/invite ',
        email: 'billing@acme.com',
        bookCallUrl: 'https://cal.com/acme',
      }),
    ).toEqual({
      slackUrl: 'https://acme.slack.com/invite',
      email: 'billing@acme.com',
      bookCallUrl: 'https://cal.com/acme',
    })
  })

  it('hides an option set to none', () => {
    expect(resolveContact({ slackUrl: 'none', bookCallUrl: 'NONE' })).toEqual({
      slackUrl: null,
      email: DEFAULT_CONTACT.email,
      bookCallUrl: null,
    })
  })
})

import { describe, expect, it } from 'vitest'
import { regionHref, regionOfOrigin } from './regionRouting'

/**
 * The two pure parts of region switching: knowing where you are, and knowing
 * where a pick should send you.
 *
 * Both matter more than they look. Getting `regionOfOrigin` wrong shows a
 * switcher inviting someone to "move" to the region they are already in;
 * getting `regionHref` wrong sends them to another region's home page having
 * silently dropped the page they were on.
 */
const URLS = {
  in: 'https://in.app.flexprice.io',
  us: 'https://app.flexprice.io',
  ca: 'https://ca.app.flexprice.io',
} as const

const ALIASES = { in: [], us: ['https://us.app.flexprice.io'], ca: [] }

describe('regionOfOrigin', () => {
  it.each([
    ['https://in.app.flexprice.io', 'in'],
    ['https://app.flexprice.io', 'us'],
    ['https://ca.app.flexprice.io', 'ca'],
  ])('recognises %s as %s', (origin, expected) => {
    expect(regionOfOrigin(origin, URLS, ALIASES)).toBe(expected)
  })

  it('recognises the US alias as the US, not as nothing', () => {
    // us.app.flexprice.io is the same deployment under another name. Reading
    // it as "no region" would hide the switcher on a real hosted dashboard.
    expect(regionOfOrigin('https://us.app.flexprice.io', URLS, ALIASES)).toBe('us')
  })

  it.each([
    ['a preview deploy', 'https://portal-git-feature.vercel.app'],
    ['localhost', 'http://localhost:3000'],
    ['a self-hosted console', 'https://billing.acme.test'],
    ['a lookalike host', 'https://app.flexprice.io.evil.test'],
  ])('does not claim %s is a hosted region', (_label, origin) => {
    expect(regionOfOrigin(origin, URLS, ALIASES)).toBeNull()
  })

  it('ignores an unparseable configured URL rather than throwing', () => {
    expect(regionOfOrigin('https://app.flexprice.io', { ...URLS, in: 'not a url' }, ALIASES)).toBe(
      'us',
    )
  })
})

describe('regionHref', () => {
  it('keeps the page and its query', () => {
    // Someone comparing invoices across regions should land on invoices.
    expect(regionHref('us', URLS, '/invoices', '?status=overdue')).toBe(
      'https://app.flexprice.io/invoices?status=overdue',
    )
  })

  it('handles the root path and an empty query', () => {
    expect(regionHref('ca', URLS, '/', '')).toBe('https://ca.app.flexprice.io/')
  })

  it('points at the region asked for, not the one in the path', () => {
    expect(regionHref('in', URLS, '/customers/cus_1', '')).toBe(
      'https://in.app.flexprice.io/customers/cus_1',
    )
  })
})

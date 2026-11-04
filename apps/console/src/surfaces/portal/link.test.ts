import { describe, expect, it } from 'vitest'
import { parsePortalLocation, portalHref, takePortalToken } from './link'

const urls = { us: 'https://us.api.flexprice.io', in: 'https://api.cloud.flexprice.io' }

describe('parsePortalLocation', () => {
  it('reads region, view, range and invoice', () => {
    expect(parsePortalLocation('/us', '', urls)).toEqual({
      region: 'us',
      apiOrigin: 'https://us.api.flexprice.io',
      view: 'overview',
      range: null,
      customRange: null,
      invoiceId: null,
    })
    expect(parsePortalLocation('/in/usage/', '?range=7d&invoice=inv_1', urls)).toMatchObject({
      region: 'in',
      view: 'usage',
      range: '7d',
      invoiceId: 'inv_1',
    })
  })

  it.each([
    ['/', ''],
    ['/eu', ''],
    ['/ca', ''], // a region the deployment has no API for
    ['/us/settings', ''],
    ['/us/usage/extra', ''],
    ['/constructor', ''],
  ])('%s is not a portal address', (path, search) => {
    expect(parsePortalLocation(path, search, urls)).toBeNull()
  })

  it('leaves an unknown range to the settings’ default', () => {
    expect(parsePortalLocation('/us/usage', '?range=year', urls)?.range).toBeNull()
  })
})

describe('a calendar range', () => {
  it('reads from and to as whole local days and writes them back', () => {
    const at = parsePortalLocation('/us/usage', '?from=2026-09-01&to=2026-09-30', urls)
    expect(at?.customRange).toEqual({ start: new Date(2026, 8, 1), end: new Date(2026, 9, 1) })
    expect(
      portalHref(
        {
          region: 'us',
          view: 'usage',
          range: '30d',
          customRange: at?.customRange ?? null,
          invoiceId: null,
        },
        '/p',
      ),
    ).toBe('/p/us/usage?from=2026-09-01&to=2026-09-30')
  })

  it('ignores a range it cannot read, or one that ends before it starts', () => {
    expect(
      parsePortalLocation('/us/usage', '?from=2026-09-30&to=2026-09-01', urls)?.customRange,
    ).toBeNull()
    expect(parsePortalLocation('/us/usage', '?from=yesterday', urls)?.customRange).toBeNull()
  })
})

describe('portalHref', () => {
  it('round-trips through parsePortalLocation', () => {
    const href = portalHref(
      { region: 'us', view: 'usage', range: '7d', customRange: null, invoiceId: 'inv_1' },
      '/p',
    )
    expect(href).toBe('/p/us/usage?range=7d&invoice=inv_1')
    const url = new URL(href, 'https://x.test')
    expect(parsePortalLocation(url.pathname.slice(2), url.search, urls)).toMatchObject({
      view: 'usage',
      range: '7d',
      invoiceId: 'inv_1',
    })
    expect(
      portalHref(
        { region: 'us', view: 'overview', range: null, customRange: null, invoiceId: null },
        '',
      ),
    ).toBe('/us')
  })
})

describe('takePortalToken', () => {
  const memory = () => {
    const map = new Map<string, string>()
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    }
  }

  it('moves the token from the link into storage and strips it', () => {
    const storage = memory()
    expect(takePortalToken('us', '?token=abc&range=7d', storage)).toEqual({
      token: 'abc',
      cleanSearch: '?range=7d',
    })
    expect(takePortalToken('us', '', storage)).toEqual({ token: 'abc', cleanSearch: null })
    // Per region: another region's link is another customer.
    expect(takePortalToken('in', '', storage).token).toBeNull()
  })

  it('still works when storage throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(takePortalToken('us', '?token=abc', blocked)).toEqual({ token: 'abc', cleanSearch: '' })
    expect(takePortalToken('us', '', blocked).token).toBeNull()
  })
})

describe('a region-less link (this deployment’s own portal)', () => {
  const own = 'https://api-dev.flexprice.io'

  it('reads the view and uses the console’s own API', () => {
    expect(parsePortalLocation('/', '', urls, own)).toMatchObject({
      region: null,
      apiOrigin: own,
      view: 'overview',
    })
    expect(parsePortalLocation('/invoices', '?invoice=inv_1', urls, own)).toMatchObject({
      region: null,
      view: 'invoices',
      invoiceId: 'inv_1',
    })
  })

  it('is not a portal address without an API of its own', () => {
    expect(parsePortalLocation('/', '', urls, null)).toBeNull()
    expect(parsePortalLocation('/settings', '', urls, own)).toBeNull()
  })

  it('round-trips through portalHref', () => {
    expect(
      portalHref(
        { region: null, view: 'overview', range: null, customRange: null, invoiceId: null },
        '/p',
      ),
    ).toBe('/p')
    expect(
      portalHref(
        { region: null, view: 'usage', range: '7d', customRange: null, invoiceId: null },
        '/p',
      ),
    ).toBe('/p/usage?range=7d')
  })

  it('keeps its token apart from a regional one', () => {
    const map = new Map<string, string>()
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    }
    takePortalToken(null, '?token=own', storage)
    expect(takePortalToken('us', '', storage).token).toBeNull()
    expect(takePortalToken(null, '', storage).token).toBe('own')
  })
})

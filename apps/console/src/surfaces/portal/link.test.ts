import { describe, expect, it } from 'vitest'
import { parsePortalLocation, portalHref, takePortalToken } from './link'

const urls = { us: 'https://us.api.flexprice.io', in: 'https://api.cloud.flexprice.io' }

describe('parsePortalLocation', () => {
  it('reads region, view, range and invoice', () => {
    expect(parsePortalLocation('/us', '', urls)).toEqual({
      region: 'us',
      apiOrigin: 'https://us.api.flexprice.io',
      view: 'overview',
      range: '30d',
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

  it('falls back to the default range for an unknown one', () => {
    expect(parsePortalLocation('/us/usage', '?range=year', urls)?.range).toBe('30d')
  })
})

describe('portalHref', () => {
  it('round-trips through parsePortalLocation', () => {
    const href = portalHref({ region: 'us', view: 'usage', range: '7d', invoiceId: 'inv_1' }, '/p')
    expect(href).toBe('/p/us/usage?range=7d&invoice=inv_1')
    const url = new URL(href, 'https://x.test')
    expect(parsePortalLocation(url.pathname.slice(2), url.search, urls)).toMatchObject({
      view: 'usage',
      range: '7d',
      invoiceId: 'inv_1',
    })
    expect(portalHref({ region: 'us', view: 'overview', range: '30d', invoiceId: null }, '')).toBe(
      '/us',
    )
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
      portalHref({ region: null, view: 'overview', range: '30d', invoiceId: null }, '/p'),
    ).toBe('/p')
    expect(portalHref({ region: null, view: 'usage', range: '7d', invoiceId: null }, '/p')).toBe(
      '/p/usage?range=7d',
    )
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

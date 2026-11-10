import { describe, expect, it, vi } from 'vitest'
import {
  isGatewayReturn,
  parsePortalLocation,
  portalHref,
  rememberForReturn,
  returnUrl,
  tokenForReturn,
} from './link'

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
      token: null,
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

describe('the session token', () => {
  it('is read from the link and kept on every address the portal moves to', () => {
    const at = parsePortalLocation('/us/usage', '?token=abc&range=7d', urls)
    expect(at?.token).toBe('abc')
    expect(portalHref({ ...at!, view: 'invoices', invoiceId: 'inv_1' }, '')).toBe(
      '/us/invoices?token=abc&invoice=inv_1',
    )
    expect(portalHref({ ...at!, view: 'overview' }, '/p')).toBe('/p/us?token=abc')
  })

  it('is null when the link has none', () => {
    expect(parsePortalLocation('/us', '', urls)?.token).toBeNull()
    expect(parsePortalLocation('/us', '?token=%20', urls)?.token).toBeNull()
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
})

describe('returnUrl', () => {
  it('sends a gateway back without the token, marked as a return', () => {
    expect(returnUrl('https://portal.flexprice.io/us/invoices?token=secret&invoice=inv_1')).toBe(
      'https://portal.flexprice.io/us/invoices?invoice=inv_1&returned=1',
    )
  })
})

describe('isGatewayReturn', () => {
  it.each([
    '?returned=1',
    '?razorpay_payment_id=pay_1&razorpay_signature=x',
    '?razorpay_payment_link_id=plink_1',
    '?session_id=cs_test_1',
    '?_ptxn=txn_1',
    // A connection-level redirect drops our marker; Moyasar's own parameters remain.
    '?id=pay_1&status=paid',
  ])('recognises %s', (search) => {
    expect(isGatewayReturn(search)).toBe(true)
  })

  it.each(['', '?invoice=inv_1', '?id=only_an_id'])('treats %s as an ordinary visit', (search) => {
    expect(isGatewayReturn(search)).toBe(false)
  })
})

describe('the session kept for a gateway return', () => {
  it('drops the token and any gateway parameters from the return address', () => {
    expect(
      returnUrl('https://portal.flexprice.io/us/credits?token=tok&invoice=inv_1&id=pay_1&state=x'),
    ).toBe('https://portal.flexprice.io/us/credits?invoice=inv_1&returned=1')
  })

  it('opens the returned tab with the kept session for an hour, then forgets it', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
    rememberForReturn('tok', 1_000)
    expect(tokenForReturn(1_000 + 59 * 60_000)).toBe('tok')
    expect(tokenForReturn(1_000 + 61 * 60_000)).toBeNull()
    expect(tokenForReturn(1_000)).toBeNull()
    vi.unstubAllGlobals()
  })
})

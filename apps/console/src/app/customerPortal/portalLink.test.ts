import { describe, expect, it } from 'vitest'
import { customerPortalLink } from './portalLink'

describe('customerPortalLink', () => {
  it('names the region when this deployment has its API', () => {
    expect(
      customerPortalLink('tok', {
        origin: 'https://us.app.flexprice.io',
        region: 'us',
        publicApiUrls: { us: 'https://us.api.flexprice.io' },
      }),
    ).toBe('https://us.app.flexprice.io/p/us?token=tok')
  })

  it('falls back to this deployment’s own portal', () => {
    expect(
      customerPortalLink('a b', {
        origin: 'https://admin-dev.flexprice.io',
        region: null,
        publicApiUrls: {},
      }),
    ).toBe('https://admin-dev.flexprice.io/p?token=a+b')
    expect(
      customerPortalLink('tok', {
        origin: 'https://admin-dev.flexprice.io',
        region: 'in',
        publicApiUrls: {},
      }),
    ).toBe('https://admin-dev.flexprice.io/p?token=tok')
  })

  it('uses the portal domain the deployment names, served at its root', () => {
    expect(
      customerPortalLink('tok', {
        origin: 'https://us.app.flexprice.io',
        region: 'us',
        publicApiUrls: { us: 'https://us.api.flexprice.io' },
        portalHost: 'portal.flexprice.io',
      }),
    ).toBe('https://portal.flexprice.io/us?token=tok')
    expect(
      customerPortalLink('tok', {
        origin: 'https://admin-dev.flexprice.io',
        region: null,
        publicApiUrls: {},
        portalHost: 'portal-dev.flexprice.io',
      }),
    ).toBe('https://portal-dev.flexprice.io/?token=tok')
  })
})

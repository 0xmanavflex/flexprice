import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SURFACE_HOSTS,
  parseSurfaceHosts,
  surfaceFor,
  surfacePath,
  configuredPortalHost,
} from './surface'

const at = (url: string) => {
  const { hostname, pathname } = new URL(url)
  return { hostname, pathname }
}

describe('surfaceFor', () => {
  it.each([
    // The host names the surface; the whole path belongs to it.
    ['https://invoice.flexprice.io/us/tok_1', 'invoice', ''],
    ['https://invoices.flexprice.io/in/tok_1', 'invoice', ''],
    ['https://INVOICE.flexprice.io/us/tok_1', 'invoice', ''],
    ['https://portal.flexprice.io/us', 'portal', ''],
    ['https://billing.flexprice.io/in/usage', 'portal', ''],
    ['https://PORTAL.flexprice.io/us', 'portal', ''],
    // Any other host: the path prefix decides.
    ['https://app.flexprice.io/i/us/tok_1', 'invoice', '/i'],
    ['http://localhost:3000/i/us/tok_1', 'invoice', '/i'],
    ['https://app.flexprice.io/p/us', 'portal', '/p'],
    ['http://localhost:3000/p/us/invoices', 'portal', '/p'],
    ['https://portal-git-x.vercel.app/p', 'portal', '/p'],
    // Everything else is the console, including paths that only start with "i" or "p".
    ['https://app.flexprice.io/invoices', 'console', ''],
    ['https://app.flexprice.io/integrations', 'console', ''],
    ['https://app.flexprice.io/plans', 'console', ''],
    ['https://app.flexprice.io/pricing', 'console', ''],
    ['https://app.flexprice.io/', 'console', ''],
    ['http://localhost:3000/customers/cust_1', 'console', ''],
  ])('%s → %s', (url, surface, basePath) => {
    expect(surfaceFor(at(url))).toEqual({ surface, basePath })
  })

  it('uses the configured hosts instead of the defaults', () => {
    const hosts = { invoice: ['invoice-dev.flexprice.io'], portal: ['portal.staging.flexprice.io'] }
    expect(surfaceFor(at('https://portal.staging.flexprice.io/us'), hosts).surface).toBe('portal')
    expect(surfaceFor(at('https://portal.flexprice.io/us'), hosts).surface).toBe('console')
    expect(surfaceFor(at('https://invoice-dev.flexprice.io/in/t'), hosts).surface).toBe('invoice')
    expect(surfaceFor(at('https://invoice.flexprice.io/us/t'), hosts).surface).toBe('console')
  })
})

describe('surfacePath', () => {
  it('strips the prefix that selected the surface', () => {
    expect(surfacePath('/p/us/usage', '/p')).toBe('/us/usage')
    expect(surfacePath('/i/us/tok_1', '/i')).toBe('/us/tok_1')
    expect(surfacePath('/p', '/p')).toBe('/')
    expect(surfacePath('/us', '')).toBe('/us')
  })
})

describe('parseSurfaceHosts', () => {
  it('replaces a named surface', () => {
    expect(parseSurfaceHosts('{"invoice":["Invoice-Dev.flexprice.io"]}')).toEqual({
      invoice: ['invoice-dev.flexprice.io'],
      portal: DEFAULT_SURFACE_HOSTS.portal,
    })
  })

  it('falls back to the defaults on anything unreadable', () => {
    expect(parseSurfaceHosts(undefined)).toBe(DEFAULT_SURFACE_HOSTS)
    expect(parseSurfaceHosts('{')).toBe(DEFAULT_SURFACE_HOSTS)
    expect(parseSurfaceHosts('"x"')).toBe(DEFAULT_SURFACE_HOSTS)
    expect(parseSurfaceHosts('{"portal":"one.host"}')).toEqual(DEFAULT_SURFACE_HOSTS)
  })
})

describe('configuredPortalHost', () => {
  it('is the first portal host named explicitly, and nothing otherwise', () => {
    expect(configuredPortalHost('{"portal":["Portal-Dev.flexprice.io"]}')).toBe(
      'portal-dev.flexprice.io',
    )
    expect(configuredPortalHost('{"invoice":["invoice-dev.flexprice.io"]}')).toBeNull()
    expect(configuredPortalHost(undefined)).toBeNull()
    expect(configuredPortalHost('not json')).toBeNull()
  })
})

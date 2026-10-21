import { describe, expect, it } from 'vitest'
import { DEFAULT_SURFACE_HOSTS, parseSurfaceHosts, surfaceFor, surfacePath } from './surface'

const at = (url: string) => {
  const { hostname, pathname } = new URL(url)
  return { hostname, pathname }
}

describe('surfaceFor', () => {
  it.each([
    // The host names the surface; the whole path belongs to it.
    ['https://portal.flexprice.io/us', 'portal', ''],
    ['https://billing.flexprice.io/in/usage', 'portal', ''],
    ['https://PORTAL.flexprice.io/us', 'portal', ''],
    // Any other host: the path prefix decides.
    ['https://app.flexprice.io/p/us', 'portal', '/p'],
    ['http://localhost:3000/p/us/invoices', 'portal', '/p'],
    ['https://portal-git-x.vercel.app/p', 'portal', '/p'],
    // Everything else is the console, including paths that only start with "p".
    ['https://app.flexprice.io/plans', 'console', ''],
    ['https://app.flexprice.io/pricing', 'console', ''],
    ['https://app.flexprice.io/', 'console', ''],
    ['http://localhost:3000/customers/cust_1', 'console', ''],
  ])('%s → %s', (url, surface, basePath) => {
    expect(surfaceFor(at(url))).toEqual({ surface, basePath })
  })

  it('uses the configured hosts instead of the defaults', () => {
    const hosts = { portal: ['portal.staging.flexprice.io'] }
    expect(surfaceFor(at('https://portal.staging.flexprice.io/us'), hosts).surface).toBe('portal')
    expect(surfaceFor(at('https://portal.flexprice.io/us'), hosts).surface).toBe('console')
  })
})

describe('surfacePath', () => {
  it('strips the prefix that selected the surface', () => {
    expect(surfacePath('/p/us/usage', '/p')).toBe('/us/usage')
    expect(surfacePath('/p', '/p')).toBe('/')
    expect(surfacePath('/us', '')).toBe('/us')
  })
})

describe('parseSurfaceHosts', () => {
  it('replaces a named surface', () => {
    expect(parseSurfaceHosts('{"portal":["Portal.Staging.flexprice.io"]}')).toEqual({
      portal: ['portal.staging.flexprice.io'],
    })
  })

  it('falls back to the defaults on anything unreadable', () => {
    expect(parseSurfaceHosts(undefined)).toBe(DEFAULT_SURFACE_HOSTS)
    expect(parseSurfaceHosts('{')).toBe(DEFAULT_SURFACE_HOSTS)
    expect(parseSurfaceHosts('"x"')).toBe(DEFAULT_SURFACE_HOSTS)
    expect(parseSurfaceHosts('{"portal":"one.host"}')).toEqual(DEFAULT_SURFACE_HOSTS)
  })
})

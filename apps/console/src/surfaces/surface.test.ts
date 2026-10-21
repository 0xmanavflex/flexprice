import { describe, expect, it } from 'vitest'
import { DEFAULT_SURFACE_HOSTS, parseSurfaceHosts, surfaceFor, surfacePath } from './surface'

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
    // Any other host: the path prefix decides.
    ['https://app.flexprice.io/i/us/tok_1', 'invoice', '/i'],
    ['http://localhost:3000/i/us/tok_1', 'invoice', '/i'],
    ['https://portal-git-x.vercel.app/i', 'invoice', '/i'],
    // Everything else is the console, including paths that only start with "i".
    ['https://app.flexprice.io/invoices', 'console', ''],
    ['https://app.flexprice.io/integrations', 'console', ''],
    ['https://app.flexprice.io/', 'console', ''],
    ['http://localhost:3000/customers/cust_1', 'console', ''],
  ])('%s → %s', (url, surface, basePath) => {
    expect(surfaceFor(at(url))).toEqual({ surface, basePath })
  })

  it('uses the configured hosts instead of the defaults', () => {
    const hosts = { invoice: ['invoice.staging.flexprice.io'] }
    expect(surfaceFor(at('https://invoice.staging.flexprice.io/us/t'), hosts).surface).toBe(
      'invoice',
    )
    expect(surfaceFor(at('https://invoice.flexprice.io/us/t'), hosts).surface).toBe('console')
  })
})

describe('surfacePath', () => {
  it('strips the prefix that selected the surface', () => {
    expect(surfacePath('/i/us/tok_1', '/i')).toBe('/us/tok_1')
    expect(surfacePath('/i', '/i')).toBe('/')
  })

  it('leaves a host-matched path alone', () => {
    expect(surfacePath('/us/tok_1', '')).toBe('/us/tok_1')
  })
})

describe('parseSurfaceHosts', () => {
  it('replaces a named surface and keeps the defaults otherwise', () => {
    expect(parseSurfaceHosts('{"invoice":["Invoice.Staging.flexprice.io"]}')).toEqual({
      invoice: ['invoice.staging.flexprice.io'],
    })
  })

  it('falls back to the defaults for nothing, bad JSON or the wrong shape', () => {
    expect(parseSurfaceHosts(undefined)).toBe(DEFAULT_SURFACE_HOSTS)
    expect(parseSurfaceHosts('{')).toBe(DEFAULT_SURFACE_HOSTS)
    expect(parseSurfaceHosts('"x"')).toBe(DEFAULT_SURFACE_HOSTS)
    expect(parseSurfaceHosts('{"invoice":"one.host"}')).toEqual(DEFAULT_SURFACE_HOSTS)
  })
})

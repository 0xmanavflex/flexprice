import { describe, expect, it } from 'vitest'
import routerSource from '../router.tsx?raw'
import { ROUTE_ACCESS, routeAccessFor } from './routeAccess'

/** Signed-out routes, outside the shell: no principal to check. */
const PUBLIC = new Set([
  '/sign-in',
  '/sign-up',
  '/sign-up/confirm',
  '/auth/callback',
  '/auth/signup/confirmation',
  '/forgot-password',
  '/reset-password',
  '/set-password',
  '/auth',
])

const routePaths = [
  ...[...routerSource.matchAll(/path: '([^']+)'/g)].map((m) => m[1]!),
  ...[...routerSource.matchAll(/\['(\/[^']+)', '[^']+'\]/g)].map((m) => m[1]!),
].filter((path) => !PUBLIC.has(path))

describe('ROUTE_ACCESS', () => {
  it('governs every shell route in the router', () => {
    const missing = routePaths.filter((path) => !(path in ROUTE_ACCESS))
    expect(missing).toEqual([])
  })

  it('gates list and detail pages with read, and create and edit pages with write (as V1)', () => {
    expect(routeAccessFor('/plans').require).toEqual({ entity: 'plan', action: 'read' })
    expect(routeAccessFor('/plans/new').require).toEqual({ entity: 'plan', action: 'write' })
    expect(routeAccessFor('/customers/$customerId/contracts/new').require?.entity).toBe(
      'subscription',
    )
    expect(routeAccessFor('/credit-memos').require?.action).toEqual(['read', 'write'])
  })

  it('leaves V1’s ungated pages open, and an unknown path open', () => {
    expect(routeAccessFor('/').require).toBeUndefined()
    expect(routeAccessFor('/settings').require).toBeUndefined()
    expect(routeAccessFor('/nowhere')).toEqual({})
  })
})

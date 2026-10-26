import { describe, expect, it, vi } from 'vitest'
import type * as React from 'react'
import type * as ReactQuery from '@tanstack/react-query'

/**
 * The first-load bug: `/rbac/roles` needs `X-Environment-ID`. Fetched before
 * the shell had chosen an environment, it went out without the header, came
 * back 403, and the page read "Access denied" until a reload. The catalogue
 * must not be requested until an environment is known.
 */
const recorded = vi.hoisted(() => ({ queries: [] as { queryKey: unknown[]; enabled?: boolean }[] }))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useMemo: (factory: () => unknown) => factory(),
}))
vi.mock('./provider', () => ({
  useFlexprice: () => ({ rbac: { listRbacRoles: () => Promise.resolve({ roles: [] }) } }),
  useFlexpriceServerURL: () => 'https://api.example.test',
}))
vi.mock(
  '@tanstack/react-query',
  () =>
    ({
      useQuery: (options: { queryKey: unknown[]; enabled?: boolean }) => {
        recorded.queries.push(options)
        return { data: undefined, isError: false, refetch: () => Promise.resolve() }
      },
    }) as unknown as typeof ReactQuery,
)

const { useAccessControl } = await import('./access')

function catalogueQuery() {
  return recorded.queries.filter((q) => q.queryKey.includes('accessRoles')).at(-1)
}

describe('useAccessControl: the role catalogue', () => {
  it('is not requested before an environment is chosen, so it cannot 403', () => {
    const access = useAccessControl('jwt', { environmentId: null })
    expect(catalogueQuery()?.enabled).toBe(false)
    // Waiting, not denied.
    expect(access.status).toBe('loading')
  })

  it('is requested once there is an environment', () => {
    useAccessControl('jwt', { environmentId: 'env_1' })
    expect(catalogueQuery()?.enabled).toBe(true)
  })

  it('is keyed by session, not environment: switching keeps it', () => {
    useAccessControl('jwt', { environmentId: 'env_1' })
    const first = catalogueQuery()?.queryKey
    useAccessControl('jwt', { environmentId: 'env_2' })
    expect(catalogueQuery()?.queryKey).toEqual(first)
  })
})

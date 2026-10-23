import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as ReactQuery from '@tanstack/react-query'
import { EnvironmentType } from '@fp/domain'
import { queryKeys } from './keys'

/**
 * The session hooks, without a browser.
 *
 * `features.test.ts` and `plans.test.ts` test pure mappers, which needs no
 * harness at all. These are hooks, and this package has no renderer to run them
 * in — its vitest environment is `node`, and neither `react-dom` nor a testing
 * library is a dependency. Adding one to assert `enabled: false` would be a
 * browser, a DOM and a render loop bought to read a boolean.
 *
 * So only the thinnest possible seam is replaced: `useQuery`, `useMutation` and
 * `useQueryClient` — the three functions that need React — are recorders, and
 * everything else is the real thing. What each hook *configures* is what is
 * under test here, and it is where these bugs live: a key that forgets the
 * token, a guard that lets a signed-out request fire, a mapper that calls a
 * production environment a sandbox.
 *
 * Calling a hook outside a render is exactly what `react-hooks/rules-of-hooks`
 * exists to prevent, and it is safe here for the reason the rule is not:
 * React's call-ordering invariant needs a React, and there is none in this
 * process — only the plain functions the hooks compile down to.
 *
 * The one claim a recorder cannot make on its own — that `enabled: false`
 * actually prevents a request — is made by handing the recorded options to the
 * *real* `QueryObserver`, the same machinery `useQuery` drives, and watching a
 * stubbed `fetch` stay untouched. That is the `client.test.ts` spirit: stub the
 * edge, drive the real thing.
 */

const SERVER = 'https://api.test.flexprice.io/v1'

interface RecordedQuery {
  queryKey: readonly unknown[]
  queryFn: () => Promise<unknown>
  enabled?: boolean
  staleTime?: number
}

interface RecordedMutation {
  mutationFn: (variables: never) => Promise<unknown>
  onSuccess?: () => void
}

// Hoisted with the `vi.mock` factories that close over it: the factories run
// when `./session` is first imported, which is before this file's body.
const recorded = vi.hoisted(() => ({
  queries: [] as RecordedQuery[],
  mutations: [] as RecordedMutation[],
  invalidated: [] as unknown[],
  updated: [] as unknown[],
}))

vi.mock('./provider', () => ({
  // The hooks read the server URL from context; context needs a renderer.
  useFlexpriceServerURL: () => SERVER,
}))

vi.mock('@tanstack/react-query', () => {
  const useQuery = (options: RecordedQuery) => {
    recorded.queries.push(options)
    return { data: undefined, status: 'pending' }
  }
  const useMutation = (options: RecordedMutation) => {
    recorded.mutations.push(options)
    return { mutate: () => undefined }
  }
  const useQueryClient = () => ({
    invalidateQueries: (filters: { queryKey: unknown }) => {
      recorded.invalidated.push(filters.queryKey)
      return Promise.resolve()
    },
    // A create also writes the new environment into every cached list, so the
    // switcher can select it before the refetch lands.
    setQueriesData: (filters: { queryKey: unknown }) => {
      recorded.updated.push(filters.queryKey)
    },
  })
  return {
    useQuery,
    useMutation,
    useQueryClient,
  } as unknown as typeof ReactQuery
})

import {
  toEnvironment,
  useCreateEnvironment,
  useCurrentUser,
  useEnvironmentList,
  useRenameEnvironment,
  useSignIn,
} from './session'

function lastQuery(): RecordedQuery {
  const options = recorded.queries.at(-1)
  if (!options) throw new Error('The hook did not configure a query.')
  return options
}

function lastMutation(): RecordedMutation {
  const options = recorded.mutations.at(-1)
  if (!options) throw new Error('The hook did not configure a mutation.')
  return options
}

/** A stubbed `fetch` that records what was asked of it. */
function stubFetch(respond: () => Response) {
  const seen: Request[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input as RequestInfo, init))
    return respond()
  })
  return seen
}

function json(body: unknown, status = 200): () => Response {
  return () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
}

afterEach(() => {
  recorded.queries.length = 0
  recorded.mutations.length = 0
  recorded.invalidated.length = 0
  recorded.updated.length = 0
  vi.unstubAllGlobals()
})

describe('toEnvironment', () => {
  it('recognises the API’s production environment', () => {
    expect(toEnvironment({ id: 'env_1', name: 'Production', type: 'production' })).toEqual({
      id: 'env_1',
      name: 'Production',
      type: EnvironmentType.Production,
    })
  })

  /**
   * Everything else is a sandbox, deliberately and asymmetrically.
   *
   * Mislabelling production as a sandbox costs a badge that looks wrong.
   * Mislabelling a sandbox as production costs someone editing live pricing
   * while believing they are not. The default belongs on the side of the
   * cheaper mistake, so an unrecognised string — a new environment kind, a
   * casing change, a typo, nothing at all — lands on sandbox.
   */
  it.each([
    ['the API’s own second kind', 'development'],
    ['a kind this client has not been taught', 'staging'],
    ['an empty string', ''],
    // Case matters: the comparison is exact, so an API that starts shouting
    // downgrades to sandbox rather than silently promoting one.
    ['a shouted production', 'PRODUCTION'],
    ['a near miss', 'prod'],
  ])('treats %s as a sandbox', (_name, type) => {
    expect(toEnvironment({ id: 'env_2', name: 'Other', type }).type).toBe(EnvironmentType.Sandbox)
  })

  it('carries the id and name through untouched', () => {
    expect(toEnvironment({ id: 'env_3', name: 'QA', type: 'development' })).toMatchObject({
      id: 'env_3',
      name: 'QA',
    })
  })
})

describe('useCurrentUser', () => {
  it('keys the cache entry by the token, under the session prefix', () => {
    useCurrentUser('token-a')

    expect(lastQuery().queryKey).toEqual([...queryKeys.session.current(), 'token-a'])
  })

  /**
   * Two sessions must not read each other's entry.
   *
   * A key of `['session','current']` alone would hand the previous user's name
   * and tenant to whoever signs in next on the same tab — the cache outlives
   * the sign-out unless someone remembers to clear it. Keying on the token
   * makes the isolation structural instead of a `clear()` in a `signOut`.
   */
  it('gives two different sessions two different cache entries', () => {
    useCurrentUser('token-a')
    const first = lastQuery().queryKey
    useCurrentUser('token-b')
    const second = lastQuery().queryKey

    expect(first).not.toEqual(second)
    // And neither is the signed-out entry.
    useCurrentUser(null)
    expect(lastQuery().queryKey).not.toEqual(first)
  })

  it('stays under the prefix, so one invalidation still covers every session', () => {
    useCurrentUser('token-a')

    const prefix = queryKeys.session.current()
    expect(lastQuery().queryKey.slice(0, prefix.length)).toEqual([...prefix])
  })

  it.each([
    ['no token at all', null],
    ['an empty token', ''],
  ])('is disabled with %s', (_name, token) => {
    useCurrentUser(token)

    expect(lastQuery().enabled).toBe(false)
  })

  it('is enabled once there is a token', () => {
    useCurrentUser('token-a')

    expect(lastQuery().enabled).toBe(true)
  })

  it('sends the token to /users/me when it does run', async () => {
    const seen = stubFetch(json({ id: 'user_1', email: 'a@b.com', tenant: { id: 't', name: 'A' } }))
    useCurrentUser('token-a')

    await expect(lastQuery().queryFn()).resolves.toMatchObject({ id: 'user_1', tenantId: 't' })

    expect(seen[0]?.url).toBe(`${SERVER}/users/me`)
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer token-a')
  })
})

describe('useEnvironmentList', () => {
  it('keys the list by the token too', () => {
    useEnvironmentList('token-a')

    expect(lastQuery().queryKey).toEqual([...queryKeys.session.environments(), 'token-a'])
  })

  it('does not share a cache entry with the current-user query', () => {
    useCurrentUser('token-a')
    const user = lastQuery().queryKey
    useEnvironmentList('token-a')

    expect(lastQuery().queryKey).not.toEqual(user)
  })

  it.each([
    ['no token at all', null],
    ['an empty token', ''],
  ])('is disabled with %s', (_name, token) => {
    useEnvironmentList(token)

    expect(lastQuery().enabled).toBe(false)
  })

  it('maps the rows through toEnvironment', async () => {
    stubFetch(
      json({
        environments: [
          { id: 'env_1', name: 'Production', type: 'production' },
          { id: 'env_2', name: 'Sandbox', type: 'development' },
          { id: 'env_3', name: 'Mystery', type: 'quantum' },
        ],
      }),
    )
    useEnvironmentList('token-a')

    await expect(lastQuery().queryFn()).resolves.toEqual([
      { id: 'env_1', name: 'Production', type: EnvironmentType.Production },
      { id: 'env_2', name: 'Sandbox', type: EnvironmentType.Sandbox },
      { id: 'env_3', name: 'Mystery', type: EnvironmentType.Sandbox },
    ])
  })
})

/**
 * The guard, proved against the real machinery.
 *
 * `enabled: false` is only a promise until something honours it. These hand
 * the recorded options to the actual `QueryObserver` — what `useQuery` is a
 * React binding over — and watch whether a request leaves.
 */
describe('a signed-out session', () => {
  async function observe(options: RecordedQuery) {
    const { QueryClient, QueryObserver } =
      await vi.importActual<typeof ReactQuery>('@tanstack/react-query')

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const observer = new QueryObserver(client, {
      queryKey: options.queryKey,
      queryFn: options.queryFn,
      enabled: options.enabled ?? true,
    })
    const unsubscribe = observer.subscribe(() => undefined)
    // A fetch, were one going to happen, is scheduled on mount.
    await Promise.resolve()
    const result = observer.getCurrentResult()
    unsubscribe()
    client.clear()
    return result
  }

  it.each([
    ['the current user', useCurrentUser],
    ['the environment list', useEnvironmentList],
  ])('fires no request for %s', async (_name, hook) => {
    // An unauthenticated `/users/me` is a 401, and a 401 on first paint is how
    // a sign-in page ends up flashing an error nobody caused.
    const seen = stubFetch(json({}))
    hook(null)

    const result = await observe(lastQuery())

    expect(seen).toHaveLength(0)
    // Not an error and not a spinner either: nothing was asked, so there is
    // nothing to report.
    expect(result.fetchStatus).toBe('idle')
    expect(result.status).toBe('pending')
    expect(result.error).toBeNull()
  })

  it('does fire once a token arrives, so the guard is not simply off', async () => {
    const seen = stubFetch(json({ environments: [] }))
    useEnvironmentList('token-a')

    await observe(lastQuery())

    expect(seen).toHaveLength(1)
    expect(seen[0]?.url).toBe(`${SERVER}/environments`)
  })
})

describe('useSignIn', () => {
  it('exchanges the credentials for a token', async () => {
    const seen = stubFetch(json({ token: 'jwt-xyz', user_id: 'u1', tenant_id: 't1' }))
    useSignIn()

    await expect(
      lastMutation().mutationFn({ email: 'a@b.com', password: 'hunter2' } as never),
    ).resolves.toEqual({ token: 'jwt-xyz', userId: 'u1', tenantId: 't1' })

    expect(seen[0]?.url).toBe(`${SERVER}/auth/login`)
    await expect(seen[0]?.json()).resolves.toEqual({ email: 'a@b.com', password: 'hunter2' })
  })

  it('is a mutation, not a query — nothing about it is cached or refetched', () => {
    useSignIn()

    expect(recorded.mutations).toHaveLength(1)
    expect(recorded.queries).toHaveLength(0)
  })

  it('lets the API’s rejection message through for the form to render', async () => {
    // The form shows one sentence about what went wrong, so the sentence has to
    // survive the trip rather than being flattened to "Request failed".
    stubFetch(json({ success: false, error: { message: 'email or password is incorrect' } }, 401))
    useSignIn()

    await expect(
      lastMutation().mutationFn({ email: 'a@b.com', password: 'wrong' } as never),
    ).rejects.toThrow('email or password is incorrect')
  })
})

describe('useCreateEnvironment', () => {
  it('creates and maps the new environment', async () => {
    const seen = stubFetch(json({ id: 'env_9', name: 'Staging', type: 'development' }))
    useCreateEnvironment('token-a')

    await expect(
      lastMutation().mutationFn({ name: 'Staging', type: 'development' } as never),
    ).resolves.toEqual({ id: 'env_9', name: 'Staging', type: EnvironmentType.Sandbox })

    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer token-a')
  })

  it('refuses while signed out rather than sending a header it does not have', async () => {
    // `Bearer null` comes back a 401, which reads to the user as "that name is
    // wrong" — a misdiagnosis of their own dialog.
    const seen = stubFetch(json({}))
    useCreateEnvironment(null)

    await expect(
      lastMutation().mutationFn({ name: 'Staging', type: 'development' } as never),
    ).rejects.toThrow('Sign in to create an environment.')

    expect(seen).toHaveLength(0)
  })

  it('invalidates the environment list at the prefix, so every session’s entry refetches', () => {
    useCreateEnvironment('token-a')
    lastMutation().onSuccess?.()

    // The list's own key is token-scoped; invalidating the untokened prefix is
    // what reaches it. If the mutation invalidated a token-specific key, the
    // entry the switcher reads would be the one left stale.
    useEnvironmentList('token-a')
    const listKey = lastQuery().queryKey
    const invalidated = recorded.invalidated[0] as readonly unknown[]

    expect(invalidated).toEqual([...queryKeys.session.environments()])
    expect(listKey.slice(0, invalidated.length)).toEqual([...invalidated])
    // The cached lists are written at the same prefix, before the refetch.
    expect(recorded.updated[0]).toEqual([...queryKeys.session.environments()])
  })
})

describe('useRenameEnvironment', () => {
  it('puts the new name to the environment and maps the result', async () => {
    const seen = stubFetch(json({ id: 'env_9', name: 'EU staging', type: 'production' }))
    useRenameEnvironment('token-a')

    await expect(
      lastMutation().mutationFn({ id: 'env_9', name: 'EU staging' } as never),
    ).resolves.toEqual({ id: 'env_9', name: 'EU staging', type: EnvironmentType.Production })

    expect(seen[0]?.method).toBe('PUT')
    expect(seen[0]?.url).toBe(`${SERVER}/environments/env_9`)
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer token-a')
  })

  it('refuses while signed out', async () => {
    const seen = stubFetch(json({}))
    useRenameEnvironment(null)

    await expect(
      lastMutation().mutationFn({ id: 'env_9', name: 'EU staging' } as never),
    ).rejects.toThrow('Sign in to rename an environment.')
    expect(seen).toHaveLength(0)
  })

  it('invalidates the environment list', () => {
    useRenameEnvironment('token-a')
    lastMutation().onSuccess?.()

    expect(recorded.invalidated[0]).toEqual([...queryKeys.session.environments()])
  })
})

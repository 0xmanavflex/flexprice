import { describe, expect, it, vi } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { ApiError, ErrorKind } from '@fp/api'
import {
  MAX_RETRY_AFTER_MS,
  createQueryClient,
  createQueryKeyHash,
  retryDelay,
  shouldRetry,
  shouldThrowOnError,
} from './client'
import { describeFreshness } from './freshness'
import { COUNT_CONCURRENCY, mapBounded } from './featureLinkage'
import { scheduleSettle } from './useDebouncedValue'
import { queryKeys } from './keys'

describe('retry policy', () => {
  // The payoff from normalizing errors: the client can tell a flaky network
  // from a refusal, so it stops asking a question already answered.
  it.each([
    ['a refusal', ErrorKind.Forbidden],
    ['an expired session', ErrorKind.Unauthorized],
    ['a missing record', ErrorKind.NotFound],
    ['bad input', ErrorKind.Invalid],
  ])('does not retry %s', (_label, kind) => {
    expect(shouldRetry(0, new ApiError(kind, 'no'))).toBe(false)
  })

  it.each([
    ['a network drop', ErrorKind.Network],
    ['a server fault', ErrorKind.Server],
  ])('retries %s, up to three times', (_label, kind) => {
    const error = new ApiError(kind, 'transient')

    expect(shouldRetry(0, error)).toBe(true)
    expect(shouldRetry(2, error)).toBe(true)
    expect(shouldRetry(3, error)).toBe(false)
  })

  it('retries a timeout once: a second full wait is the most a person should sit through', () => {
    const error = new ApiError(ErrorKind.Timeout, 'slow')

    expect(shouldRetry(0, error)).toBe(true)
    expect(shouldRetry(1, error)).toBe(false)
  })

  it('never retries a cancelled request', () => {
    expect(shouldRetry(0, new ApiError(ErrorKind.Cancelled, 'gone'))).toBe(false)
  })

  describe('when rate limited', () => {
    const limited = (retryAfterMs?: number) =>
      new ApiError(ErrorKind.RateLimited, 'slow down', {
        status: 429,
        ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
      })

    it('retries only when the API said when to come back', () => {
      expect(shouldRetry(0, limited(2_000))).toBe(true)
      expect(shouldRetry(0, limited())).toBe(false)
    })

    it('does not wait out a long ban', () => {
      expect(shouldRetry(0, limited(MAX_RETRY_AFTER_MS))).toBe(true)
      expect(shouldRetry(0, limited(MAX_RETRY_AFTER_MS + 1))).toBe(false)
    })

    it('gives up after two attempts, so a limiter is not hammered', () => {
      expect(shouldRetry(1, limited(1_000))).toBe(true)
      expect(shouldRetry(2, limited(1_000))).toBe(false)
    })
  })

  it('does not retry something it cannot classify', () => {
    expect(shouldRetry(0, new Error('who knows'))).toBe(false)
    expect(shouldRetry(0, 'a string')).toBe(false)
  })
})

describe('query keys', () => {
  it('nests detail and list keys under the entity, so a prefix invalidates both', () => {
    const all = queryKeys.customers.all()

    for (const key of [queryKeys.customers.detail('cus_1'), queryKeys.customers.list({ q: 'a' })]) {
      expect(key.slice(0, all.length)).toEqual([...all])
    }
  })

  it('distinguishes lists by their filter', () => {
    expect(queryKeys.customers.list({ page: 1 })).not.toEqual(queryKeys.customers.list({ page: 2 }))
  })

  it('is stable for the same filter, so a re-render does not refetch', () => {
    expect(queryKeys.customers.list({ page: 1 })).toEqual(queryKeys.customers.list({ page: 1 }))
  })
})

describe('retry delay', () => {
  const server = new ApiError(ErrorKind.Server, 'down')

  it('grows with each failure and never exceeds its ceiling', () => {
    const top = (n: number) => retryDelay(n, server, () => 1)

    expect(top(0)).toBe(500)
    expect(top(1)).toBe(1_000)
    expect(top(2)).toBe(2_000)
    expect(top(10)).toBe(8_000)
  })

  it('jitters, but never to zero and never past the ceiling', () => {
    expect(retryDelay(2, server, () => 0)).toBe(1_000)
    expect(retryDelay(2, server, () => 0.5)).toBe(1_500)
    expect(retryDelay(2, server, () => 1)).toBe(2_000)
  })

  it('waits exactly as long as the API asked when rate limited', () => {
    const limited = new ApiError(ErrorKind.RateLimited, 'x', { retryAfterMs: 4_000 })

    expect(retryDelay(0, limited)).toBe(4_000)
  })

  it('caps a hostile Retry-After', () => {
    const limited = new ApiError(ErrorKind.RateLimited, 'x', { retryAfterMs: 3_600_000 })

    expect(retryDelay(0, limited)).toBe(MAX_RETRY_AFTER_MS)
  })
})

describe('throwing to the error boundary', () => {
  const server = new ApiError(ErrorKind.Server, 'down')
  const empty = { state: { data: undefined } }
  const loaded = { state: { data: [{ id: 'cus_1' }] } }

  it('throws a server fault when there is nothing to show', () => {
    expect(shouldThrowOnError(server, empty)).toBe(true)
  })

  // A failed refresh must not replace rows the person is looking at.
  it('does not throw a server fault when data is already on screen', () => {
    expect(shouldThrowOnError(server, loaded)).toBe(false)
  })

  it('keeps empty-but-present data (a real zero rows) on screen too', () => {
    expect(shouldThrowOnError(server, { state: { data: [] } })).toBe(false)
  })

  it.each([ErrorKind.Network, ErrorKind.Timeout, ErrorKind.Forbidden, ErrorKind.NotFound])(
    'leaves %s to the page, which can say something specific',
    (kind) => {
      expect(shouldThrowOnError(new ApiError(kind, 'x'), empty)).toBe(false)
    },
  )

  it('is wired into the client defaults', () => {
    const queries = createQueryClient().getDefaultOptions().queries

    expect(queries?.throwOnError).toBe(shouldThrowOnError)
  })
})

describe('offline', () => {
  // A paused query keeps the previous rows under a new search with no notice;
  // a failed one tells the page there is nothing current to show.
  it('runs a query while offline, so it fails instead of pausing', async () => {
    onlineManager.setOnline(false)
    try {
      const queryFn = vi.fn(async () => {
        throw new ApiError(ErrorKind.Network, 'Could not reach Flexprice.')
      })
      await expect(
        createQueryClient().fetchQuery({ queryKey: ['customers'], queryFn, retry: false }),
      ).rejects.toThrow('Could not reach Flexprice.')
      expect(queryFn).toHaveBeenCalledTimes(1)
    } finally {
      onlineManager.setOnline(true)
    }
  })
})

describe('environment scoping', () => {
  const hashIn = (environment: string | null, key: readonly unknown[]) =>
    createQueryKeyHash(() => environment)(key)

  it('gives two environments different cache entries for the same key', () => {
    const key = queryKeys.invoices.list({ page: 1 })

    expect(hashIn('env_prod', key)).not.toBe(hashIn('env_sandbox', key))
  })

  it('is stable within one environment, so a re-render does not refetch', () => {
    const key = queryKeys.invoices.list({ page: 1 })

    expect(hashIn('env_prod', key)).toBe(hashIn('env_prod', key))
  })

  it('leaves the signed-in user alone: the environment list is not per environment', () => {
    const key = queryKeys.session.environments()

    expect(hashIn('env_prod', key)).toBe(hashIn('env_sandbox', key))
  })

  it('does no scoping when it is not told where the environment comes from', () => {
    const key = queryKeys.customers.list({})

    expect(createQueryKeyHash()(key)).toBe(createQueryKeyHash()(key))
  })

  it('reads the environment when the key is hashed, so a switch takes effect at once', () => {
    let active: string | null = 'env_a'
    const hash = createQueryKeyHash(() => active)
    const key = queryKeys.plans.list({})

    const before = hash(key)
    active = 'env_b'

    expect(hash(key)).not.toBe(before)
  })

  it('keeps prefix invalidation working: the keys themselves are unchanged', async () => {
    let active: string | null = 'env_a'
    const client = createQueryClient({ getEnvironmentId: () => active })
    client.setQueryData(queryKeys.customers.list({ page: 1 }), 'a-list')
    client.setQueryData(queryKeys.customers.detail('cus_1'), 'a-detail')
    active = 'env_b'
    client.setQueryData(queryKeys.customers.list({ page: 1 }), 'b-list')

    await client.invalidateQueries({ queryKey: queryKeys.customers.all(), refetchType: 'none' })

    const states = client
      .getQueryCache()
      .findAll({ queryKey: queryKeys.customers.all() })
      .map((query) => query.state.isInvalidated)
    expect(states).toEqual([true, true, true])
  })

  it("never serves one environment the other environment's data", () => {
    let active: string | null = 'env_a'
    const client = createQueryClient({ getEnvironmentId: () => active })
    const key = queryKeys.invoices.list({ page: 1 })
    client.setQueryData(key, 'env_a rows')

    active = 'env_b'

    expect(client.getQueryData(key)).toBeUndefined()
    active = 'env_a'
    expect(client.getQueryData(key)).toBe('env_a rows')
  })
})

describe('describeFreshness', () => {
  const base = {
    isFetching: false,
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    data: [] as unknown,
    dataUpdatedAt: 1_000,
  }

  it('is quiet when the data is simply current', () => {
    expect(describeFreshness(base)).toEqual({
      refreshing: false,
      stale: false,
      provisional: false,
      updatedAt: 1_000,
    })
  })

  it('is not "refreshing" during the first load: that is a skeleton, not a refresh', () => {
    expect(
      describeFreshness({ ...base, isFetching: true, isPending: true, data: undefined }).refreshing,
    ).toBe(false)
  })

  it('is refreshing when a fetch runs over data already shown', () => {
    expect(describeFreshness({ ...base, isFetching: true }).refreshing).toBe(true)
  })

  it('is stale when a refresh failed but earlier data survives', () => {
    expect(describeFreshness({ ...base, isError: true }).stale).toBe(true)
  })

  it('is an error, not stale, when nothing was ever loaded', () => {
    expect(describeFreshness({ ...base, isError: true, data: undefined }).stale).toBe(false)
  })

  it('is provisional while the previous page stands in for the next', () => {
    expect(
      describeFreshness({ ...base, isPlaceholderData: true, isFetching: true }).provisional,
    ).toBe(true)
  })
})

describe('useDebouncedValue timing', () => {
  it('settles after the delay, and not before', async () => {
    const settled: string[] = []
    scheduleSettle(() => settled.push('x'), 30)

    expect(settled).toEqual([])
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(settled).toEqual(['x'])
  })

  it('does not settle once cancelled, which is what a newer keystroke does', async () => {
    const settled: string[] = []
    const cancel = scheduleSettle(() => settled.push('x'), 30)
    cancel()

    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(settled).toEqual([])
  })

  it('settles at once for a zero delay', () => {
    const settled: string[] = []
    scheduleSettle(() => settled.push('x'), 0)

    expect(settled).toEqual(['x'])
  })
})

describe('bounded concurrency', () => {
  it('never runs more than the limit at once, and keeps input order', async () => {
    let running = 0
    let peak = 0
    const items = Array.from({ length: 10 }, (_, index) => index)

    const results = await mapBounded(items, COUNT_CONCURRENCY, async (item) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
      return item * 2
    })

    expect(peak).toBe(COUNT_CONCURRENCY)
    expect(results).toEqual(items.map((item) => item * 2))
  })

  it('stops starting new work once aborted', async () => {
    const controller = new AbortController()
    const started: number[] = []

    await mapBounded(
      [1, 2, 3, 4, 5, 6],
      1,
      async (item) => {
        started.push(item)
        if (item === 2) controller.abort()
      },
      controller.signal,
    )

    expect(started).toEqual([1, 2])
  })

  it('handles nothing to do', async () => {
    expect(await mapBounded([], 4, async () => 1)).toEqual([])
  })
})

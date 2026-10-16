import { describe, expect, it } from 'vitest'
import { queryPhase } from './queryPhase'

describe('queryPhase', () => {
  it('is ready whenever data is on screen, even while refetching', () => {
    expect(queryPhase({ data: { a: 1 }, fetchStatus: 'idle' })).toBe('ready')
    expect(queryPhase({ data: { a: 1 }, fetchStatus: 'fetching' })).toBe('ready')
  })

  it('is loading only while a request is actually in flight or paused', () => {
    expect(queryPhase({ fetchStatus: 'fetching' })).toBe('loading')
    expect(queryPhase({ fetchStatus: 'paused' })).toBe('loading')
  })

  it('is idle for a disabled query, which has no data and will never fetch', () => {
    // A disabled TanStack query is `isPending` forever with `fetchStatus: 'idle'`:
    // the panel must show a setup state rather than a skeleton that never resolves.
    expect(queryPhase({ data: undefined, fetchStatus: 'idle' })).toBe('idle')
    expect(queryPhase({ data: null, fetchStatus: 'idle' })).toBe('idle')
  })
})

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resolveDataState } from './dataState'
import { LoadingGate, type LoadingPhase } from './loadingGate'
import { formatAge, nextTickMs } from './freshness'

const base = { hasData: false, isPending: false, isFetching: false, isError: false }

describe('resolveDataState', () => {
  it('is loading before the first answer', () => {
    expect(resolveDataState({ ...base, isPending: true, isFetching: true }).kind).toBe('loading')
  })

  it('shows an error over a skeleton when nothing is on screen', () => {
    expect(resolveDataState({ ...base, isError: true }).kind).toBe('error')
  })

  it('keeps content over an error and marks it stale', () => {
    const state = resolveDataState({ ...base, hasData: true, isError: true })
    expect(state).toMatchObject({ kind: 'ready', stale: true, refreshing: false })
  })

  it('keeps content while refetching and marks it refreshing', () => {
    const state = resolveDataState({ ...base, hasData: true, isFetching: true })
    expect(state).toMatchObject({ kind: 'ready', refreshing: true, stale: false })
  })

  it('tells first-run empty from filtered empty', () => {
    expect(resolveDataState({ ...base, hasData: true, isEmpty: true }).kind).toBe('empty')
    expect(resolveDataState({ ...base, hasData: true, isEmpty: true, isFiltered: true }).kind).toBe(
      'filtered',
    )
  })

  it('never says empty before the server has answered', () => {
    const state = resolveDataState({ ...base, isPending: true, isEmpty: true })
    expect(state.kind).toBe('loading')
  })

  it('flags previous-input data as provisional', () => {
    const state = resolveDataState({
      ...base,
      hasData: true,
      isFetching: true,
      isPlaceholderData: true,
    })
    expect(state).toMatchObject({ kind: 'ready', refreshing: true, provisional: true })
  })
})

describe('LoadingGate', () => {
  let phases: LoadingPhase[]
  const make = () =>
    new LoadingGate((phase) => phases.push(phase), { delayMs: 200, minMs: 400, slowMs: 8000 })

  beforeEach(() => {
    vi.useFakeTimers()
    phases = []
  })
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => vi.advanceTimersByTime(ms)

  it('never draws a skeleton for a fast request', () => {
    const gate = make()
    gate.set(true)
    advance(120)
    gate.set(false)
    advance(1000)
    expect(phases).toEqual(['reserved', 'idle'])
  })

  it('draws after the delay and holds for the minimum so it does not strobe', () => {
    const gate = make()
    gate.set(true)
    advance(210)
    expect(gate.current).toBe('visible')
    advance(50)
    gate.set(false)
    expect(gate.current).toBe('visible')
    advance(400)
    expect(gate.current).toBe('idle')
  })

  it('goes slow rather than staying ambiguous', () => {
    const gate = make()
    gate.set(true)
    advance(8100)
    expect(gate.current).toBe('slow')
    gate.set(false)
    advance(0)
    expect(gate.current).toBe('idle')
  })

  it('ignores repeated identical input', () => {
    const gate = make()
    gate.set(true)
    gate.set(true)
    expect(phases).toEqual(['reserved'])
  })
})

describe('formatAge', () => {
  it('speaks in coarse human units', () => {
    expect(formatAge(3_000)).toBe('just now')
    expect(formatAge(25_000)).toBe('20 sec ago')
    expect(formatAge(3 * 60_000 + 5_000)).toBe('3 min ago')
    expect(formatAge(2 * 3_600_000)).toBe('2 hr ago')
    expect(formatAge(24 * 3_600_000)).toBe('1 day ago')
    expect(formatAge(72 * 3_600_000)).toBe('3 days ago')
  })

  it('never goes negative when a clock is skewed', () => {
    expect(formatAge(-5_000)).toBe('just now')
  })

  it('ticks no faster than the label can change', () => {
    expect(nextTickMs(5_000)).toBe(10_000)
    expect(nextTickMs(120_000)).toBe(30_000)
    expect(nextTickMs(4 * 3_600_000)).toBe(300_000)
  })
})

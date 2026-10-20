import { describe, expect, it } from 'vitest'
import { lineLineages, type SubscriptionLine } from './subscription'

const line = (patch: Partial<SubscriptionLine>): SubscriptionLine =>
  ({
    id: 'line',
    priceId: '',
    overridesPriceId: '',
    startDate: null,
    endDate: null,
    charge: null,
    ...patch,
  }) as SubscriptionLine

const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe('lineLineages', () => {
  it('keeps an overridden price as an inactive version of the same charge', () => {
    const lineages = lineLineages([
      line({ id: 'a1', priceId: 'p1', startDate: day('2026-01-01'), endDate: day('2026-06-01') }),
      line({ id: 'a2', priceId: 'p2', overridesPriceId: 'p1', startDate: day('2026-06-01') }),
      line({ id: 'b1', priceId: 'q1', startDate: day('2026-01-01') }),
    ])
    expect(lineages).toHaveLength(2)
    const changed = lineages.find((lineage) => lineage.current.id === 'a2')
    expect(changed?.versions.map((version) => version.id)).toEqual(['a2', 'a1'])
  })

  it('follows a chain of overrides, whichever price each points back to', () => {
    const lineages = lineLineages([
      line({ id: 'v1', priceId: 'p1', startDate: day('2026-01-01'), endDate: day('2026-03-01') }),
      line({
        id: 'v2',
        priceId: 'p2',
        overridesPriceId: 'p1',
        startDate: day('2026-03-01'),
        endDate: day('2026-05-01'),
      }),
      line({ id: 'v3', priceId: 'p3', overridesPriceId: 'p2', startDate: day('2026-05-01') }),
    ])
    expect(lineages).toHaveLength(1)
    expect(lineages[0]?.versions.map((version) => version.id)).toEqual(['v3', 'v2', 'v1'])
  })

  it('leaves an ended charge with no successor as its own, ended row', () => {
    const [only] = lineLineages([
      line({ id: 'x', priceId: 'p9', startDate: day('2026-01-01'), endDate: day('2026-02-01') }),
    ])
    expect(only?.current.id).toBe('x')
    expect(only?.versions).toHaveLength(1)
  })
})

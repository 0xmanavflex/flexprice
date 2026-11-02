import { describe, expect, it } from 'vitest'
import { currentVersion, versionStatus } from './price'
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

  it('keeps the billing version current while an edit is only scheduled', () => {
    // ₹600 bills today; ₹1,000 is scheduled for 1 Dec.
    const now = day('2026-10-29').getTime()
    const [lineage] = lineLineages(
      [
        line({
          id: 'v600',
          priceId: 'p1',
          startDate: day('2026-01-01'),
          endDate: day('2026-12-01'),
        }),
        line({ id: 'v1000', priceId: 'p2', overridesPriceId: 'p1', startDate: day('2026-12-01') }),
      ],
      now,
    )
    expect(lineage?.current.id).toBe('v600')
    expect(lineage?.versions.map((version) => version.id)).toEqual(['v1000', 'v600'])
    // From 1 Dec the new price is the one billing.
    expect(lineLineages(lineage?.versions ?? [], day('2026-12-02').getTime())[0]?.current.id).toBe(
      'v1000',
    )
  })
})

describe('versionStatus', () => {
  const now = day('2026-10-29').getTime()

  it('reads current, upcoming and history off the dates', () => {
    expect(versionStatus({ startDate: day('2026-01-01'), endDate: null }, now)).toBe('current')
    // A future end date is scheduled, not ended.
    expect(versionStatus({ startDate: day('2026-01-01'), endDate: day('2026-10-30') }, now)).toBe(
      'current',
    )
    expect(versionStatus({ startDate: day('2026-12-01'), endDate: null }, now)).toBe('upcoming')
    expect(versionStatus({ startDate: day('2026-01-01'), endDate: day('2026-10-01') }, now)).toBe(
      'history',
    )
    expect(versionStatus({ startDate: null, endDate: null }, now)).toBe('current')
  })

  it('shows a charge that is only scheduled by its first version to start', () => {
    const versions = [
      { id: 'later', startDate: day('2027-02-01'), endDate: null },
      { id: 'next', startDate: day('2026-12-01'), endDate: day('2027-02-01') },
    ]
    expect(currentVersion(versions, now).id).toBe('next')
  })
})

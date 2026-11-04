import { describe, expect, it } from 'vitest'
import { AddonStatus, DEFAULT_ADDON_QUERY, isAddonQueryFiltered } from './addon'
import { FilterOp, type ListFilter } from './listFilter'
import { DEFAULT_PLAN_QUERY, isPlanQueryFiltered } from './plan'

const archivedChip: ListFilter = { field: 'status', op: FilterOp.In, value: ['archived'] }

describe('isPlanQueryFiltered', () => {
  it('is false for the default view', () => {
    expect(isPlanQueryFiltered(DEFAULT_PLAN_QUERY)).toBe(false)
  })

  it('counts a filter chip, so an empty Archived result is not "no plans yet"', () => {
    expect(isPlanQueryFiltered({ ...DEFAULT_PLAN_QUERY, filters: [archivedChip] })).toBe(true)
  })

  it('counts a search', () => {
    expect(isPlanQueryFiltered({ ...DEFAULT_PLAN_QUERY, search: 'pro' })).toBe(true)
  })
})

describe('isAddonQueryFiltered', () => {
  it('is false for the default view', () => {
    expect(isAddonQueryFiltered(DEFAULT_ADDON_QUERY)).toBe(false)
  })

  it('counts a filter chip and the status facet', () => {
    expect(isAddonQueryFiltered({ ...DEFAULT_ADDON_QUERY, filters: [archivedChip] })).toBe(true)
    expect(
      isAddonQueryFiltered({ ...DEFAULT_ADDON_QUERY, statuses: [AddonStatus.Published] }),
    ).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import {
  clearListMemory,
  isBareQuery,
  rememberQuery,
  rememberedQuery,
  restoreTarget,
} from './listMemory'

/** A `Storage`-shaped map, so the pure functions can be driven under node. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    size: () => map.size,
  }
}

/** One that fails every way the browser can: private mode, quota, disabled. */
const hostileStorage = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('quota')
  },
  removeItem: () => {
    throw new Error('denied')
  },
}

const DEFAULTS = { page: 1, pageSize: 25, search: '', statuses: [], sortBy: 'updatedAt' }

describe('rememberQuery / rememberedQuery', () => {
  it('returns what was written for the same environment and list', () => {
    const storage = fakeStorage()
    rememberQuery(storage, 'env_1', 'customers', { ...DEFAULTS, search: 'acme' })
    expect(rememberedQuery(storage, 'env_1', 'customers')).toEqual({
      ...DEFAULTS,
      search: 'acme',
    })
  })

  it('keeps each list apart', () => {
    const storage = fakeStorage()
    rememberQuery(storage, 'env_1', 'customers', { ...DEFAULTS, search: 'acme' })
    rememberQuery(storage, 'env_1', 'invoices', { ...DEFAULTS, search: 'INV-9' })
    expect(rememberedQuery(storage, 'env_1', 'customers')).toMatchObject({ search: 'acme' })
    expect(rememberedQuery(storage, 'env_1', 'invoices')).toMatchObject({ search: 'INV-9' })
  })

  it('reads as empty under a different environment', () => {
    const storage = fakeStorage()
    rememberQuery(storage, 'env_sandbox', 'customers', { ...DEFAULTS, search: 'acme' })
    expect(rememberedQuery(storage, 'env_production', 'customers')).toBeNull()
  })

  it('replaces another environment’s store rather than merging into it', () => {
    const storage = fakeStorage()
    rememberQuery(storage, 'env_sandbox', 'customers', { ...DEFAULTS, search: 'acme' })
    rememberQuery(storage, 'env_production', 'invoices', { ...DEFAULTS, search: 'INV-9' })
    // Switching back finds nothing: the sandbox entry did not survive, which is
    // the point: those filters named sandbox rows.
    expect(rememberedQuery(storage, 'env_sandbox', 'customers')).toBeNull()
    expect(rememberedQuery(storage, 'env_production', 'invoices')).toMatchObject({
      search: 'INV-9',
    })
  })

  it('forgets everything when cleared', () => {
    const storage = fakeStorage()
    rememberQuery(storage, 'env_1', 'customers', { ...DEFAULTS, search: 'acme' })
    clearListMemory(storage)
    expect(rememberedQuery(storage, 'env_1', 'customers')).toBeNull()
  })

  it('survives a storage that throws on every call', () => {
    expect(() => rememberQuery(hostileStorage, 'env_1', 'customers', DEFAULTS)).not.toThrow()
    expect(rememberedQuery(hostileStorage, 'env_1', 'customers')).toBeNull()
    expect(() => clearListMemory(hostileStorage)).not.toThrow()
  })

  it('survives an absent storage', () => {
    expect(() => rememberQuery(undefined, 'env_1', 'customers', DEFAULTS)).not.toThrow()
    expect(rememberedQuery(undefined, 'env_1', 'customers')).toBeNull()
  })

  it('ignores a corrupt store rather than throwing', () => {
    expect(rememberedQuery(fakeStorage({ 'fp.listMemory.v1': 'not json' }), null, 'x')).toBeNull()
    expect(rememberedQuery(fakeStorage({ 'fp.listMemory.v1': '"a string"' }), null, 'x')).toBeNull()
    expect(rememberedQuery(fakeStorage({ 'fp.listMemory.v1': '{}' }), null, 'x')).toBeNull()
  })
})

describe('isBareQuery', () => {
  it('is true for the defaults themselves', () => {
    expect(isBareQuery({ ...DEFAULTS }, DEFAULTS)).toBe(true)
  })

  /*
   * The shape that actually reaches this code.
   *
   * `stripSearchParams` takes every default out of the URL, so a bare list is
   * an empty object: not a full default query. Treating an absent key as
   * anything but its default made every URL look non-bare, which silently
   * disabled restoring altogether.
   */
  it('is true for the empty object a stripped URL produces', () => {
    expect(isBareQuery({}, DEFAULTS)).toBe(true)
  })

  it('is true when only the defaults were stripped away', () => {
    expect(isBareQuery({ page: 1 }, DEFAULTS)).toBe(true)
  })

  it('is false for a stripped URL that still says one thing', () => {
    expect(isBareQuery({ search: 'acme' }, DEFAULTS)).toBe(false)
    expect(isBareQuery({ page: 3 }, DEFAULTS)).toBe(false)
  })

  it('treats an absent key and an empty list as the same', () => {
    const { statuses: _statuses, ...withoutStatuses } = DEFAULTS
    expect(isBareQuery(withoutStatuses, DEFAULTS)).toBe(true)
  })

  it('is false once anything differs', () => {
    expect(isBareQuery({ ...DEFAULTS, search: 'acme' }, DEFAULTS)).toBe(false)
    expect(isBareQuery({ ...DEFAULTS, page: 2 }, DEFAULTS)).toBe(false)
    expect(isBareQuery({ ...DEFAULTS, statuses: ['active'] }, DEFAULTS)).toBe(false)
  })

  it('compares nested filter objects by value', () => {
    const filters = [{ field: 'name', operator: 'contains', value: { string: 'a' } }]
    expect(isBareQuery({ ...DEFAULTS, filters }, { ...DEFAULTS, filters })).toBe(true)
    expect(
      isBareQuery(
        { ...DEFAULTS, filters },
        { ...DEFAULTS, filters: [{ ...filters[0], value: { string: 'b' } }] },
      ),
    ).toBe(false)
  })
})

describe('restoreTarget', () => {
  it('restores a remembered query onto a bare URL', () => {
    const remembered = { ...DEFAULTS, search: 'acme' }
    expect(restoreTarget(remembered, { ...DEFAULTS }, DEFAULTS)).toEqual(remembered)
  })

  it('restores onto the stripped empty URL, which is the real case', () => {
    expect(restoreTarget({ search: 'acme' }, {}, DEFAULTS)).toEqual({ search: 'acme' })
  })

  it('does nothing when the stripped remembered query is empty', () => {
    expect(restoreTarget({}, {}, DEFAULTS)).toBeNull()
  })

  it('leaves a URL that says something alone: a link wins', () => {
    const remembered = { ...DEFAULTS, search: 'acme' }
    const fromLink = { ...DEFAULTS, statuses: ['archived'] }
    expect(restoreTarget(remembered, fromLink, DEFAULTS)).toBeNull()
  })

  it('does nothing when nothing was remembered', () => {
    expect(restoreTarget(null, { ...DEFAULTS }, DEFAULTS)).toBeNull()
  })

  it('does nothing when the remembered query is itself the default', () => {
    // "Clear filters" is remembered like any other change, so coming back must
    // not re-apply what was cleared: and must not spend a navigation saying so.
    expect(restoreTarget({ ...DEFAULTS }, { ...DEFAULTS }, DEFAULTS)).toBeNull()
  })
})

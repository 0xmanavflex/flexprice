/**
 * The filters you left a list with, still there when you come back.
 *
 * Every list keeps its query in the URL, which is what makes a filtered list a
 * link. The cost is that leaving the list throws the query away: open a
 * customer from a filtered, sorted page and the Back-to-list breadcrumb lands
 * on an unfiltered page one. People re-apply the same three filters all day.
 *
 * So the last query per list is remembered, and restored when a list is opened
 * with nothing in its URL. Three rules make that safe:
 *
 *   - **A link wins.** Restoring happens only when the URL carries no query at
 *     all. A pasted link, or any navigation that names filters, is obeyed
 *     exactly: otherwise a shared link would silently become someone else's
 *     saved view.
 *   - **Clearing is remembered too.** Every change is written, including a
 *     reset to the default, so "Clear filters" is not undone by walking away
 *     and coming back.
 *   - **It belongs to one environment.** The store names the environment it
 *     was written for and reads as empty under any other, so switching from
 *     Sandbox to Production never carries Sandbox's filters across. Signing
 *     out and switching environments both clear it outright; this is the
 *     belt to that pair of braces, for the case where the tab is reloaded
 *     between the two.
 *
 * `sessionStorage`, not `localStorage`: a remembered filter is a property of
 * this sitting at this tab, not a setting. A new tab starts clean, and nothing
 * outlives the browser.
 */

const KEY = 'fp.listMemory.v1'

interface Store {
  environmentId: string | null
  byList: Record<string, Record<string, unknown>>
}

/** Storage is absent in SSR and throws in a private window; neither is an error here. */
type MaybeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined

function read(storage: MaybeStorage): Store | null {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const store = parsed as Partial<Store>
    if (typeof store.byList !== 'object' || store.byList === null) return null
    return {
      environmentId: typeof store.environmentId === 'string' ? store.environmentId : null,
      byList: store.byList as Record<string, Record<string, unknown>>,
    }
  } catch {
    // Unreadable, full, or disabled: the feature is a convenience, so it
    // degrades to "nothing was remembered" rather than breaking the page.
    return null
  }
}

/** The query last seen on `listId`, or null when there is nothing to restore. */
export function rememberedQuery(
  storage: MaybeStorage,
  environmentId: string | null,
  listId: string,
): Record<string, unknown> | null {
  const store = read(storage)
  if (!store || store.environmentId !== environmentId) return null
  return store.byList[listId] ?? null
}

export function rememberQuery(
  storage: MaybeStorage,
  environmentId: string | null,
  listId: string,
  query: Record<string, unknown>,
): void {
  const existing = read(storage)
  // A store written for another environment is replaced, not merged: its
  // entries name rows that do not exist here.
  const base: Store =
    existing && existing.environmentId === environmentId ? existing : { environmentId, byList: {} }
  try {
    storage?.setItem(
      KEY,
      JSON.stringify({ environmentId, byList: { ...base.byList, [listId]: query } }),
    )
  } catch {
    // Quota, or storage disabled. Nothing is remembered; nothing breaks.
  }
}

export function clearListMemory(storage: MaybeStorage): void {
  try {
    storage?.removeItem(KEY)
  } catch {
    // As above.
  }
}

/**
 * Whether `current` is a bare list URL: the only case a remembered query may
 * replace.
 *
 * The routes strip default values out of the URL (`stripSearchParams`), so the
 * search object for a bare `/customers` is `{}`, not a full default query. A
 * key that is absent therefore *means* the default, and is read as one.
 * Getting that wrong is silent: every URL looks non-bare, nothing is ever
 * restored, and no test of the rules alone would notice.
 *
 * Anything actually said, even a single `?status=active`, is something the
 * person or the link asked for.
 */
export function isBareQuery(
  current: Record<string, unknown>,
  defaults: Record<string, unknown>,
): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(defaults)])
  for (const key of keys) {
    const value = key in current ? current[key] : defaults[key]
    if (!same(value, defaults[key])) return false
  }
  return true
}

/**
 * The query to restore, or null to leave the URL alone.
 *
 * Null when the URL already says something, when nothing was remembered, or
 * when what was remembered is the default anyway: navigating to replace a
 * default with the same default is a wasted history entry.
 */
export function restoreTarget(
  remembered: Record<string, unknown> | null,
  current: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!remembered) return null
  if (!isBareQuery(current, defaults)) return null
  if (isBareQuery(remembered, defaults)) return null
  return remembered
}

/** Structural equality, enough for query values: scalars, arrays and filter objects. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // An absent key and an empty list mean the same thing in these queries.
  if (a === undefined && Array.isArray(b)) return b.length === 0
  if (b === undefined && Array.isArray(a)) return a.length === 0
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => same(item, b[index]))
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].every((key) =>
      same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  }
  return false
}

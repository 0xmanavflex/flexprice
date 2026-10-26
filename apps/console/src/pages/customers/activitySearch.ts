import { ACTIVITY_ACTOR_TYPES, ACTIVITY_SOURCES } from '@fp/domain'
import type { ActivityFilters, ActivityRange } from '@fp/ui/pages'

/**
 * The Activity tab's filters as URL search params, so a reload or a shared
 * link opens the same trail: `?tab=activity&actor=user&range=7d&q=INV-`.
 *
 * Every value is checked: an action must look like `<entity>.<verb>` (the API
 * rejects anything else), an actor type and a source must be known ones, and
 * a range one of the three. Defaults stay out of the address bar. The page
 * cursor is not here: it is an opaque, short-lived position in one run of
 * results, so a reload starts from page one of the same filters.
 */
export interface ActivitySearch {
  q?: string
  action?: string
  actor?: string
  /** With `actor=user`: one person's user id. */
  by?: string
  source?: string
  range?: ActivityRange
  /** `range=custom`: the first and last day, `YYYY-MM-DD`. */
  from?: string
  to?: string
}

const RANGES: readonly ActivityRange[] = ['24h', '7d', '30d', 'custom']
const DAY = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_RANGE: ActivityRange = '30d'
const ACTION = /^[a-z_]+\.[a-z_]+$/
const ID = /^[A-Za-z0-9_-]{1,64}$/
const ACTORS = new Set(ACTIVITY_ACTOR_TYPES.map((actor) => actor.value))

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export function parseActivitySearch(search: Record<string, unknown>): ActivitySearch {
  const q = text(search['q'])
  const action = text(search['action'])
  const actor = text(search['actor'])
  const by = text(search['by'])
  const source = text(search['source'])
  const range = text(search['range']) as ActivityRange
  const from = text(search['from'])
  const to = text(search['to'])
  return {
    ...(q ? { q } : {}),
    ...(ACTION.test(action) ? { action } : {}),
    ...(ACTORS.has(actor) ? { actor } : {}),
    ...(actor === 'user' && ID.test(by) ? { by } : {}),
    ...(ACTIVITY_SOURCES.includes(source) ? { source } : {}),
    ...(RANGES.includes(range) && range !== DEFAULT_RANGE ? { range } : {}),
    ...(range === 'custom' && DAY.test(from) ? { from } : {}),
    ...(range === 'custom' && DAY.test(to) ? { to } : {}),
  }
}

export function activityFiltersFrom(search: ActivitySearch): ActivityFilters {
  return {
    search: search.q ?? '',
    action: search.action ?? '',
    actorType: search.actor ?? '',
    ...(search.by ? { actorId: search.by } : {}),
    source: search.source ?? '',
    range: search.range ?? DEFAULT_RANGE,
    ...(search.from ? { from: search.from } : {}),
    ...(search.to ? { to: search.to } : {}),
  }
}

export function activitySearchFrom(filters: ActivityFilters): ActivitySearch {
  return parseActivitySearch({
    q: filters.search,
    action: filters.action,
    actor: filters.actorType,
    by: filters.actorId,
    source: filters.source,
    range: filters.range,
    from: filters.from,
    to: filters.to,
  })
}

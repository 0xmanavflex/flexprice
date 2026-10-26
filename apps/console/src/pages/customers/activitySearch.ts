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
  source?: string
  range?: ActivityRange
}

const RANGES: readonly ActivityRange[] = ['24h', '7d', '30d']
const DEFAULT_RANGE: ActivityRange = '30d'
const ACTION = /^[a-z_]+\.[a-z_]+$/
const ACTORS = new Set(ACTIVITY_ACTOR_TYPES.map((actor) => actor.value))

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export function parseActivitySearch(search: Record<string, unknown>): ActivitySearch {
  const q = text(search['q'])
  const action = text(search['action'])
  const actor = text(search['actor'])
  const source = text(search['source'])
  const range = text(search['range']) as ActivityRange
  return {
    ...(q ? { q } : {}),
    ...(ACTION.test(action) ? { action } : {}),
    ...(ACTORS.has(actor) ? { actor } : {}),
    ...(ACTIVITY_SOURCES.includes(source) ? { source } : {}),
    ...(RANGES.includes(range) && range !== DEFAULT_RANGE ? { range } : {}),
  }
}

export function activityFiltersFrom(search: ActivitySearch): ActivityFilters {
  return {
    search: search.q ?? '',
    action: search.action ?? '',
    actorType: search.actor ?? '',
    source: search.source ?? '',
    range: search.range ?? DEFAULT_RANGE,
  }
}

export function activitySearchFrom(filters: ActivityFilters): ActivitySearch {
  return parseActivitySearch({
    q: filters.search,
    action: filters.action,
    actor: filters.actorType,
    source: filters.source,
    range: filters.range,
  })
}

import { DEFAULT_FEATURE_QUERY, type FeatureQuery, FeatureType } from '@fp/domain'

/**
 * The feature query, as URL search params.
 *
 * Same rule as invoices: the route owns the query, so a filtered list is a
 * shareable link and the grid stays stateless. Parsing is total — a hand-edited
 * URL shows the first page rather than an error.
 */
const TYPES = new Set<string>(Object.values(FeatureType))
const MAX_PAGE_SIZE = 100

function positiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.trunc(parsed), max)
}

export function parseFeatureSearch(raw: Record<string, unknown>): FeatureQuery {
  const rawTypes = raw['type']
  const types = (Array.isArray(rawTypes) ? rawTypes : String(rawTypes ?? '').split(','))
    .map((t) => String(t).trim())
    .filter((t): t is FeatureType => TYPES.has(t))

  return {
    page: positiveInt(raw['page'], DEFAULT_FEATURE_QUERY.page),
    pageSize: positiveInt(raw['size'], DEFAULT_FEATURE_QUERY.pageSize, MAX_PAGE_SIZE),
    search: String(raw['q'] ?? '').trim(),
    types: [...new Set(types)],
  }
}

import { useQuery } from '@tanstack/react-query'
import { ApiError, ErrorKind, runReport, type ReportQuery, type ReportResult } from '@fp/api'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * One analytics report — `POST /analytics/reports/{key}/query`, the report
 * library's single endpoint. Keyed by the report and the whole query, so a
 * change of range, grain, currency or comparison is its own read.
 *
 * Pass `null` to wait (for a currency not yet chosen, say).
 */
export function useReport(key: string, query: ReportQuery | null) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useQuery<ReportResult>({
    queryKey: ['reports', key, query],
    enabled: query !== null,
    queryFn: async () => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to read reports.')
      if (!environmentId) throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
      return runReport(serverURL, token, environmentId, key, query as ReportQuery)
    },
    // Reports aggregate a whole range: a minute is fresh enough, and a range
    // change keeps the last answer on screen while the next one loads.
    staleTime: 60_000,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === key ? previous : undefined,
  })
}

/** A report's value cell as a number; blank or unreadable is null, not zero. */
function numberAt(row: string[] | undefined, index: number): number | null {
  if (!row || index < 0) return null
  const raw = row[index]
  if (raw === undefined || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function indexOf(result: ReportResult, name: string): number {
  return result.columns.findIndex((column) => column.name === name)
}

/** Rows for one currency (case-insensitive), or every row when the report has no currency column. */
function rowsFor(result: ReportResult, currency: string | undefined): string[][] {
  const at = indexOf(result, 'currency')
  if (at < 0 || !currency) return result.rows
  return result.rows.filter((row) => (row[at] ?? '').toLowerCase() === currency.toLowerCase())
}

export interface ReportScalar {
  value: number | null
  previous: number | null
  /** Change against the previous period as a fraction (0.12 is +12%), when compared. */
  change: number | null
}

/** A scalar report's figure for one currency, with its comparison when one was asked for. */
export function reportScalar(
  result: ReportResult | undefined,
  key: string,
  currency?: string,
): ReportScalar {
  if (!result) return { value: null, previous: null, change: null }
  const row = rowsFor(result, currency)[0]
  const pct = numberAt(row, indexOf(result, `${key}_change_pct`))
  return {
    value: numberAt(row, indexOf(result, key)),
    previous: numberAt(row, indexOf(result, `${key}_prev`)),
    change: pct === null ? null : pct / 100,
  }
}

export interface ReportPoint {
  bucket: Date
  value: number
  previous: number | null
}

/** A timeseries report's buckets for one currency, oldest first. */
export function reportSeries(
  result: ReportResult | undefined,
  key: string,
  currency?: string,
): ReportPoint[] {
  if (!result) return []
  const bucket = indexOf(result, 'bucket')
  const value = indexOf(result, key)
  const previous = indexOf(result, `${key}_prev`)
  return rowsFor(result, currency)
    .map((row) => ({
      bucket: new Date(row[bucket] ?? ''),
      value: numberAt(row, value) ?? 0,
      previous: numberAt(row, previous),
    }))
    .filter((point) => !Number.isNaN(point.bucket.getTime()))
    .sort((a, b) => a.bucket.getTime() - b.bucket.getTime())
}

export interface ReportBreakdownRow {
  /** The value of each requested dimension, by dimension name. */
  keys: Record<string, string>
  value: number
}

/** A breakdown report's rows for one currency, largest first. */
export function reportBreakdown(
  result: ReportResult | undefined,
  key: string,
  dimensions: readonly string[],
  currency?: string,
): ReportBreakdownRow[] {
  if (!result) return []
  const value = indexOf(result, key)
  const at = dimensions.map((dimension) => [dimension, indexOf(result, dimension)] as const)
  return rowsFor(result, currency)
    .map((row) => ({
      keys: Object.fromEntries(at.map(([dimension, index]) => [dimension, row[index] ?? ''])),
      value: numberAt(row, value) ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
}

/** The currencies a report answered in, upper case, in the order it gave them. */
export function reportCurrencies(result: ReportResult | undefined): string[] {
  if (!result) return []
  const at = indexOf(result, 'currency')
  if (at < 0) return []
  return [...new Set(result.rows.map((row) => (row[at] ?? '').toUpperCase()).filter(Boolean))]
}

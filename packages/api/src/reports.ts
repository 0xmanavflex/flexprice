import { request } from './settings'

/**
 * The analytics report library — `POST /analytics/reports/{key}/query`.
 *
 * One endpoint answers every canned report (billing, receivables, customers,
 * credits, usage) in one of three shapes. The SDK has no call for it, so it is
 * sent with `request()`. The answer is a small table: named columns, each a
 * dimension or a metric, and rows of strings in that order.
 */

export type ReportShape = 'scalar' | 'timeseries' | 'breakdown'
export type ReportGrain = 'day' | 'week' | 'month'

export interface ReportQuery {
  shape: ReportShape
  /** `YYYY-MM-DD..YYYY-MM-DD`, or a relative token such as `last_30_days`. */
  range: string
  dimensions?: string[] | undefined
  grain?: ReportGrain | undefined
  currency?: string | undefined
  filters?: { field: string; op: 'eq' | 'in'; value: string[] }[] | undefined
  compare?: 'previous_period' | 'previous_year' | undefined
  limit?: number | undefined
  /** Rows to skip; needs a breakdown with a limit. */
  offset?: number | undefined
  sort?: { field: string; dir: 'asc' | 'desc' }[] | undefined
}

export interface ReportColumn {
  name: string
  type: 'string' | 'decimal' | 'datetime'
  role: 'dimension' | 'metric'
  currency?: string | undefined
}

export interface ReportResult {
  columns: ReportColumn[]
  rows: string[][]
  meta: { query_source?: string; from?: string; to?: string; prev_from?: string; prev_to?: string }
}

export async function runReport(
  serverURL: string,
  token: string,
  environmentId: string,
  key: string,
  query: ReportQuery,
): Promise<ReportResult> {
  const body = (await request(serverURL, `/analytics/reports/${encodeURIComponent(key)}/query`, {
    method: 'POST',
    token,
    environmentId,
    body: query,
  })) as Partial<ReportResult> | null
  return { columns: body?.columns ?? [], rows: body?.rows ?? [], meta: body?.meta ?? {} }
}

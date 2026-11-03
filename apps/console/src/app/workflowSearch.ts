import { DEFAULT_WORKFLOW_QUERY, type WorkflowQuery, WorkflowStatus } from '@fp/domain'

/**
 * The workflow query, as URL search params. Total, like every list codec
 * here: a hand-edited URL shows the first page rather than an error.
 */
const STATUSES = new Set<string>(Object.values(WorkflowStatus))
const MAX_PAGE_SIZE = 100

function param(raw: Record<string, unknown>, short: string, long: string): unknown {
  const value = raw[short]
  return value === undefined || value === null ? raw[long] : value
}

function positiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.trunc(parsed), max)
}

export function parseWorkflowSearch(raw: Record<string, unknown>): WorkflowQuery {
  const rawStatuses = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(rawStatuses) ? rawStatuses : String(rawStatuses ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is WorkflowStatus => STATUSES.has(s))

  const direction = param(raw, 'dir', 'sortDirection')

  return {
    page: positiveInt(raw['page'], DEFAULT_WORKFLOW_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_WORKFLOW_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? ''),
    statuses: [...new Set(statuses)],
    sortDirection: direction === 'asc' ? 'asc' : DEFAULT_WORKFLOW_QUERY.sortDirection,
  }
}

/**
 * Usage-event imports: a CSV of events, uploaded once and ingested in the
 * background as a task (`POST /tasks`, `task_type=IMPORT`, `entity_type=EVENTS`).
 *
 * The backend reads the columns by name, so the template below is the contract:
 * `event_name` and one of the customer ids are required, `timestamp` is RFC 3339
 * (now when blank), and properties are either `properties.<key>` columns or one
 * `properties` column holding a JSON object.
 */

export const EVENT_IMPORT_STATUS = {
  All: 'all',
  Pending: 'PENDING',
  Processing: 'PROCESSING',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
} as const
export type EventImportStatus = (typeof EVENT_IMPORT_STATUS)[keyof typeof EVENT_IMPORT_STATUS]

export const EVENT_IMPORT_STATUS_LABEL: Record<EventImportStatus, string> = {
  all: 'All',
  PENDING: 'Queued',
  PROCESSING: 'Importing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}

/** Still being worked on: the list keeps polling while one of these is on screen. */
export function isEventImportActive(status: string): boolean {
  return status === EVENT_IMPORT_STATUS.Pending || status === EVENT_IMPORT_STATUS.Processing
}

/** One import: the file, how far it got, and why rows failed. */
export interface EventImport {
  id: string
  fileName: string
  /** The wire's status, e.g. `COMPLETED`. */
  status: string
  totalRecords: number | null
  processedRecords: number | null
  successfulRecords: number | null
  failedRecords: number | null
  /** The backend's summary of failed rows, one `Record n: …` line each. */
  errorSummary: string
  createdAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  failedAt: Date | null
}

/** The per-row lines of an error summary, so they read as a list. */
export function eventImportErrors(summary: string): string[] {
  return summary
    .split(/\r?\n|;\s*(?=Record \d)/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export interface EventImportQuery {
  page: number
  pageSize: number
  status: EventImportStatus
  /** Narrows the page on screen by file name: the endpoint has no search. */
  search: string
  /** The import open in the side sheet, so it is a link. */
  open: string
}

export const DEFAULT_EVENT_IMPORT_QUERY: EventImportQuery = {
  page: 1,
  pageSize: 25,
  status: EVENT_IMPORT_STATUS.All,
  search: '',
  open: '',
}

/* ------------------------------------------------------------------------- */
/* The CSV format                                                            */
/* ------------------------------------------------------------------------- */

export interface EventImportColumn {
  name: string
  required: boolean
  description: string
  /** The template's example value. */
  example: string
}

export const EVENT_IMPORT_COLUMNS: readonly EventImportColumn[] = [
  {
    name: 'event_name',
    required: true,
    description: 'The event name your meters filter on.',
    example: 'api_request',
  },
  {
    name: 'external_customer_id',
    required: true,
    description: 'Your id for the customer. Or send customer_id, the Flexprice id.',
    example: 'cus_001',
  },
  {
    name: 'timestamp',
    required: false,
    description: 'When it happened, in RFC 3339 (2025-02-14T10:30:00Z). Blank means now.',
    example: '2025-02-14T10:30:00Z',
  },
  {
    name: 'event_id',
    required: false,
    description: 'A unique id, so a re-imported row is not counted twice.',
    example: 'evt_001',
  },
  {
    name: 'source',
    required: false,
    description: 'Where the event came from.',
    example: 'csv_import',
  },
  {
    name: 'properties.<key>',
    required: false,
    description:
      'One column per property, e.g. properties.region. Or one properties column of JSON.',
    example: 'us-east-1',
  },
]

/** The downloadable template: the header row and one example row. */
export function eventImportTemplateCsv(): string {
  const header = EVENT_IMPORT_COLUMNS.map((column) =>
    column.name === 'properties.<key>' ? 'properties.region' : column.name,
  )
  const example = EVENT_IMPORT_COLUMNS.map((column) => column.example)
  return [header, example].map((line) => line.join(',')).join('\r\n') + '\r\n'
}

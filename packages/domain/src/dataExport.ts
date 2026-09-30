/**
 * A scheduled export: billing data Flexprice writes to the customer's own
 * storage on a timer. V1 calls these "scheduled tasks"; the console calls them
 * exports because that is the word a person looks for.
 */
export const EXPORT_ENTITY = {
  Events: 'events',
  Invoice: 'invoice',
  CreditTopups: 'credit_topups',
  CreditUsage: 'credit_usage',
  UsageAnalytics: 'usage_analytics',
} as const
export type ExportEntity = (typeof EXPORT_ENTITY)[keyof typeof EXPORT_ENTITY]

export const EXPORT_ENTITY_LABEL: Record<ExportEntity, string> = {
  [EXPORT_ENTITY.Events]: 'Events',
  [EXPORT_ENTITY.Invoice]: 'Invoices',
  [EXPORT_ENTITY.CreditTopups]: 'Credit top-ups',
  [EXPORT_ENTITY.CreditUsage]: 'Credit usage',
  [EXPORT_ENTITY.UsageAnalytics]: 'Usage analytics',
}

export const EXPORT_INTERVAL_LABEL: Record<string, string> = {
  hourly: 'Hourly',
  daily: 'Daily',
}

export const EXPORT_STATE = { All: 'all', Enabled: 'enabled', Disabled: 'disabled' } as const
export type ExportState = (typeof EXPORT_STATE)[keyof typeof EXPORT_STATE]

export interface DataExport {
  id: string
  connectionId: string
  /** What is exported. The wire's own value when this build does not know it. */
  entity: string
  entityLabel: string
  interval: string
  intervalLabel: string
  enabled: boolean
  bucket: string
  region: string
  keyPrefix: string
  createdAt: Date | null
}

export interface DataExportQuery {
  page: number
  pageSize: number
  /** Narrows the returned page by bucket, prefix or entity. */
  search: string
  /** Server-side: `enabled` on `GET /tasks/scheduled`. */
  state: ExportState
}

export const DEFAULT_DATA_EXPORT_QUERY: DataExportQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  state: EXPORT_STATE.All,
}

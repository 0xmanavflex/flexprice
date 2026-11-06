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
  /** `none` or `gzip`. */
  compression: string
  /** `AES256`, or empty for the bucket's default. */
  encryption: string
  /** An S3-compatible endpoint (MinIO, R2…); empty for AWS. */
  endpointUrl: string
  /** Extra columns from the customer or wallet, on credit usage and usage analytics. */
  metadataFields: ExportMetadataField[]
  createdAt: Date | null
  updatedAt: Date | null
}

export interface DataExportQuery {
  page: number
  pageSize: number
  /** Only this connection's exports; empty for every connection. */
  connectionId?: string
  /** Narrows every export by bucket, prefix or entity (the endpoint has no search). */
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

/* ------------------------------------------------------------------------- */
/* Creating an export                                                        */
/* ------------------------------------------------------------------------- */

export const EXPORT_INTERVAL = { Hourly: 'hourly', Daily: 'daily' } as const
export type ExportInterval = (typeof EXPORT_INTERVAL)[keyof typeof EXPORT_INTERVAL]

/** What a metadata column is read from. */
export const EXPORT_METADATA_ENTITY = { Customer: 'customer', Wallet: 'wallet' } as const
export type ExportMetadataEntity =
  (typeof EXPORT_METADATA_ENTITY)[keyof typeof EXPORT_METADATA_ENTITY]

export const EXPORT_METADATA_ENTITY_LABEL: Record<ExportMetadataEntity, string> = {
  customer: 'Customer',
  wallet: 'Wallet',
}

/**
 * Which metadata a data set can carry, mirroring the API's own rule
 * (`allowedMetadataEntityTypes`): credit usage reads the customer or the
 * wallet, usage analytics the customer, the rest none.
 */
export const ALLOWED_METADATA_ENTITIES: Record<ExportEntity, ExportMetadataEntity[]> = {
  [EXPORT_ENTITY.CreditUsage]: [EXPORT_METADATA_ENTITY.Customer, EXPORT_METADATA_ENTITY.Wallet],
  [EXPORT_ENTITY.UsageAnalytics]: [EXPORT_METADATA_ENTITY.Customer],
  [EXPORT_ENTITY.Events]: [],
  [EXPORT_ENTITY.Invoice]: [],
  [EXPORT_ENTITY.CreditTopups]: [],
}

export interface ExportMetadataField {
  entity: ExportMetadataEntity
  /** The metadata key to read, e.g. `account_manager`. */
  fieldKey: string
  /** The column it is written to; empty uses the key. */
  columnName: string
}

/** A new export: what to send, how often, and where in the bucket. */
export interface CreateDataExport {
  connectionId: string
  entity: ExportEntity
  interval: ExportInterval
  enabled: boolean
  bucket: string
  region: string
  keyPrefix: string
  compression: 'none' | 'gzip'
  encryption: 'AES256'
  endpointUrl: string
  metadataFields: ExportMetadataField[]
}

export function emptyDataExport(connectionId: string): CreateDataExport {
  return {
    connectionId,
    entity: EXPORT_ENTITY.Events,
    interval: EXPORT_INTERVAL.Hourly,
    enabled: true,
    bucket: '',
    region: 'us-east-1',
    keyPrefix: 'flexprice-exports',
    compression: 'none',
    encryption: 'AES256',
    endpointUrl: '',
    metadataFields: [],
  }
}

export type DataExportErrors = Partial<
  Record<'bucket' | 'region' | 'keyPrefix' | 'endpointUrl' | 'metadataFields', string>
>

/**
 * What is wrong with a draft, by field. A Flexprice-managed connection owns
 * its bucket, so bucket, region and prefix are not asked for.
 */
export function validateDataExport(
  draft: CreateDataExport,
  { flexpriceManaged }: { flexpriceManaged: boolean },
): DataExportErrors {
  const errors: DataExportErrors = {}
  if (!flexpriceManaged) {
    if (!draft.bucket.trim()) errors.bucket = 'Enter the bucket name'
    if (!draft.region.trim()) errors.region = 'Enter the AWS region'
    if (!draft.keyPrefix.trim()) errors.keyPrefix = 'Enter a key prefix'
    if (draft.endpointUrl.trim() && !/^https?:\/\/\S+$/.test(draft.endpointUrl.trim()))
      errors.endpointUrl = 'Enter a full URL, starting with https://'
  }
  if (
    ALLOWED_METADATA_ENTITIES[draft.entity].length > 0 &&
    draft.metadataFields.some((field) => !field.fieldKey.trim())
  )
    errors.metadataFields = 'Every metadata field needs a key'
  return errors
}

/** Metadata rows that a new data set cannot carry move to one it can, or go. */
export function clampMetadataFields(
  fields: ExportMetadataField[],
  entity: ExportEntity,
): ExportMetadataField[] {
  const allowed = ALLOWED_METADATA_ENTITIES[entity]
  if (allowed.length === 0) return []
  return fields.map((field) =>
    allowed.includes(field.entity) ? field : { ...field, entity: allowed[0]! },
  )
}

/* ------------------------------------------------------------------------- */
/* Runs                                                                      */
/* ------------------------------------------------------------------------- */

export const EXPORT_RUN_STATUS = {
  All: 'all',
  Pending: 'PENDING',
  Processing: 'PROCESSING',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
} as const
export type ExportRunStatus = (typeof EXPORT_RUN_STATUS)[keyof typeof EXPORT_RUN_STATUS]

export const EXPORT_RUN_STATUS_LABEL: Record<ExportRunStatus, string> = {
  all: 'All',
  PENDING: 'Pending',
  PROCESSING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}

/** One run of an export: the window of data it wrote, and how it went. */
export interface ExportRun {
  id: string
  /** The wire's status, e.g. `COMPLETED`. */
  status: string
  /** The data window the run covered. */
  intervalStart: Date | null
  intervalEnd: Date | null
  startedAt: Date | null
  completedAt: Date | null
  records: number | null
  /** Set once the run wrote a file that can be downloaded. */
  hasFile: boolean
  error: string
}

export interface ExportRunQuery {
  page: number
  pageSize: number
  status: ExportRunStatus
}

export const DEFAULT_EXPORT_RUN_QUERY: ExportRunQuery = {
  page: 1,
  pageSize: 10,
  status: EXPORT_RUN_STATUS.All,
}

/** A manual run: the export's current interval, or a window of your choosing. */
export interface ExportRunRequest {
  startTime?: Date
  endTime?: Date
}

/* ------------------------------------------------------------------------- */
/* S3 connections                                                            */
/* ------------------------------------------------------------------------- */

/** Where exports are written: a bucket Flexprice manages, or one with your AWS keys. */
export interface S3Connection {
  id: string
  name: string
  /** The connection's status as the API reports it, e.g. `published`. */
  status: string
  flexpriceManaged: boolean
  createdAt: Date | null
}

export interface CreateS3Connection {
  name: string
  flexpriceManaged: boolean
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

export function emptyS3Connection(): CreateS3Connection {
  return {
    name: '',
    flexpriceManaged: false,
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
  }
}

export type S3ConnectionErrors = Partial<Record<'name' | 'accessKeyId' | 'secretAccessKey', string>>

/** Keys are needed only for a bucket you own. */
export function validateS3Connection(draft: CreateS3Connection): S3ConnectionErrors {
  const errors: S3ConnectionErrors = {}
  if (!draft.name.trim()) errors.name = 'Name the connection'
  if (!draft.flexpriceManaged) {
    if (!draft.accessKeyId.trim()) errors.accessKeyId = 'Enter the AWS access key ID'
    if (!draft.secretAccessKey.trim()) errors.secretAccessKey = 'Enter the AWS secret access key'
  }
  return errors
}

/** On edit the keys are optional; a new pair needs both halves. */
export function validateS3ConnectionEdit(draft: CreateS3Connection): S3ConnectionErrors {
  const errors: S3ConnectionErrors = {}
  if (!draft.name.trim()) errors.name = 'Name the connection'
  const accessKeyId = draft.accessKeyId.trim()
  const secretAccessKey = draft.secretAccessKey.trim()
  if (secretAccessKey && !accessKeyId) errors.accessKeyId = 'Enter the new AWS access key ID'
  if (accessKeyId && !secretAccessKey)
    errors.secretAccessKey = 'Enter the new AWS secret access key'
  return errors
}

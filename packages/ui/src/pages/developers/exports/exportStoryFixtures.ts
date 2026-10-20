import type { DataExport, ExportRun, S3Connection } from '@fp/domain'

/** Shared by the exports stories: two connections, an export, and a page of runs. */
export const CONNECTIONS: S3Connection[] = [
  {
    id: 'conn_s3_01',
    name: 'Acme data lake',
    status: 'published',
    flexpriceManaged: false,
    createdAt: new Date('2026-01-20T10:00:00Z'),
  },
  {
    id: 'conn_s3_02',
    name: 'Flexprice-managed bucket',
    status: 'published',
    flexpriceManaged: true,
    createdAt: new Date('2026-03-02T10:00:00Z'),
  },
]

export const EXPORT: DataExport = {
  id: 'task_0003',
  connectionId: 'conn_s3_01',
  entity: 'credit_usage',
  entityLabel: 'Credit usage',
  interval: 'daily',
  intervalLabel: 'Daily',
  enabled: true,
  bucket: 'acme-warehouse',
  region: 'eu-west-1',
  keyPrefix: 'flexprice/credits/',
  compression: 'gzip',
  encryption: 'AES256',
  endpointUrl: '',
  metadataFields: [{ entity: 'customer', fieldKey: 'account_manager', columnName: '' }],
  createdAt: new Date('2026-02-03T05:30:00Z'),
  updatedAt: new Date('2026-02-05T05:30:00Z'),
}

export const RUNS: ExportRun[] = Array.from({ length: 10 }, (_, index) => {
  const end = Date.UTC(2026, 9, 20) - index * 86_400_000
  const status = index === 0 ? 'PROCESSING' : index === 3 ? 'FAILED' : 'COMPLETED'
  return {
    id: `run_${String(index + 1).padStart(3, '0')}`,
    status,
    intervalStart: new Date(end - 86_400_000),
    intervalEnd: new Date(end),
    startedAt: new Date(end + 60_000),
    completedAt: status === 'COMPLETED' ? new Date(end + 120_000) : null,
    records: status === 'COMPLETED' ? 1200 + index * 31 : null,
    hasFile: status === 'COMPLETED',
    error: status === 'FAILED' ? 'Access denied writing to the bucket' : '',
  }
})

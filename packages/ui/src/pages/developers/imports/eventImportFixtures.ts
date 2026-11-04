import type { EventImport } from '@fp/domain'

/** Hand-authored imports for the stories: one of each state the list shows. */
export function eventImportFixtures(): EventImport[] {
  return [
    {
      id: 'task_01K8IMPORT00RUNNING',
      fileName: 'clickpost-usage-october.csv',
      status: 'PROCESSING',
      totalRecords: 48_000,
      processedRecords: 12_000,
      successfulRecords: 11_994,
      failedRecords: 6,
      errorSummary: '',
      createdAt: new Date('2026-11-04T09:12:00Z'),
      startedAt: new Date('2026-11-04T09:12:05Z'),
      completedAt: null,
      failedAt: null,
    },
    {
      id: 'task_01K8IMPORT0PARTIAL0',
      fileName: 'sms-backfill-september.csv',
      status: 'COMPLETED',
      totalRecords: 1_250,
      processedRecords: 1_250,
      successfulRecords: 1_247,
      failedRecords: 3,
      errorSummary:
        'Record 18: timestamp error: invalid timestamp format: parsing time "14/09/2026" as "2006-01-02T15:04:05Z07:00": cannot parse "14/09/2026" as "2006"; Record 402: event_name is required; Record 977: invalid JSON in properties column: unexpected end of JSON input',
      createdAt: new Date('2026-10-02T14:40:00Z'),
      startedAt: new Date('2026-10-02T14:40:03Z'),
      completedAt: new Date('2026-10-02T14:41:10Z'),
      failedAt: null,
    },
    {
      id: 'task_01K8IMPORT000CLEAN0',
      fileName: 'august-usage.csv',
      status: 'COMPLETED',
      totalRecords: 320,
      processedRecords: 320,
      successfulRecords: 320,
      failedRecords: 0,
      errorSummary: '',
      createdAt: new Date('2026-09-01T08:00:00Z'),
      startedAt: new Date('2026-09-01T08:00:02Z'),
      completedAt: new Date('2026-09-01T08:00:20Z'),
      failedAt: null,
    },
    {
      id: 'task_01K8IMPORT00FAILED0',
      fileName: 'usage.csv',
      status: 'FAILED',
      totalRecords: null,
      processedRecords: null,
      successfulRecords: null,
      failedRecords: null,
      errorSummary:
        'Failed to download import object; verify the upload_id and that CSV Box has finished uploading',
      createdAt: new Date('2026-08-20T11:00:00Z'),
      startedAt: new Date('2026-08-20T11:00:01Z'),
      completedAt: null,
      failedAt: new Date('2026-08-20T11:00:04Z'),
    },
  ]
}

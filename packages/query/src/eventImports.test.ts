import { describe, expect, it } from 'vitest'
import { CreateTaskRequest$outboundSchema } from '@flexprice/sdk/sdk/models'
import { DEFAULT_EVENT_IMPORT_QUERY, EVENT_IMPORT_STATUS } from '@fp/domain'
import { toCreateEventImportRequest, toEventImport, toEventImportFilter } from './eventImports'

describe('toEventImport', () => {
  it('maps a task, keeping a count the server has not written yet as unknown', () => {
    const row = toEventImport({
      id: 'task_1',
      fileName: 'march.csv',
      taskStatus: 'PROCESSING',
      totalRecords: 120,
      successfulRecords: 0,
      createdAt: new Date('2026-03-01T10:00:00Z'),
    })
    expect(row).toMatchObject({
      id: 'task_1',
      fileName: 'march.csv',
      status: 'PROCESSING',
      totalRecords: 120,
      successfulRecords: 0,
      failedRecords: null,
      errorSummary: '',
      completedAt: null,
    })
  })
})

describe('toEventImportFilter', () => {
  it('reads event imports only, and sends a status only when one is picked', () => {
    expect(toEventImportFilter({ ...DEFAULT_EVENT_IMPORT_QUERY, page: 3, pageSize: 10 })).toEqual({
      taskType: 'IMPORT',
      entityType: 'EVENTS',
      limit: 10,
      offset: 20,
      sort: 'created_at',
      order: 'desc',
    })
    expect(
      toEventImportFilter({ ...DEFAULT_EVENT_IMPORT_QUERY, status: EVENT_IMPORT_STATUS.Failed }),
    ).toMatchObject({ taskStatus: 'FAILED' })
  })
})

describe('toCreateEventImportRequest', () => {
  it('is the CSV Box upload the backend accepts', () => {
    expect(
      CreateTaskRequest$outboundSchema.parse(
        toCreateEventImportRequest({ uploadId: '81234', fileName: 'march.csv' }),
      ),
    ).toEqual({
      task_type: 'IMPORT',
      entity_type: 'EVENTS',
      file_type: 'CSV',
      file_provider: 'csvbox',
      upload_id: '81234',
      file_name: 'march.csv',
    })
  })
})

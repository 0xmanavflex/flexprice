import { describe, expect, it, vi } from 'vitest'
import { CreateScheduledTaskRequest$outboundSchema } from '@flexprice/sdk/sdk/models'
import {
  DEFAULT_DATA_EXPORT_QUERY,
  EXPORT_ENTITY,
  EXPORT_METADATA_ENTITY,
  EXPORT_STATE,
  emptyDataExport,
  emptyS3Connection,
} from '@fp/domain'
import type { Flexprice } from '@fp/api'
import {
  fetchDataExports,
  toCreateDataExportRequest,
  toCreateS3ConnectionRequest,
  toDataExport,
  toDataExportFilter,
  toExportRun,
  toS3Connection,
} from './dataExports'

describe('toDataExport', () => {
  it('maps a task and names its entity and interval', () => {
    const row = toDataExport({
      id: 'task_1',
      connectionId: 'conn_1',
      entityType: 'credit_usage',
      interval: 'daily',
      enabled: true,
      jobConfig: { bucket: 'acme-billing', region: 'us-east-1', keyPrefix: 'flexprice/' },
    })
    expect(row).toMatchObject({
      id: 'task_1',
      entityLabel: 'Credit usage',
      intervalLabel: 'Daily',
      enabled: true,
      bucket: 'acme-billing',
      region: 'us-east-1',
      keyPrefix: 'flexprice/',
    })
  })

  it('keeps an unknown entity as the wire spelled it', () => {
    expect(toDataExport({ entityType: 'refunds' }).entityLabel).toBe('refunds')
    expect(toDataExport({}).enabled).toBe(false)
  })
})

describe('toDataExportFilter', () => {
  it('sends enabled only when a state is chosen', () => {
    expect(toDataExportFilter(DEFAULT_DATA_EXPORT_QUERY)).toEqual({ limit: 25, offset: 0 })
    expect(
      toDataExportFilter({ ...DEFAULT_DATA_EXPORT_QUERY, page: 3, state: EXPORT_STATE.Disabled }),
    ).toEqual({ limit: 25, offset: 50, enabled: false })
  })
})

describe('fetchDataExports', () => {
  it('narrows the page by search and keeps the server total', async () => {
    const listScheduledTasks = vi.fn().mockResolvedValue({
      items: [
        { id: 'a', entityType: 'events', jobConfig: { bucket: 'alpha' } },
        { id: 'b', entityType: 'invoice', jobConfig: { bucket: 'beta' } },
      ],
      pagination: { total: 9 },
    })
    const client = { scheduledTasks: { listScheduledTasks } } as unknown as Flexprice
    const page = await fetchDataExports(client, { ...DEFAULT_DATA_EXPORT_QUERY, search: 'BET' })
    expect(page.exports.map((row) => row.id)).toEqual(['b'])
    expect(page.total).toBe(9)
  })
})

describe('V1 exports flow: requests', () => {
  const draft = {
    ...emptyDataExport('conn_1'),
    entity: EXPORT_ENTITY.CreditUsage,
    bucket: ' acme-billing ',
    metadataFields: [
      { entity: EXPORT_METADATA_ENTITY.Customer, fieldKey: ' account_manager ', columnName: '' },
    ],
    endpointUrl: 'https://minio.local',
  }

  it('sends the bucket, prefix, metadata and a path-style custom endpoint for your own bucket', () => {
    const request = toCreateDataExportRequest(draft, { flexpriceManaged: false })
    expect(request).toMatchObject({
      connectionId: 'conn_1',
      entityType: 'credit_usage',
      interval: 'hourly',
      enabled: true,
      jobConfig: {
        bucket: 'acme-billing',
        region: 'us-east-1',
        keyPrefix: 'flexprice-exports',
        compression: 'none',
        encryption: 'AES256',
        endpointUrl: 'https://minio.local',
        usePathStyle: true,
        exportMetadataFields: [{ entityType: 'customer', fieldKey: 'account_manager' }],
      },
    })
    const wire = CreateScheduledTaskRequest$outboundSchema.parse(request) as {
      job_config: Record<string, unknown>
    }
    expect(wire.job_config['export_metadata_fields']).toEqual([
      { entity_type: 'customer', field_key: 'account_manager' },
    ])
  })

  it('leaves the bucket to Flexprice on a managed connection', () => {
    const request = toCreateDataExportRequest(draft, { flexpriceManaged: true }) as {
      jobConfig: Record<string, unknown>
    }
    expect(request.jobConfig).not.toHaveProperty('bucket')
    expect(request.jobConfig).not.toHaveProperty('endpointUrl')
  })

  it('connects S3 with keys, or as Flexprice-managed with none', () => {
    expect(
      toCreateS3ConnectionRequest({
        ...emptyS3Connection(),
        name: ' Lake ',
        accessKeyId: 'AKIA',
        secretAccessKey: 'secret',
      }),
    ).toEqual({
      name: 'Lake',
      provider_type: 's3',
      encrypted_secret_data: {
        provider_type: 's3',
        aws_access_key_id: 'AKIA',
        aws_secret_access_key: 'secret',
      },
    })
    expect(
      toCreateS3ConnectionRequest({
        ...emptyS3Connection(),
        name: 'Managed',
        flexpriceManaged: true,
      }),
    ).toEqual({
      name: 'Managed',
      provider_type: 's3',
      sync_config: { s3: { is_flexprice_managed: true } },
    })
  })

  it('reads a run’s data window from its metadata, and a connection’s managed flag', () => {
    const run = toExportRun({
      id: 'run_1',
      taskStatus: 'COMPLETED',
      metadata: { start_time: '2026-10-19T00:00:00Z', end_time: '2026-10-20T00:00:00Z' },
      fileUrl: 's3://x',
      totalRecords: 12,
    })
    expect(run).toMatchObject({ status: 'COMPLETED', hasFile: true, records: 12 })
    expect(run.intervalStart?.toISOString()).toBe('2026-10-19T00:00:00.000Z')
    expect(
      toS3Connection({ id: 'c', name: 'n', sync_config: { s3: { is_flexprice_managed: true } } })
        .flexpriceManaged,
    ).toBe(true)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_DATA_EXPORT_QUERY, EXPORT_STATE } from '@fp/domain'
import type { Flexprice } from '@fp/api'
import { fetchDataExports, toDataExport, toDataExportFilter } from './dataExports'

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

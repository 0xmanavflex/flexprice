import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type DataExport,
  type DataExportQuery,
  EXPORT_ENTITY_LABEL,
  EXPORT_INTERVAL_LABEL,
  EXPORT_STATE,
  type ExportEntity,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Scheduled exports, through `GET /tasks/scheduled`
 * (`client.scheduledTasks.listScheduledTasks`). Whether an export is enabled is
 * a server-side filter; search narrows the returned page.
 */

export interface DataExportWire {
  id?: string | undefined
  connectionId?: string | undefined
  entityType?: string | undefined
  interval?: string | undefined
  enabled?: boolean | undefined
  jobConfig?: { bucket?: string | undefined; region?: string | undefined; keyPrefix?: string | undefined } | undefined
  createdAt?: Date | undefined
}

export function toDataExport(wire: DataExportWire): DataExport {
  const entity = wire.entityType ?? ''
  const interval = wire.interval ?? ''
  return {
    id: wire.id ?? '',
    connectionId: wire.connectionId ?? '',
    entity,
    entityLabel: EXPORT_ENTITY_LABEL[entity as ExportEntity] ?? entity,
    interval,
    intervalLabel: EXPORT_INTERVAL_LABEL[interval] ?? interval,
    enabled: wire.enabled === true,
    bucket: wire.jobConfig?.bucket ?? '',
    region: wire.jobConfig?.region ?? '',
    keyPrefix: wire.jobConfig?.keyPrefix ?? '',
    createdAt: wire.createdAt ?? null,
  }
}

export function toDataExportFilter(query: DataExportQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    ...(query.state === EXPORT_STATE.All ? {} : { enabled: query.state === EXPORT_STATE.Enabled }),
  }
}

export interface DataExportPage {
  exports: DataExport[]
  total: number
}

export async function fetchDataExports(
  client: Flexprice,
  query: DataExportQuery,
): Promise<DataExportPage> {
  const response = await call(() =>
    client.scheduledTasks.listScheduledTasks(toDataExportFilter(query) as never),
  )
  const all = (response.items ?? []).map((item) => toDataExport(item as DataExportWire))

  const term = query.search.trim().toLowerCase()
  const exports = term
    ? all.filter((row) =>
        [row.bucket, row.keyPrefix, row.entityLabel, row.region].some((field) =>
          field.toLowerCase().includes(term),
        ),
      )
    : all

  return { exports, total: response.pagination?.total ?? all.length }
}

export function useDataExports(query: DataExportQuery) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.dataExports.list({ ...query }),
    queryFn: () => fetchDataExports(client, query),
    placeholderData: (previous) => previous,
  })
}

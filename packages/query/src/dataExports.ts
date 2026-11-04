import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  ErrorKind,
  type Flexprice,
  call,
  createConnection,
  listConnections,
} from '@fp/api'
import {
  type CreateDataExport,
  type CreateS3Connection,
  type DataExport,
  type DataExportQuery,
  EXPORT_ENTITY_LABEL,
  EXPORT_INTERVAL_LABEL,
  EXPORT_METADATA_ENTITY,
  EXPORT_RUN_STATUS,
  EXPORT_STATE,
  type ExportEntity,
  type ExportMetadataEntity,
  type ExportRun,
  type ExportRunQuery,
  type ExportRunRequest,
  type S3Connection,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Scheduled exports, through `GET /tasks/scheduled`
 * (`client.scheduledTasks.listScheduledTasks`). Whether an export is enabled is
 * a server-side filter. The endpoint has no search, so every export is read
 * (an account keeps a handful) and the search and page are cut from the set.
 */

export interface DataExportWire {
  id?: string | undefined
  connectionId?: string | undefined
  entityType?: string | undefined
  interval?: string | undefined
  enabled?: boolean | undefined
  jobConfig?:
    | {
        bucket?: string | undefined
        region?: string | undefined
        keyPrefix?: string | undefined
        compression?: string | undefined
        encryption?: string | undefined
        endpointUrl?: string | undefined
        exportMetadataFields?:
          { entityType?: string; fieldKey?: string; columnName?: string | undefined }[] | undefined
      }
    | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

const METADATA_ENTITIES = new Set<string>(Object.values(EXPORT_METADATA_ENTITY))

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
    compression: wire.jobConfig?.compression ?? '',
    encryption: wire.jobConfig?.encryption ?? '',
    endpointUrl: wire.jobConfig?.endpointUrl ?? '',
    metadataFields: (wire.jobConfig?.exportMetadataFields ?? [])
      .filter((field) => METADATA_ENTITIES.has(field.entityType ?? ''))
      .map((field) => ({
        entity: field.entityType as ExportMetadataEntity,
        fieldKey: field.fieldKey ?? '',
        columnName: field.columnName ?? '',
      })),
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

export function toDataExportFilter(query: DataExportQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    ...(query.connectionId ? { connectionId: query.connectionId } : {}),
    ...(query.state === EXPORT_STATE.All ? {} : { enabled: query.state === EXPORT_STATE.Enabled }),
  }
}

export interface DataExportPage {
  exports: DataExport[]
  total: number
}

/** Exports read per request while reading them all. */
const SCAN_PAGE_SIZE = 500

/** Every export of the query's connection and state, read page by page. */
export async function fetchAllDataExports(
  client: Flexprice,
  query: Pick<DataExportQuery, 'connectionId' | 'state'>,
): Promise<DataExport[]> {
  const all: DataExport[] = []
  for (let page = 1; ; page += 1) {
    const response = await call(() =>
      client.scheduledTasks.listScheduledTasks(
        toDataExportFilter({ ...query, page, pageSize: SCAN_PAGE_SIZE, search: '' }) as never,
      ),
    )
    const items = response.items ?? []
    all.push(...items.map((item) => toDataExport(item as DataExportWire)))
    const total = response.pagination?.total ?? 0
    if (items.length < SCAN_PAGE_SIZE || all.length >= total) break
  }
  return all
}

/** The page the query asks for, cut from every export: search, then page. */
export function selectDataExportPage(
  all: readonly DataExport[],
  query: DataExportQuery,
): DataExportPage {
  const term = query.search.trim().toLowerCase()
  const matching = term
    ? all.filter((row) =>
        [row.bucket, row.keyPrefix, row.entityLabel, row.region].some((field) =>
          field.toLowerCase().includes(term),
        ),
      )
    : [...all]
  const start = (query.page - 1) * query.pageSize
  return { exports: matching.slice(start, start + query.pageSize), total: matching.length }
}

export async function fetchDataExports(
  client: Flexprice,
  query: DataExportQuery,
): Promise<DataExportPage> {
  return selectDataExportPage(await fetchAllDataExports(client, query), query)
}

export function useDataExports(query: DataExportQuery) {
  const client = useFlexprice()

  // One cached read per connection and state; search and paging cut from it.
  return useQuery({
    queryKey: queryKeys.dataExports.list({
      connectionId: query.connectionId ?? '',
      state: query.state,
      scan: true,
    }),
    queryFn: () => fetchAllDataExports(client, query),
    select: (all: DataExport[]) => selectDataExportPage(all, query),
    placeholderData: (previous) => previous,
  })
}

/** One export: `GET /tasks/scheduled/{id}`. */
export function useDataExport(id: string) {
  const client = useFlexprice()
  return useQuery({
    queryKey: queryKeys.dataExports.detail(id),
    queryFn: async () =>
      toDataExport(
        (await call(() => client.scheduledTasks.getScheduledTask(id))) as DataExportWire,
      ),
    enabled: Boolean(id),
  })
}

/**
 * How many exports each connection has, from one page of every export rather
 * than a request per connection.
 */
export function useDataExportCounts() {
  const client = useFlexprice()
  return useQuery({
    queryKey: queryKeys.dataExports.counts(),
    queryFn: async () => {
      const response = await call(() =>
        client.scheduledTasks.listScheduledTasks({ limit: 500, offset: 0 }),
      )
      const counts = new Map<string, number>()
      for (const item of response.items ?? []) {
        const id = item.connectionId ?? ''
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      return counts
    },
  })
}

type CreateScheduledTaskBody = Parameters<Flexprice['scheduledTasks']['createScheduledTask']>[0]
type ListTasksBody = NonNullable<Parameters<Flexprice['tasks']['listTasks']>[0]>

/** The request body for a new export: a managed bucket sends no bucket details. */
export function toCreateDataExportRequest(
  draft: CreateDataExport,
  { flexpriceManaged }: { flexpriceManaged: boolean },
): CreateScheduledTaskBody {
  const metadata = draft.metadataFields.map((field) => ({
    entityType: field.entity,
    fieldKey: field.fieldKey.trim(),
    ...(field.columnName.trim() ? { columnName: field.columnName.trim() } : {}),
  }))
  const endpointUrl = draft.endpointUrl.trim()
  return {
    connectionId: draft.connectionId,
    entityType: draft.entity,
    interval: draft.interval,
    enabled: draft.enabled,
    jobConfig: {
      compression: draft.compression,
      encryption: draft.encryption,
      ...(metadata.length > 0 ? { exportMetadataFields: metadata } : {}),
      ...(flexpriceManaged
        ? {}
        : {
            bucket: draft.bucket.trim(),
            region: draft.region.trim(),
            keyPrefix: draft.keyPrefix.trim(),
            // A custom endpoint (MinIO, R2…) is addressed by path, as V1 sends it.
            ...(endpointUrl ? { endpointUrl, usePathStyle: true } : {}),
          }),
    },
  }
}

function useRefreshExports() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: queryKeys.dataExports.all() })
}

/** Creates an export: `POST /tasks/scheduled`. */
export function useCreateDataExport() {
  const client = useFlexprice()
  const refresh = useRefreshExports()
  return useMutation({
    mutationFn: async ({
      draft,
      flexpriceManaged,
    }: {
      draft: CreateDataExport
      flexpriceManaged: boolean
    }) =>
      toDataExport(
        (await call(() =>
          client.scheduledTasks.createScheduledTask(
            toCreateDataExportRequest(draft, { flexpriceManaged }),
          ),
        )) as DataExportWire,
      ),
    onSuccess: refresh,
  })
}

/** Pauses or resumes an export: `PUT /tasks/scheduled/{id}`. */
export function useSetDataExportEnabled() {
  const client = useFlexprice()
  const refresh = useRefreshExports()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      call(() => client.scheduledTasks.updateScheduledTask(id, { enabled })),
    onSuccess: refresh,
  })
}

/** Deletes an export: `DELETE /tasks/scheduled/{id}`. */
export function useDeleteDataExport() {
  const client = useFlexprice()
  const refresh = useRefreshExports()
  return useMutation({
    mutationFn: (id: string) => call(() => client.scheduledTasks.deleteScheduledTask(id)),
    onSuccess: refresh,
  })
}

/** Runs an export now, for its current interval or a chosen window: `POST /tasks/scheduled/{id}/run`. */
export function useRunDataExport() {
  const client = useFlexprice()
  const refresh = useRefreshExports()
  return useMutation({
    mutationFn: ({ id, window }: { id: string; window: ExportRunRequest }) =>
      call(() =>
        client.scheduledTasks.triggerScheduledTaskRun(
          id,
          window.startTime && window.endTime
            ? { customerExternalIds: [], startTime: window.startTime, endTime: window.endTime }
            : { customerExternalIds: [] },
        ),
      ),
    onSuccess: refresh,
  })
}

export interface ExportRunWire {
  id?: string | undefined
  taskStatus?: string | undefined
  metadata?: Record<string, unknown> | undefined
  startedAt?: Date | undefined
  completedAt?: Date | undefined
  createdAt?: Date | undefined
  totalRecords?: number | undefined
  fileUrl?: string | undefined
  errorSummary?: string | undefined
}

function dateOf(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toExportRun(wire: ExportRunWire): ExportRun {
  return {
    id: wire.id ?? '',
    status: wire.taskStatus ?? '',
    intervalStart: dateOf(wire.metadata?.['start_time']),
    intervalEnd: dateOf(wire.metadata?.['end_time']),
    startedAt: wire.startedAt ?? wire.createdAt ?? null,
    completedAt: wire.completedAt ?? null,
    records: typeof wire.totalRecords === 'number' ? wire.totalRecords : null,
    hasFile: Boolean(wire.fileUrl),
    error: wire.errorSummary ?? '',
  }
}

/** An export's runs: `GET /tasks?scheduled_task_id=…&task_type=EXPORT`. */
export function useExportRuns(exportId: string, query: ExportRunQuery) {
  const client = useFlexprice()
  return useQuery({
    queryKey: queryKeys.dataExports.runs(exportId, { ...query }),
    queryFn: async () => {
      const request: ListTasksBody = {
        scheduledTaskId: exportId,
        taskType: 'EXPORT',
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
        ...(query.status === EXPORT_RUN_STATUS.All ? {} : { taskStatus: query.status }),
      }
      const response = await call(() => client.tasks.listTasks(request))
      return {
        runs: (response.items ?? []).map((item) => toExportRun(item as ExportRunWire)),
        total: response.pagination?.total ?? response.items?.length ?? 0,
      }
    },
    enabled: Boolean(exportId),
    placeholderData: (previous) => previous,
  })
}

/** A short-lived link to the file a run wrote: `GET /tasks/{id}/download`. */
export function useDownloadExportRun() {
  const client = useFlexprice()
  return useMutation({
    mutationFn: async (runId: string) => {
      const body = await call(() => client.tasks.downloadTaskExport(runId))
      const url = body['download_url'] ?? body['downloadUrl']
      if (!url) throw new ApiError(ErrorKind.Server, 'The run has no file to download.')
      return url
    },
  })
}

/* ------------------------------------------------------------------------- */
/* S3 connections                                                            */
/* ------------------------------------------------------------------------- */

export interface S3ConnectionWire {
  id?: string
  name?: string
  provider_type?: string
  connection_status?: string
  sync_config?: { s3?: { is_flexprice_managed?: boolean } | null } | null
  created_at?: string
}

export function toS3Connection(wire: S3ConnectionWire): S3Connection {
  return {
    id: wire.id ?? '',
    name: wire.name ?? '',
    status: wire.connection_status ?? '',
    flexpriceManaged: wire.sync_config?.s3?.is_flexprice_managed === true,
    createdAt: wire.created_at ? new Date(wire.created_at) : null,
  }
}

async function credentials(auth: ReturnType<typeof useFlexpriceAuth>, verb: string) {
  const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
  if (!token) throw new ApiError(ErrorKind.Unauthorized, `Sign in to ${verb} S3 connections.`)
  return { token, environmentId: environmentId ?? '' }
}

/** The environment's S3 connections: `GET /connections`, narrowed to `s3`. */
export function useS3Connections() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useQuery({
    queryKey: queryKeys.s3Connections.all(),
    queryFn: async () => {
      const { token, environmentId } = await credentials(auth, 'view')
      const body = (await listConnections(serverURL, token, environmentId)) as {
        connections?: S3ConnectionWire[] | null
      } | null
      return (body?.connections ?? [])
        .filter((wire) => wire.provider_type === 's3')
        .map(toS3Connection)
    },
  })
}

/** The request for a new S3 connection: the managed flag, or the AWS keys. */
export function toCreateS3ConnectionRequest(draft: CreateS3Connection) {
  return {
    name: draft.name.trim(),
    provider_type: 's3',
    ...(draft.flexpriceManaged
      ? { sync_config: { s3: { is_flexprice_managed: true } } }
      : {
          encrypted_secret_data: {
            provider_type: 's3',
            aws_access_key_id: draft.accessKeyId.trim(),
            aws_secret_access_key: draft.secretAccessKey.trim(),
            ...(draft.sessionToken.trim() ? { aws_session_token: draft.sessionToken.trim() } : {}),
          },
        }),
  }
}

/** Connects an S3 bucket: `POST /connections`. */
export function useCreateS3Connection() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (draft: CreateS3Connection) => {
      const { token, environmentId } = await credentials(auth, 'add')
      await createConnection(serverURL, token, environmentId, toCreateS3ConnectionRequest(draft))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.s3Connections.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() })
    },
  })
}

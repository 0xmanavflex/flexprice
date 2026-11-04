import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  EVENT_IMPORT_STATUS,
  type EventImport,
  type EventImportQuery,
  isEventImportActive,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Usage-event CSV imports, through `GET /tasks?task_type=IMPORT&entity_type=EVENTS`.
 *
 * The file never passes through the console: CSV Box uploads it to the
 * Flexprice-managed imports bucket and hands back an upload id, which
 * `POST /tasks` turns into a background import. The backend accepts no other
 * upload route today (`file_provider` must be `csvbox`).
 */

export interface EventImportWire {
  id?: string | undefined
  fileName?: string | undefined
  taskStatus?: string | undefined
  totalRecords?: number | undefined
  processedRecords?: number | undefined
  successfulRecords?: number | undefined
  failedRecords?: number | undefined
  errorSummary?: string | undefined
  createdAt?: Date | undefined
  startedAt?: Date | undefined
  completedAt?: Date | undefined
  failedAt?: Date | undefined
}

const count = (value: number | undefined) => (typeof value === 'number' ? value : null)

export function toEventImport(wire: EventImportWire): EventImport {
  return {
    id: wire.id ?? '',
    fileName: wire.fileName ?? '',
    status: wire.taskStatus ?? '',
    totalRecords: count(wire.totalRecords),
    processedRecords: count(wire.processedRecords),
    successfulRecords: count(wire.successfulRecords),
    failedRecords: count(wire.failedRecords),
    errorSummary: wire.errorSummary ?? '',
    createdAt: wire.createdAt ?? null,
    startedAt: wire.startedAt ?? null,
    completedAt: wire.completedAt ?? null,
    failedAt: wire.failedAt ?? null,
  }
}

type ListTasksBody = NonNullable<Parameters<Flexprice['tasks']['listTasks']>[0]>
type CreateTaskBody = Parameters<Flexprice['tasks']['createTask']>[0]

export function toEventImportFilter(query: EventImportQuery): ListTasksBody {
  return {
    taskType: 'IMPORT',
    entityType: 'EVENTS',
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: 'created_at',
    order: 'desc',
    ...(query.status === EVENT_IMPORT_STATUS.All ? {} : { taskStatus: query.status }),
  }
}

/** What CSV Box reports once a file is in the bucket. */
export interface EventImportUpload {
  uploadId: string
  fileName: string
}

export function toCreateEventImportRequest(upload: EventImportUpload): CreateTaskBody {
  return {
    taskType: 'IMPORT',
    entityType: 'EVENTS',
    fileType: 'CSV',
    fileProvider: 'csvbox',
    uploadId: upload.uploadId,
    ...(upload.fileName ? { fileName: upload.fileName } : {}),
  }
}

/** How often a list or sheet showing a queued or running import re-reads it. */
const ACTIVE_POLL_MS = 5_000

export interface EventImportPage {
  imports: EventImport[]
  total: number
}

export function useEventImports(query: EventImportQuery) {
  const client = useFlexprice()
  const { open: _open, search: _search, ...filter } = query
  return useQuery({
    queryKey: queryKeys.eventImports.list({ ...filter }),
    queryFn: async (): Promise<EventImportPage> => {
      const response = await call(() => client.tasks.listTasks(toEventImportFilter(query)))
      return {
        imports: (response.items ?? []).map((item) => toEventImport(item as EventImportWire)),
        total: response.pagination?.total ?? response.items?.length ?? 0,
      }
    },
    placeholderData: (previous) => previous,
    // An import finishes on its own, so the list follows it while one is running.
    refetchInterval: (state) =>
      state.state.data?.imports.some((row) => isEventImportActive(row.status))
        ? ACTIVE_POLL_MS
        : false,
  })
}

/** One import: `GET /tasks/{id}`. */
export function useEventImport(id: string) {
  const client = useFlexprice()
  return useQuery({
    queryKey: queryKeys.eventImports.detail(id),
    queryFn: async () =>
      toEventImport((await call(() => client.tasks.getTask(id))) as EventImportWire),
    enabled: Boolean(id),
    refetchInterval: (state) =>
      state.state.data && isEventImportActive(state.state.data.status) ? ACTIVE_POLL_MS : false,
  })
}

/** Starts an import of an uploaded file: `POST /tasks`. */
export function useCreateEventImport() {
  const client = useFlexprice()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (upload: EventImportUpload) =>
      call(() => client.tasks.createTask(toCreateEventImportRequest(upload))),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.eventImports.all() }),
  })
}

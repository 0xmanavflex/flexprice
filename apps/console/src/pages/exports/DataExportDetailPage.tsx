import { useState } from 'react'
import { DEFAULT_EXPORT_RUN_QUERY, type ExportRunQuery } from '@fp/domain'
import {
  ApiError,
  useDataExport,
  useDeleteDataExport,
  useDownloadExportRun,
  useExportRuns,
  useRunDataExport,
  useS3Connections,
  useSetDataExportEnabled,
} from '@fp/query'
import { ErrorState, PageLoadingState } from '@fp/ui/compositions'
import { DataExportDetail, type DataExportTab, ExportRunList } from '@fp/ui/pages'
import { toListFailure } from '../shared/listFailure'
import { writeError } from './exportFailure'

export interface DataExportDetailPageProps {
  connectionId: string
  exportId: string
  tab: DataExportTab
  onTabChange: (tab: DataExportTab) => void
  onBackToExports: () => void
  onBackToS3: () => void
  onBackToConnection: () => void
}

/** One export, wired: pause or resume, run now, delete, and its runs (V1's export details). */
export function DataExportDetailPage({
  connectionId,
  exportId,
  tab,
  onTabChange,
  onBackToExports,
  onBackToS3,
  onBackToConnection,
}: DataExportDetailPageProps) {
  const dataExport = useDataExport(exportId)
  const connections = useS3Connections()
  const [runQuery, setRunQuery] = useState<ExportRunQuery>(DEFAULT_EXPORT_RUN_QUERY)
  const runs = useExportRuns(exportId, runQuery)
  const setEnabled = useSetDataExportEnabled()
  const run = useRunDataExport()
  const remove = useDeleteDataExport()
  const download = useDownloadExportRun()

  if (dataExport.isPending) return <PageLoadingState variant="detail" label="Loading export" />
  if (dataExport.error || !dataExport.data) {
    const failure = toListFailure(dataExport.error, 'this export')
    return (
      <ErrorState
        variant="page"
        title={
          dataExport.error instanceof ApiError && dataExport.error.kind === 'not_found'
            ? 'This export no longer exists'
            : 'This export could not be loaded'
        }
        {...(failure ? { description: failure.message, kind: failure.kind } : {})}
        isRetrying={dataExport.isFetching}
        {...(failure?.canRetry ? { onRetry: () => void dataExport.refetch() } : {})}
      />
    )
  }

  const record = dataExport.data
  const connection = connections.data?.find((row) => row.id === connectionId)
  const runFailure = toListFailure(runs.error, 'runs')
  const attempt = async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action()
    } catch (error) {
      throw writeError(error, fallback)
    }
  }

  return (
    <DataExportDetail
      dataExport={record}
      connection={connection}
      tab={tab}
      onTabChange={onTabChange}
      trail={[
        { label: 'Exports', onClick: onBackToExports },
        { label: 'Amazon S3', onClick: onBackToS3 },
        { label: connection?.name || 'Connection', onClick: onBackToConnection },
        { label: `${record.entityLabel} export` },
      ]}
      onSetEnabled={(enabled) =>
        attempt(
          () => setEnabled.mutateAsync({ id: record.id, enabled }),
          'The export could not be updated.',
        )
      }
      onRun={(window) =>
        attempt(async () => {
          await run.mutateAsync({ id: record.id, window })
          void runs.refetch()
        }, 'The export could not be started.')
      }
      onDelete={() =>
        attempt(async () => {
          await remove.mutateAsync(record.id)
          onBackToConnection()
        }, 'The export could not be deleted.')
      }
      runs={
        <ExportRunList
          runs={runs.data?.runs ?? []}
          total={runs.data?.total ?? 0}
          query={runQuery}
          onQueryChange={setRunQuery}
          isLoading={runs.isPending}
          error={runFailure?.message ?? null}
          {...(runFailure?.canRetry ? { onRetry: () => void runs.refetch() } : {})}
          onDownload={async (row) => {
            try {
              return await download.mutateAsync(row.id)
            } catch (error) {
              throw writeError(error, 'The file could not be downloaded.')
            }
          }}
        />
      }
    />
  )
}

import type { S3Connection } from '@fp/domain'
import {
  useCreateS3Connection,
  useDataExportCounts,
  useDisconnectIntegration,
  useS3Connections,
  useUpdateS3Connection,
} from '@fp/query'
import { S3ConnectionList } from '@fp/ui/pages'
import { toListFailure } from '../shared/listFailure'
import { writeError } from './exportFailure'

export interface S3ConnectionsPageProps {
  onBack: () => void
  onOpen: (connection: S3Connection) => void
}

/** The S3 connections, each with how many exports it has (V1's S3 page). */
export function S3ConnectionsPage({ onBack, onOpen }: S3ConnectionsPageProps) {
  const connections = useS3Connections()
  const counts = useDataExportCounts()
  const create = useCreateS3Connection()
  const update = useUpdateS3Connection()
  const disconnect = useDisconnectIntegration()
  const failure = toListFailure(connections.error, 'S3 connections')

  return (
    <S3ConnectionList
      connections={connections.data ?? []}
      exportCounts={counts.data}
      isLoading={connections.isPending}
      error={failure?.message ?? null}
      {...(failure?.canRetry ? { onRetry: () => void connections.refetch() } : {})}
      onBack={onBack}
      onOpen={onOpen}
      onCreate={async (draft) => {
        try {
          await create.mutateAsync(draft)
        } catch (error) {
          throw writeError(error, 'The connection could not be created.')
        }
      }}
      onUpdate={async (connection, draft) => {
        try {
          await update.mutateAsync({ id: connection.id, draft })
        } catch (error) {
          throw writeError(error, 'The connection could not be updated.')
        }
      }}
      onDelete={async (connection) => {
        try {
          await disconnect.mutateAsync(connection.id)
          await connections.refetch()
        } catch (error) {
          throw writeError(error, 'The connection could not be deleted.')
        }
      }}
    />
  )
}

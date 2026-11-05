import { useEffect, useRef, useState } from 'react'
import { toast } from '@fp/ui/pages'
import { WorkflowStatus, type EntitySyncRun } from '@fp/domain'
import { runsSince, syncWatchDone, useEntitySyncRuns, type SyncedEntityType } from '@fp/query'

const FAILED: ReadonlySet<string> = new Set([
  WorkflowStatus.Failed,
  WorkflowStatus.TimedOut,
  WorkflowStatus.Terminated,
])

const names = (runs: readonly EntitySyncRun[]) => runs.map((run) => run.provider).join(', ')

/**
 * Follows a push to its end. The sync call only starts one workflow per
 * provider, so its success says nothing about the provider: after `watch()`
 * the entity's sync runs are read until each that started has finished, then
 * the outcome is toasted and `onFinished` refreshes what the sync changed.
 */
export function useSyncWatch(type: SyncedEntityType, id: string, onFinished: () => void) {
  const [since, setSince] = useState<number | null>(null)
  const runs = useEntitySyncRuns(type, id, since)
  const finished = useRef(onFinished)
  finished.current = onFinished

  useEffect(() => {
    if (since === null || !runs.data || !syncWatchDone(runs.data, since)) return
    const started = runsSince(runs.data, since)
    setSince(null)
    finished.current()
    const failed = started.filter((run) => run.status !== null && FAILED.has(run.status))
    const synced = started.filter((run) => run.status === WorkflowStatus.Completed)
    const running = started.filter((run) => !failed.includes(run) && !synced.includes(run))
    if (failed.length > 0)
      toast.error(`Sync to ${names(failed)} failed`, {
        description: 'Open Workflows for the error, then push again.',
      })
    if (synced.length > 0) toast.success(`Synced to ${names(synced)}`)
    if (running.length > 0)
      toast(`Still syncing to ${names(running)}`, {
        description: 'This is taking longer than usual. Its status updates when you reload.',
      })
  }, [runs.data, runs.dataUpdatedAt, since])

  return {
    runs: runs.data ?? [],
    watching: since !== null,
    watch: () => setSince(Date.now()),
  }
}

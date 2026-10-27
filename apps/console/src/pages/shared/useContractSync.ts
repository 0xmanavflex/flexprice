import { useEffect, useState } from 'react'
import {
  WORKFLOW_WATCH_MAX_MS,
  isFinishedWorkflow,
  useWorkflowRun,
  type WorkflowHandle,
} from '@fp/query'
import { toast } from '@fp/ui/pages'
import { syncOutcome, type SyncStarted } from './contractSync'

/**
 * "Sync to contracts" for a plan or an add-on. The sync runs as a Temporal
 * workflow: the call returns its handle at once and the work finishes in the
 * background. So the start is announced, then the run is watched through the
 * workflow search until it finishes, and a second toast says done or failed.
 * Watching stops on unmount and after {@link WORKFLOW_WATCH_MAX_MS}.
 */
export function useContractSync(subject: 'plan' | 'add-on') {
  const [watched, setWatched] = useState<(WorkflowHandle & { since: number }) | null>(null)
  const run = useWorkflowRun(watched)

  useEffect(() => {
    if (!watched) return
    if (isFinishedWorkflow(run.data)) {
      const outcome = syncOutcome(run.data?.status ?? null)
      if (outcome.ok) {
        toast.success(outcome.title, {
          description: `Contracts with this ${subject} are up to date.`,
        })
      } else {
        toast.error(outcome.title, {
          description: 'Some contracts were not updated. Open Workflows for the details.',
        })
      }
      setWatched(null)
      return
    }
    if (run.isError) {
      toast('Could not check the sync', {
        description: 'It is still running in the background. Open Workflows for its status.',
      })
      setWatched(null)
    }
  }, [watched, run.data, run.isError, subject])

  // Past the watch limit, say so once instead of polling forever.
  useEffect(() => {
    if (!watched) return
    const timer = setTimeout(
      () => {
        toast('The sync is still running', {
          description: 'Open Workflows to follow it.',
        })
        setWatched(null)
      },
      Math.max(0, watched.since + WORKFLOW_WATCH_MAX_MS - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [watched])

  return {
    /** Call with the sync call's answer. */
    started(result: SyncStarted | undefined) {
      toast('Sync started', {
        description: `Contracts with this ${subject} are being brought up to date.`,
      })
      if (result?.workflowId) {
        setWatched({ workflowId: result.workflowId, runId: result.runId ?? '', since: Date.now() })
      }
    },
    /** True while a started sync is being watched. */
    watching: watched !== null,
  }
}

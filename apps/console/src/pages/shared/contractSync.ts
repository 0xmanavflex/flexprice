import { WORKFLOW_STATUS_LABEL, WorkflowStatus } from '@fp/domain'

/** What `POST /plans|addons/{id}/sync/subscriptions` answers (`models.TemporalWorkflowResult`). */
export interface SyncStarted {
  workflowId?: string | undefined
  runId?: string | undefined
}

/** The toast a finished sync raises: done, or failed with the run's status. */
export function syncOutcome(status: WorkflowStatus | null): { ok: boolean; title: string } {
  if (status === WorkflowStatus.Completed) return { ok: true, title: 'Sync finished' }
  const label = status ? WORKFLOW_STATUS_LABEL[status].toLowerCase() : 'failed'
  return { ok: false, title: status === WorkflowStatus.Failed ? 'Sync failed' : `Sync ${label}` }
}

/**
 * One workflow execution, as the Workflows list reads it.
 *
 * Flexprice runs long operations: syncing prices, processing a billing
 * period, exporting data: as workflows, and this is the record of one attempt.
 * The list is a monitor: what ran, whether it finished, how long it took.
 */
export const WorkflowStatus = {
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Canceled: 'canceled',
  Terminated: 'terminated',
  ContinuedAsNew: 'continuedAsNew',
  TimedOut: 'timedOut',
} as const
export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus]

export const WORKFLOW_STATUS_LABEL: Record<WorkflowStatus, string> = {
  [WorkflowStatus.Running]: 'Running',
  [WorkflowStatus.Completed]: 'Completed',
  [WorkflowStatus.Failed]: 'Failed',
  [WorkflowStatus.Canceled]: 'Canceled',
  [WorkflowStatus.Terminated]: 'Terminated',
  [WorkflowStatus.ContinuedAsNew]: 'Continued as new',
  [WorkflowStatus.TimedOut]: 'Timed out',
}

/** The wire's spelling of each status, which is also what the filter sends. */
export const WORKFLOW_STATUS_WIRE: Record<WorkflowStatus, string> = {
  [WorkflowStatus.Running]: 'Running',
  [WorkflowStatus.Completed]: 'Completed',
  [WorkflowStatus.Failed]: 'Failed',
  [WorkflowStatus.Canceled]: 'Canceled',
  [WorkflowStatus.Terminated]: 'Terminated',
  [WorkflowStatus.ContinuedAsNew]: 'ContinuedAsNew',
  [WorkflowStatus.TimedOut]: 'TimedOut',
}

export interface WorkflowRun {
  /** The run id: unique per attempt, where `workflowId` is shared by retries. */
  id: string
  workflowId: string
  /** A readable name for the workflow type. */
  name: string
  /** `null` when the API reports a state this build does not know. */
  status: WorkflowStatus | null
  startTime: Date | null
  closeTime: Date | null
  durationMs: number | null
}

export interface WorkflowQuery {
  page: number
  pageSize: number
  /** Matched against the workflow id, server-side. */
  search: string
  statuses: WorkflowStatus[]
  sortDirection: 'asc' | 'desc'
}

export const DEFAULT_WORKFLOW_QUERY: WorkflowQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortDirection: 'desc',
}

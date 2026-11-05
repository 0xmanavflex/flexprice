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

/** The latest run that synced one invoice or customer to one provider. */
export interface EntitySyncRun {
  /** The integration catalogue id (`stripe`, `zoho`), which also picks the logo. */
  providerId: string
  provider: string
  status: WorkflowStatus | null
  startTime: Date | null
  closeTime: Date | null
  workflowId: string
  runId: string
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

/**
 * Where one activity inside a run stands. Temporal's activity states as the
 * history reports them; `null` on the record is a state this build does not know.
 */
export const WorkflowActivityStatus = {
  Scheduled: 'scheduled',
  Started: 'started',
  Completed: 'completed',
  Failed: 'failed',
  TimedOut: 'timedOut',
  Canceled: 'canceled',
} as const
export type WorkflowActivityStatus =
  (typeof WorkflowActivityStatus)[keyof typeof WorkflowActivityStatus]

export const WORKFLOW_ACTIVITY_STATUS_LABEL: Record<WorkflowActivityStatus, string> = {
  [WorkflowActivityStatus.Scheduled]: 'Scheduled',
  [WorkflowActivityStatus.Started]: 'Started',
  [WorkflowActivityStatus.Completed]: 'Completed',
  [WorkflowActivityStatus.Failed]: 'Failed',
  [WorkflowActivityStatus.TimedOut]: 'Timed out',
  [WorkflowActivityStatus.Canceled]: 'Canceled',
}

/** One step a run executed (e.g. `RecalculateInvoiceActivity`), with its retries. */
export interface WorkflowActivity {
  id: string
  /** The activity type as the worker registered it: what an engineer greps for. */
  name: string
  status: WorkflowActivityStatus | null
  /** How many times the activity was tried; 1 is a first-time success or failure. */
  attempts: number
  startTime: Date | null
  closeTime: Date | null
  durationMs: number | null
  /** The last failure's message, when the activity failed or timed out. */
  failureMessage: string | null
  /** When that last failure was recorded: the activity's close time. */
  failureTime: Date | null
}

/**
 * One run in full, as its detail sheet reads it (`GET /workflows/:workflow_id/:run_id`):
 * the summary the list shows, plus every activity and why the run failed.
 */
export interface WorkflowRunDetail extends WorkflowRun {
  /** The raw workflow type, e.g. `ProcessInvoiceWorkflow`. */
  type: string
  taskQueue: string
  activities: WorkflowActivity[]
  /**
   * Why the run failed, in the words of the last activity that failed. The API
   * has no run-level error, so this is `null` for a run whose activities all
   * succeeded, even if the run itself did not.
   */
  failureMessage: string | null
}

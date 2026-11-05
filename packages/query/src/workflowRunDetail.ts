import { useQuery } from '@tanstack/react-query'
import { ApiError, ErrorKind, fetchWorkflowDetails } from '@fp/api'
import { type WorkflowActivity, WorkflowActivityStatus, type WorkflowRunDetail } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'
import { toWorkflowRun } from './workflowRuns'

/**
 * One run in full, through `GET /workflows/{workflow_id}/{run_id}`: what the
 * Workflows list opens to answer "why did this fail?".
 *
 * Read only while the sheet is open on a run: the backend walks the run's
 * Temporal history to build it, which is far heavier than a row of the list.
 */

/** The details body as the API sends it: snake_case, times as ISO strings. */
export interface WorkflowActivityWire {
  activity_id?: string | null
  activity_type?: string | null
  status?: string | null
  start_time?: string | null
  close_time?: string | null
  duration_ms?: number | null
  retry_attempt?: number | null
  error?: { message?: string | null; type?: string | null } | null
}

export interface WorkflowRunDetailWire {
  workflow_id?: string | null
  run_id?: string | null
  workflow_type?: string | null
  status?: string | null
  start_time?: string | null
  close_time?: string | null
  duration_ms?: number | null
  task_queue?: string | null
  activities?: WorkflowActivityWire[] | null
}

const ACTIVITY_STATUS_FROM_WIRE: Record<string, WorkflowActivityStatus> = {
  SCHEDULED: WorkflowActivityStatus.Scheduled,
  STARTED: WorkflowActivityStatus.Started,
  COMPLETED: WorkflowActivityStatus.Completed,
  FAILED: WorkflowActivityStatus.Failed,
  TIMED_OUT: WorkflowActivityStatus.TimedOut,
  CANCELED: WorkflowActivityStatus.Canceled,
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const toNumber = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export function toWorkflowActivity(wire: WorkflowActivityWire): WorkflowActivity {
  const status = ACTIVITY_STATUS_FROM_WIRE[(wire.status ?? '').toUpperCase()] ?? null
  const closeTime = toDate(wire.close_time)
  const failureMessage = wire.error?.message?.trim() || null
  return {
    id: wire.activity_id ?? '',
    name: wire.activity_type ?? '',
    status,
    // Temporal counts attempts from 1; an activity only scheduled reports 0.
    attempts: Math.max(toNumber(wire.retry_attempt) ?? 0, 0),
    startTime: toDate(wire.start_time),
    closeTime,
    durationMs: toNumber(wire.duration_ms),
    failureMessage,
    failureTime: failureMessage ? closeTime : null,
  }
}

export function toWorkflowRunDetail(wire: WorkflowRunDetailWire): WorkflowRunDetail {
  const startTime = toDate(wire.start_time)
  const closeTime = toDate(wire.close_time)
  const durationMs = toNumber(wire.duration_ms)
  const run = toWorkflowRun({
    runId: wire.run_id ?? undefined,
    workflowId: wire.workflow_id ?? undefined,
    workflowType: wire.workflow_type ?? undefined,
    status: wire.status ?? undefined,
    ...(startTime ? { startTime } : {}),
    ...(closeTime ? { closeTime } : {}),
    ...(durationMs === null ? {} : { durationMs }),
  })
  const activities = (wire.activities ?? []).map(toWorkflowActivity)
  // The API has no run-level error: the run failed because its last failing
  // activity did, so that activity's message is the run's answer.
  const lastFailure = [...activities].reverse().find((activity) => activity.failureMessage)
  return {
    ...run,
    type: wire.workflow_type ?? '',
    taskQueue: wire.task_queue ?? '',
    activities,
    failureMessage: lastFailure?.failureMessage ?? null,
  }
}

/** `null` reads nothing (the sheet is closed). */
export function useWorkflowRunDetail(handle: { workflowId: string; runId: string } | null) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const workflowId = handle?.workflowId ?? ''
  const runId = handle?.runId ?? ''

  return useQuery({
    queryKey: queryKeys.workflowRuns.detail(workflowId, runId),
    queryFn: async (): Promise<WorkflowRunDetail> => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to read this workflow.')
      const body = await fetchWorkflowDetails(
        serverURL,
        token,
        environmentId ?? '',
        workflowId,
        runId,
      )
      return toWorkflowRunDetail((body ?? {}) as WorkflowRunDetailWire)
    },
    enabled: workflowId !== '' && runId !== '',
    // The sheet reports a failed read itself; it must not replace the list.
    throwOnError: false,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

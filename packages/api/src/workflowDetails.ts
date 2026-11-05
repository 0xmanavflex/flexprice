import { request } from './settings'

/**
 * `GET /workflows/{workflow_id}/{run_id}`: one run with every activity it
 * executed, read from the Temporal history server-side.
 *
 * Absent from the SDK (it only has `queryWorkflow`, the list search), so this
 * speaks `fetch` directly like its neighbours. The body is snake_case:
 * `workflow_type`, `status`, `start_time`, `close_time`, `duration_ms`,
 * `task_queue`, and `activities[]` of `{ activity_id, activity_type, status,
 * start_time, close_time, duration_ms, retry_attempt, error?: { message, type } }`.
 */
export async function fetchWorkflowDetails(
  serverURL: string,
  token: string,
  environmentId: string,
  workflowId: string,
  runId: string,
): Promise<unknown> {
  return request(
    serverURL,
    `/workflows/${encodeURIComponent(workflowId)}/${encodeURIComponent(runId)}`,
    { method: 'GET', token, environmentId },
  )
}

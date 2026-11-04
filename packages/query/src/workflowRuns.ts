import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type WorkflowQuery,
  type WorkflowRun,
  WORKFLOW_STATUS_WIRE,
  WorkflowStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Workflow runs, through `POST /workflows/search` (`client.workflows.queryWorkflow`).
 * The workflow id and the status are server-side filters, and so is the order.
 */

export interface WorkflowRunWire {
  runId?: string | undefined
  workflowId?: string | undefined
  workflowType?: string | undefined
  status?: string | undefined
  startTime?: Date | undefined
  closeTime?: Date | undefined
  durationMs?: number | undefined
}

/** Type names V1 shows as words. An unknown type is split from its CamelCase instead. */
const TYPE_NAMES: Record<string, string> = {
  PriceSyncV2Workflow: 'Price sync',
  QuickBooksPriceSyncWorkflow: 'QuickBooks price sync',
  TaskProcessingWorkflow: 'Task processing',
  SubscriptionChangeWorkflow: 'Subscription change',
  SubscriptionCreationWorkflow: 'Subscription creation',
  StripeIntegrationWorkflow: 'Stripe integration',
  ExecuteExportWorkflow: 'Data export',
  HubSpotDealSyncWorkflow: 'HubSpot deal sync',
  HubSpotInvoiceSyncWorkflow: 'HubSpot invoice sync',
  HubSpotQuoteSyncWorkflow: 'HubSpot quote sync',
  NomodInvoiceSyncWorkflow: 'Nomod invoice sync',
  MoyasarInvoiceSyncWorkflow: 'Moyasar invoice sync',
  CustomerOnboardingWorkflow: 'Customer onboarding',
  PrepareProcessedEventsWorkflow: 'Prepare processed events',
  ScheduleSubscriptionBillingWorkflow: 'Schedule subscription billing',
  ProcessSubscriptionBillingWorkflow: 'Process subscription billing',
  ProcessInvoiceWorkflow: 'Process invoice',
  ReprocessEventsWorkflow: 'Reprocess events',
  ReprocessRawEventsWorkflow: 'Reprocess raw events',
  ReprocessEventsForPlanWorkflow: 'Reprocess events for plan',
}

function nameOf(type: string | undefined): string {
  if (!type) return ''
  const known = TYPE_NAMES[type]
  if (known) return known
  const words = type
    .replace(/Workflow$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : type
}

const STATUS_FROM_WIRE = new Map<string, WorkflowStatus>(
  (Object.entries(WORKFLOW_STATUS_WIRE) as [WorkflowStatus, string][]).map(([status, wire]) => [
    wire,
    status,
  ]),
)

export function toWorkflowRun(wire: WorkflowRunWire): WorkflowRun {
  return {
    id: wire.runId ?? '',
    workflowId: wire.workflowId ?? '',
    name: nameOf(wire.workflowType),
    status: STATUS_FROM_WIRE.get(wire.status ?? '') ?? null,
    startTime: wire.startTime ?? null,
    closeTime: wire.closeTime ?? null,
    durationMs: typeof wire.durationMs === 'number' ? wire.durationMs : null,
  }
}

export function toWorkflowFilter(query: WorkflowQuery): Record<string, unknown> {
  const [only, ...rest] = query.statuses
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    order: query.sortDirection,
    sort: [{ field: 'start_time', direction: query.sortDirection }],
    ...(query.search ? { workflowId: query.search } : {}),
    ...(only && rest.length === 0 ? { workflowStatus: WORKFLOW_STATUS_WIRE[only] } : {}),
    // `workflowStatus` takes one value; several travel as an `in` condition on
    // the same column, so choosing two statuses narrows rather than widens.
    ...(rest.length > 0
      ? {
          filters: [
            {
              field: 'workflow_status',
              operator: 'in',
              dataType: 'array',
              value: { array: query.statuses.map((status) => WORKFLOW_STATUS_WIRE[status]) },
            },
          ],
        }
      : {}),
  }
}

export interface WorkflowRunPage {
  runs: WorkflowRun[]
  total: number
}

export async function fetchWorkflowRuns(
  client: Flexprice,
  query: WorkflowQuery,
): Promise<WorkflowRunPage> {
  const response = await call(() =>
    client.workflows.queryWorkflow(toWorkflowFilter(query) as never),
  )
  const runs = (response.items ?? []).map((item) => toWorkflowRun(item as WorkflowRunWire))
  return { runs, total: response.pagination?.total ?? runs.length }
}

export function useWorkflowRuns(query: WorkflowQuery) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.workflowRuns.list({ ...query, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchWorkflowRuns(client, query),
    placeholderData: (previous) => previous,
  })
}

/** What a call that starts a workflow answers: the workflow and the run it started. */
export interface WorkflowHandle {
  workflowId: string
  runId: string
}

/** The statuses a run does not leave: polling stops on any of them. */
export const FINISHED_WORKFLOW_STATUSES: ReadonlySet<WorkflowStatus> = new Set([
  WorkflowStatus.Completed,
  WorkflowStatus.Failed,
  WorkflowStatus.Canceled,
  WorkflowStatus.Terminated,
  WorkflowStatus.TimedOut,
])

export const isFinishedWorkflow = (run: WorkflowRun | null | undefined): boolean =>
  Boolean(run?.status && FINISHED_WORKFLOW_STATUSES.has(run.status))

/** How often a watched run is read, and how long it is watched before giving up. */
export const WORKFLOW_POLL_MS = 2_000
export const WORKFLOW_WATCH_MAX_MS = 5 * 60_000

/**
 * One run, found through the same search the Workflows page uses, filtered to
 * its workflow id. `null` until the run shows up in the search.
 */
export async function fetchWorkflowRun(
  client: Flexprice,
  handle: WorkflowHandle,
): Promise<WorkflowRun | null> {
  const page = await fetchWorkflowRuns(client, {
    page: 1,
    pageSize: 10,
    search: handle.workflowId,
    statuses: [],
    sortDirection: 'desc',
  })
  return (
    page.runs.find((run) => run.id === handle.runId) ??
    (handle.runId ? null : (page.runs[0] ?? null))
  )
}

/**
 * Watches one run until it finishes: read every {@link WORKFLOW_POLL_MS}
 * until its status is final, the read fails, or {@link WORKFLOW_WATCH_MAX_MS}
 * has passed since `since`. `null` watches nothing. Unmounting stops it.
 */
export function useWorkflowRun(handle: (WorkflowHandle & { since: number }) | null) {
  const client = useFlexprice()

  return useQuery({
    queryKey: [...queryKeys.workflowRuns.all(), 'run', handle?.workflowId, handle?.runId] as const,
    queryFn: () => fetchWorkflowRun(client, handle as WorkflowHandle),
    enabled: handle !== null,
    retry: false,
    // A failed read is the watcher's to report ("Could not check the sync"),
    // not the route's: it must not replace the page the sync started from.
    throwOnError: false,
    // A finished sync is read once; there is nothing to cache across watches.
    gcTime: 0,
    refetchInterval: (query) => {
      if (!handle || query.state.status === 'error') return false
      if (isFinishedWorkflow(query.state.data)) return false
      return Date.now() - handle.since < WORKFLOW_WATCH_MAX_MS ? WORKFLOW_POLL_MS : false
    },
  })
}

import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type WorkflowQuery,
  type WorkflowRun,
  WORKFLOW_STATUS_WIRE,
  type WorkflowStatus,
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

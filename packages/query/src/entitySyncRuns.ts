import { useQuery } from '@tanstack/react-query'
import { call, type Flexprice } from '@fp/api'
import { INTEGRATION_CATALOG, type EntitySyncRun } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import { isFinishedWorkflow, toWorkflowRun, type WorkflowRunWire } from './workflowRuns'

/**
 * What became of a push. `POST /integrations/sync` only starts one workflow per
 * provider (`StripeInvoiceSyncWorkflow`, `ZohoBooksCustomerSyncWorkflow`) and
 * answers before any finishes. Each run is recorded against the entity it
 * carries, so `POST /workflows/search` with `entity` and `entity_id` finds them.
 */

export type SyncedEntityType = 'invoice' | 'customer'

const SYNC_TYPE = /^(.+?)(Invoice|Customer)SyncWorkflow$/

/** `ZohoBooks` → the catalogue's Zoho Books entry, matched on its provider type without separators. */
function providerOf(prefix: string): { id: string; name: string } {
  const key = prefix.toLowerCase()
  const spec = INTEGRATION_CATALOG.find(
    (entry) => entry.providerType.replace(/[^a-z0-9]/gi, '').toLowerCase() === key,
  )
  return spec ? { id: spec.id, name: spec.name } : { id: key, name: prefix }
}

/** The latest sync run per provider for this entity type, newest first; other workflows are left out. */
export function toEntitySyncRuns(
  type: SyncedEntityType,
  wires: WorkflowRunWire[],
): EntitySyncRun[] {
  const kind = type === 'invoice' ? 'Invoice' : 'Customer'
  const latest = new Map<string, EntitySyncRun>()
  for (const wire of wires) {
    const match = SYNC_TYPE.exec(wire.workflowType ?? '')
    if (!match || match[2] !== kind) continue
    const provider = providerOf(match[1]!)
    const run = toWorkflowRun(wire)
    const current = latest.get(provider.id)
    if (current && (current.startTime?.getTime() ?? 0) >= (run.startTime?.getTime() ?? 0)) continue
    latest.set(provider.id, {
      providerId: provider.id,
      provider: provider.name,
      status: run.status,
      startTime: run.startTime,
      closeTime: run.closeTime,
      workflowId: run.workflowId,
      runId: run.id,
    })
  }
  return [...latest.values()].sort(
    (a, b) => (b.startTime?.getTime() ?? 0) - (a.startTime?.getTime() ?? 0),
  )
}

export async function fetchEntitySyncRuns(
  client: Flexprice,
  type: SyncedEntityType,
  id: string,
  signal?: AbortSignal,
): Promise<EntitySyncRun[]> {
  const response = await call(
    (options) =>
      client.workflows.queryWorkflow(
        {
          entity: type,
          entityId: id,
          limit: 50,
          order: 'desc',
          sort: [{ field: 'start_time', direction: 'desc' }],
        },
        options,
      ),
    signal,
  )
  return toEntitySyncRuns(type, (response.items ?? []) as WorkflowRunWire[])
}

/** How long after a push its runs are watched, and how long to wait for the first to appear. */
export const SYNC_WATCH_MAX_MS = 5 * 60_000
export const SYNC_FIRST_RUN_MS = 60_000
const SYNC_POLL_MS = 2_000
/** A run's start is stamped by the worker, so allow for clocks a little apart. */
const CLOCK_SLACK_MS = 10_000

/** The runs a push started at `since` (ms): the ones that began after it. */
export function runsSince(runs: readonly EntitySyncRun[], since: number): EntitySyncRun[] {
  return runs.filter((run) => (run.startTime?.getTime() ?? 0) >= since - CLOCK_SLACK_MS)
}

/** A push being followed: when it was sent and the providers it went to (catalogue names). */
export interface SyncWatch {
  since: number
  expected: readonly string[]
}

/**
 * Whether a push is over. Runs appear in the search one by one, so the
 * visible runs are not the whole push: it is over when every provider it went
 * to has a finished run. A provider whose run has not appeared a minute in
 * stops being waited for (a customer push skips a provider it is already
 * linked to). Past {@link SYNC_WATCH_MAX_MS} it is over regardless.
 */
export function syncWatchDone(
  runs: readonly EntitySyncRun[] | undefined,
  watch: SyncWatch,
  now = Date.now(),
): boolean {
  const elapsed = now - watch.since
  if (elapsed > SYNC_WATCH_MAX_MS) return true
  const started = runsSince(runs ?? [], watch.since)
  if (!started.every((run) => isFinishedWorkflow(run))) return false
  const missing = watch.expected.filter(
    (provider) => !started.some((run) => run.provider === provider),
  )
  if (started.length > 0 && missing.length === 0) return true
  return elapsed > SYNC_FIRST_RUN_MS
}

/**
 * The latest sync per provider for one invoice or customer. With a `watch`
 * (a push just sent) it is read every two seconds until that push is over:
 * see {@link syncWatchDone}.
 */
export function useEntitySyncRuns(type: SyncedEntityType, id: string, watch: SyncWatch | null) {
  const client = useFlexprice()
  return useQuery({
    queryKey: queryKeys.workflowRuns.forEntity(type, id),
    queryFn: ({ signal }) => fetchEntitySyncRuns(client, type, id, signal),
    enabled: id.length > 0,
    retry: false,
    throwOnError: false,
    refetchInterval: (query) =>
      watch === null || query.state.status === 'error'
        ? false
        : syncWatchDone(query.state.data, watch)
          ? false
          : SYNC_POLL_MS,
  })
}

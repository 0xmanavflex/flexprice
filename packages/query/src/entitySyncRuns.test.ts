import { describe, expect, it } from 'vitest'
import { WorkflowStatus } from '@fp/domain'
import {
  syncWatchDone,
  toEntitySyncRuns,
  SYNC_FIRST_RUN_MS,
  SYNC_WATCH_MAX_MS,
} from './entitySyncRuns'

const at = (iso: string) => new Date(iso)

describe('toEntitySyncRuns', () => {
  it('keeps the latest sync run per provider, names it from the catalogue and leaves other workflows out', () => {
    const runs = toEntitySyncRuns('invoice', [
      {
        runId: 'r1',
        workflowType: 'StripeInvoiceSyncWorkflow',
        status: 'Failed',
        startTime: at('2026-11-06T10:00:00Z'),
      },
      {
        runId: 'r2',
        workflowType: 'StripeInvoiceSyncWorkflow',
        status: 'Completed',
        startTime: at('2026-11-06T11:00:00Z'),
      },
      {
        runId: 'r3',
        workflowType: 'ZohoBooksInvoiceSyncWorkflow',
        status: 'Running',
        startTime: at('2026-11-06T11:30:00Z'),
      },
      {
        runId: 'r4',
        workflowType: 'StripeCustomerSyncWorkflow',
        status: 'Completed',
        startTime: at('2026-11-06T12:00:00Z'),
      },
      {
        runId: 'r5',
        workflowType: 'ProcessInvoiceWorkflow',
        status: 'Completed',
        startTime: at('2026-11-06T12:00:00Z'),
      },
    ])
    expect(runs.map((run) => [run.provider, run.runId, run.status])).toEqual([
      ['Zoho', 'r3', WorkflowStatus.Running],
      ['Stripe', 'r2', WorkflowStatus.Completed],
    ])
  })
})

describe('syncWatchDone', () => {
  const since = Date.parse('2026-11-06T12:00:00Z')
  const run = (provider: string, status: WorkflowStatus, start = since + 1_000) => ({
    providerId: provider.toLowerCase(),
    provider,
    status,
    startTime: new Date(start),
    closeTime: null,
    workflowId: 'w',
    runId: `r_${provider}`,
  })
  const watch = { since, expected: ['Stripe', 'HubSpot'] }

  it('waits while a run the push started is still going', () => {
    expect(syncWatchDone([run('Stripe', WorkflowStatus.Running)], watch, since + 5_000)).toBe(false)
  })

  it('keeps waiting for a provider whose run has not appeared yet, though the others finished', () => {
    expect(syncWatchDone([run('Stripe', WorkflowStatus.Completed)], watch, since + 5_000)).toBe(
      false,
    )
    expect(
      syncWatchDone(
        [run('Stripe', WorkflowStatus.Completed), run('HubSpot', WorkflowStatus.Failed)],
        watch,
        since + 5_000,
      ),
    ).toBe(true)
  })

  it('stops waiting for a provider that never started once a minute has passed', () => {
    expect(
      syncWatchDone(
        [run('Stripe', WorkflowStatus.Completed)],
        watch,
        since + SYNC_FIRST_RUN_MS + 1,
      ),
    ).toBe(true)
    expect(syncWatchDone([], watch, since + SYNC_FIRST_RUN_MS + 1)).toBe(true)
  })

  it('ignores runs from before the push', () => {
    const old = run('Stripe', WorkflowStatus.Completed, since - 60 * 60_000)
    expect(syncWatchDone([old], { since, expected: ['Stripe'] }, since + 5_000)).toBe(false)
  })

  it('gives up on a run that goes on too long', () => {
    expect(
      syncWatchDone([run('Stripe', WorkflowStatus.Running)], watch, since + SYNC_WATCH_MAX_MS + 1),
    ).toBe(true)
  })
})

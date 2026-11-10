import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORKFLOW_QUERY, WorkflowStatus } from '@fp/domain'
import type { Flexprice } from '@fp/api'
import {
  fetchWorkflowRun,
  fetchWorkflowRuns,
  isFinishedWorkflow,
  toWorkflowFilter,
  toWorkflowRun,
} from './workflowRuns'

describe('toWorkflowRun', () => {
  it('maps a run and names its type', () => {
    const run = toWorkflowRun({
      runId: 'run_1',
      workflowId: 'wf_1',
      workflowType: 'PriceSyncV2Workflow',
      status: 'Completed',
      durationMs: 1500,
      startTime: new Date('2026-01-01T00:00:00Z'),
    })
    expect(run).toMatchObject({
      id: 'run_1',
      name: 'Price sync',
      status: WorkflowStatus.Completed,
      durationMs: 1500,
      closeTime: null,
    })
  })

  it('reads an unknown type as words and an unknown status as null', () => {
    const run = toWorkflowRun({ workflowType: 'NewShinyThingWorkflow', status: 'Paused' })
    expect(run.name).toBe('New shiny thing')
    expect(run.status).toBeNull()
  })
})

describe('toWorkflowFilter', () => {
  it('sends the workflow id and a single status', () => {
    expect(
      toWorkflowFilter({
        ...DEFAULT_WORKFLOW_QUERY,
        page: 2,
        search: 'wf_9',
        statuses: [WorkflowStatus.TimedOut],
      }),
    ).toMatchObject({
      limit: 25,
      offset: 25,
      workflowId: 'wf_9',
      workflowStatus: 'TimedOut',
      order: 'desc',
    })
  })

  it('sends several statuses as one in-condition', () => {
    const filter = toWorkflowFilter({
      ...DEFAULT_WORKFLOW_QUERY,
      statuses: [WorkflowStatus.Failed, WorkflowStatus.Running],
    })
    expect(filter).not.toHaveProperty('workflowStatus')
    expect(filter.filters).toEqual([
      {
        field: 'workflow_status',
        operator: 'in',
        dataType: 'array',
        value: { array: ['Failed', 'Running'] },
      },
    ])
  })

  it('sends no status condition when none is chosen', () => {
    const filter = toWorkflowFilter(DEFAULT_WORKFLOW_QUERY)
    expect(filter).not.toHaveProperty('workflowStatus')
    expect(filter).not.toHaveProperty('filters')
  })
})

describe('fetchWorkflowRuns', () => {
  it('returns runs and the server total', async () => {
    const queryWorkflow = vi.fn(async () => ({
      items: [{ runId: 'a', status: 'Running' }],
      pagination: { total: 9 },
    }))
    const client = { workflows: { queryWorkflow } } as unknown as Flexprice
    const page = await fetchWorkflowRuns(client, DEFAULT_WORKFLOW_QUERY)
    expect(page.total).toBe(9)
    expect(page.runs[0]?.status).toBe(WorkflowStatus.Running)
  })

  it("sends a scope as the SDK filter's entity, entityId and workflowType", async () => {
    const queryWorkflow = vi.fn(async (_filter: Record<string, unknown>) => ({ items: [] }))
    const client = { workflows: { queryWorkflow } } as unknown as Flexprice
    await fetchWorkflowRuns(client, DEFAULT_WORKFLOW_QUERY, {
      entity: 'plan',
      entityId: 'plan_1',
      workflowType: 'PriceSyncV2Workflow',
    })
    expect(queryWorkflow.mock.calls[0]?.[0]).toMatchObject({
      entity: 'plan',
      entityId: 'plan_1',
      workflowType: 'PriceSyncV2Workflow',
    })
  })
})

describe('fetchWorkflowRun', () => {
  it('searches by the workflow id and returns the started run', async () => {
    const queryWorkflow = vi.fn(async () => ({
      items: [
        { runId: 'run_new', workflowId: 'price-sync-plan_1', status: 'Running' },
        { runId: 'run_old', workflowId: 'price-sync-plan_1', status: 'Completed' },
      ],
    }))
    const client = { workflows: { queryWorkflow } } as unknown as Flexprice
    const run = await fetchWorkflowRun(client, {
      workflowId: 'price-sync-plan_1',
      runId: 'run_new',
    })
    expect(queryWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: 'price-sync-plan_1' }),
    )
    expect(run?.id).toBe('run_new')
    expect(run?.status).toBe(WorkflowStatus.Running)
  })

  it('is null while the run has not reached the search yet', async () => {
    const queryWorkflow = vi.fn(async () => ({
      items: [{ runId: 'run_old', status: 'Completed' }],
    }))
    const client = { workflows: { queryWorkflow } } as unknown as Flexprice
    expect(await fetchWorkflowRun(client, { workflowId: 'wf', runId: 'run_new' })).toBeNull()
  })
})

describe('isFinishedWorkflow', () => {
  it('stops on completed, failed, canceled, terminated and timed out', () => {
    const run = (status: WorkflowStatus | null) => toWorkflowRun({ status: status ?? '' })
    for (const status of [
      WorkflowStatus.Completed,
      WorkflowStatus.Failed,
      WorkflowStatus.Canceled,
      WorkflowStatus.Terminated,
      WorkflowStatus.TimedOut,
    ]) {
      expect(isFinishedWorkflow({ ...run(null), status })).toBe(true)
    }
    expect(isFinishedWorkflow({ ...run(null), status: WorkflowStatus.Running })).toBe(false)
    expect(isFinishedWorkflow(null)).toBe(false)
  })
})

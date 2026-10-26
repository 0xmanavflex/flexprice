import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORKFLOW_QUERY, WorkflowStatus } from '@fp/domain'
import type { Flexprice } from '@fp/api'
import { fetchWorkflowRuns, toWorkflowFilter, toWorkflowRun } from './workflowRuns'

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

  it('sends no status when several are chosen', () => {
    const filter = toWorkflowFilter({
      ...DEFAULT_WORKFLOW_QUERY,
      statuses: [WorkflowStatus.Failed, WorkflowStatus.Running],
    })
    expect(filter).not.toHaveProperty('workflowStatus')
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
})

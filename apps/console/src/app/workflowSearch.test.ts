import { describe, expect, it } from 'vitest'
import { DEFAULT_WORKFLOW_QUERY, WorkflowStatus } from '@fp/domain'
import { parseOpenWorkflowRun, parseWorkflowSearch } from './workflowSearch'

describe('parseWorkflowSearch', () => {
  it('returns the defaults for an empty URL', () => {
    expect(parseWorkflowSearch({})).toEqual(DEFAULT_WORKFLOW_QUERY)
  })

  it('reads both the short and the long spellings', () => {
    expect(parseWorkflowSearch({ q: 'wf', size: '50', status: 'failed', dir: 'asc' })).toEqual({
      page: 1,
      pageSize: 50,
      search: 'wf',
      statuses: [WorkflowStatus.Failed],
      sortDirection: 'asc',
    })
    expect(
      parseWorkflowSearch({ search: 'wf', pageSize: 10, statuses: ['running'] }),
    ).toMatchObject({
      search: 'wf',
      pageSize: 10,
      statuses: [WorkflowStatus.Running],
    })
  })

  it('drops unknown statuses and duplicates', () => {
    expect(parseWorkflowSearch({ status: 'failed,paused,failed,timedOut' }).statuses).toEqual([
      WorkflowStatus.Failed,
      WorkflowStatus.TimedOut,
    ])
  })

  it('falls back on junk numbers and caps the page size', () => {
    expect(parseWorkflowSearch({ page: '-3', size: '9999' })).toMatchObject({
      page: 1,
      pageSize: 100,
    })
    expect(parseWorkflowSearch({ page: 'x', dir: 'sideways' })).toMatchObject({
      page: 1,
      sortDirection: 'desc',
    })
  })
})

describe('parseOpenWorkflowRun', () => {
  it('reads a run only when both ids are present', () => {
    expect(parseOpenWorkflowRun({ workflow: 'wf_1', run: 'run_1' })).toEqual({
      workflowId: 'wf_1',
      runId: 'run_1',
    })
    expect(parseOpenWorkflowRun({ workflow: 'wf_1' })).toBeNull()
    expect(parseOpenWorkflowRun({})).toBeNull()
  })
})

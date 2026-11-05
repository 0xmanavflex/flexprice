import { describe, expect, it } from 'vitest'
import { WorkflowActivityStatus, WorkflowStatus } from '@fp/domain'
import { toWorkflowActivity, toWorkflowRunDetail } from './workflowRunDetail'

describe('toWorkflowRunDetail', () => {
  it('maps a failed run, its retried activity and the run-level failure', () => {
    const detail = toWorkflowRunDetail({
      workflow_id: 'wf_recalc',
      run_id: 'run_1',
      workflow_type: 'RecalculateInvoiceWorkflow',
      status: 'Failed',
      start_time: '2026-09-01T10:00:00Z',
      close_time: '2026-09-01T10:00:43Z',
      duration_ms: 43294,
      task_queue: 'billing',
      activities: [
        {
          activity_id: '5',
          activity_type: 'LoadInvoiceActivity',
          status: 'COMPLETED',
          start_time: '2026-09-01T10:00:00Z',
          close_time: '2026-09-01T10:00:01Z',
          duration_ms: 1000,
          retry_attempt: 1,
        },
        {
          activity_id: '11',
          activity_type: 'RecalculateInvoiceActivity',
          status: 'FAILED',
          start_time: '2026-09-01T10:00:30Z',
          close_time: '2026-09-01T10:00:43Z',
          duration_ms: 13000,
          retry_attempt: 3,
          error: { message: 'recalculation produced no invoice', type: 'ActivityError' },
        },
      ],
    })

    expect(detail).toMatchObject({
      id: 'run_1',
      workflowId: 'wf_recalc',
      name: 'Recalculate invoice',
      type: 'RecalculateInvoiceWorkflow',
      status: WorkflowStatus.Failed,
      durationMs: 43294,
      taskQueue: 'billing',
      failureMessage: 'recalculation produced no invoice',
    })
    expect(detail.startTime).toEqual(new Date('2026-09-01T10:00:00Z'))
    expect(detail.activities).toHaveLength(2)
    expect(detail.activities[1]).toMatchObject({
      name: 'RecalculateInvoiceActivity',
      status: WorkflowActivityStatus.Failed,
      attempts: 3,
      failureMessage: 'recalculation produced no invoice',
      failureTime: new Date('2026-09-01T10:00:43Z'),
    })
    expect(detail.activities[0]).toMatchObject({ failureMessage: null, failureTime: null })
  })

  it('has no failure for a completed run and tolerates a sparse body', () => {
    const detail = toWorkflowRunDetail({
      workflow_id: 'wf_1',
      run_id: 'run_1',
      status: 'Completed',
    })
    expect(detail).toMatchObject({
      status: WorkflowStatus.Completed,
      activities: [],
      failureMessage: null,
      startTime: null,
      closeTime: null,
      durationMs: null,
      taskQueue: '',
    })
  })
})

describe('toWorkflowActivity', () => {
  it('maps a timed-out activity and an unknown state', () => {
    expect(
      toWorkflowActivity({
        activity_type: 'SyncActivity',
        status: 'TIMED_OUT',
        close_time: '2026-09-01T10:00:00Z',
        error: { message: 'activity StartToClose timeout', type: 'TimeoutError' },
      }),
    ).toMatchObject({ status: WorkflowActivityStatus.TimedOut, attempts: 0 })
    expect(toWorkflowActivity({ status: 'PAUSED', start_time: 'not a date' })).toMatchObject({
      status: null,
      startTime: null,
      failureMessage: null,
    })
  })
})

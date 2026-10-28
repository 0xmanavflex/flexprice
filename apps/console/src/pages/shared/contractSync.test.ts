import { describe, expect, it } from 'vitest'
import { WorkflowStatus } from '@fp/domain'
import { syncOutcome } from './contractSync'

describe('syncOutcome', () => {
  it('reports a completed run as done', () => {
    expect(syncOutcome(WorkflowStatus.Completed)).toEqual({ ok: true, title: 'Sync finished' })
  })

  it('reports every other final status as a failure, naming it', () => {
    expect(syncOutcome(WorkflowStatus.Failed)).toEqual({ ok: false, title: 'Sync failed' })
    expect(syncOutcome(WorkflowStatus.TimedOut)).toEqual({ ok: false, title: 'Sync timed out' })
    expect(syncOutcome(WorkflowStatus.Canceled)).toEqual({ ok: false, title: 'Sync canceled' })
    expect(syncOutcome(WorkflowStatus.Terminated)).toEqual({ ok: false, title: 'Sync terminated' })
  })
})

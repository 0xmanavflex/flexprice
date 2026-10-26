import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STEP,
  furthestOf,
  parseStep,
  toStepSearch,
  toWorkflowSteps,
} from './subscriptionSteps'

describe('parseStep', () => {
  it('reads a known step', () => {
    expect(parseStep('phases')).toBe('phases')
  })

  // A mistyped URL should start the flow over, not break it.
  it.each([undefined, null, '', 'nonsense', '3', 'PHASES'])(
    'falls back to the first step for %p',
    (raw) => {
      expect(parseStep(raw)).toBe(DEFAULT_STEP)
    },
  )
})

describe('toStepSearch', () => {
  it('leaves the first step out, keeping /subscriptions/new canonical', () => {
    expect(toStepSearch(DEFAULT_STEP)).toEqual({})
  })

  it('names any other step', () => {
    expect(toStepSearch('billing')).toEqual({ step: 'billing' })
  })

  it('round-trips', () => {
    for (const step of ['plan', 'phases', 'commitments', 'billing', 'review'] as const) {
      expect(parseStep(toStepSearch(step)['step'])).toBe(step)
    }
  })

  /*
   * `customer` was the first step until it was merged into `plan`. A link
   * already shared, or a back button into history, still carries it: landing
   * those on the merged step is the whole point of keeping the id around.
   */
  it('sends the retired customer step to the step that absorbed it', () => {
    expect(parseStep('customer')).toBe('plan')
  })

  it('sends the retired benefits step to commitments & benefits', () => {
    expect(parseStep('benefits')).toBe('commitments')
  })

  it('still falls back for a step that never existed', () => {
    expect(parseStep('nonsense')).toBe('plan')
    expect(parseStep(undefined)).toBe('plan')
  })
})

describe('toWorkflowSteps', () => {
  it('marks exactly one step current', () => {
    const steps = toWorkflowSteps('phases')
    expect(steps.filter((s) => s.status === 'current')).toHaveLength(1)
    expect(steps.find((s) => s.status === 'current')?.id).toBe('phases')
  })

  // You cannot skip ahead: the next step stays locked until this one is done.
  it('locks everything past where the user has actually been', () => {
    const steps = toWorkflowSteps('plan')
    expect(steps.map((s) => s.status)).toEqual(['current', 'locked', 'locked', 'locked', 'locked'])
  })

  // Back-navigation is the reason the flow is a route at all.
  it('leaves visited steps revisitable when the user goes back', () => {
    const steps = toWorkflowSteps('plan', 'phases')
    expect(steps.find((s) => s.id === 'plan')?.status).toBe('current')
    expect(steps.find((s) => s.id === 'phases')?.status).toBe('upcoming')
    expect(steps.find((s) => s.id === 'review')?.status).toBe('locked')
  })

  it('never reports progress behind the current step', () => {
    // Deep-linking straight to a later step must not lock the step you are on.
    const steps = toWorkflowSteps('review', 'plan')
    expect(steps.find((s) => s.id === 'review')?.status).toBe('current')
    expect(steps.every((s) => s.status !== 'locked')).toBe(true)
  })
})

describe('furthestOf', () => {
  it('keeps the later step', () => {
    expect(furthestOf('plan', 'phases')).toBe('phases')
    expect(furthestOf('phases', 'plan')).toBe('phases')
  })

  // Going back must not re-lock what was already reached.
  it('is stable when both are the same', () => {
    expect(furthestOf('phases', 'phases')).toBe('phases')
  })
})

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
    expect(parseStep('benefits')).toBe('benefits')
  })

  // A mistyped URL should start the flow over, not break it.
  it.each([undefined, null, '', 'nonsense', '3', 'BENEFITS'])(
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
    expect(toStepSearch('benefits')).toEqual({ step: 'benefits' })
  })

  it('round-trips', () => {
    for (const step of ['customer', 'benefits', 'review'] as const) {
      expect(parseStep(toStepSearch(step)['step'])).toBe(step)
    }
  })
})

describe('toWorkflowSteps', () => {
  it('marks exactly one step current', () => {
    const steps = toWorkflowSteps('benefits')
    expect(steps.filter((s) => s.status === 'current')).toHaveLength(1)
    expect(steps.find((s) => s.status === 'current')?.id).toBe('benefits')
  })

  // You cannot skip ahead: the next step stays locked until this one is done.
  it('locks everything past where the user has actually been', () => {
    const steps = toWorkflowSteps('customer')
    expect(steps.map((s) => s.status)).toEqual(['current', 'locked', 'locked', 'locked'])
  })

  // Back-navigation is the reason the flow is a route at all.
  it('leaves visited steps revisitable when the user goes back', () => {
    const steps = toWorkflowSteps('customer', 'benefits')
    expect(steps.find((s) => s.id === 'plan')?.status).toBe('complete')
    expect(steps.find((s) => s.id === 'benefits')?.status).toBe('upcoming')
    expect(steps.find((s) => s.id === 'review')?.status).toBe('locked')
  })

  it('never reports progress behind the current step', () => {
    // Deep-linking straight to a later step must not lock the step you are on.
    const steps = toWorkflowSteps('review', 'customer')
    expect(steps.find((s) => s.id === 'review')?.status).toBe('current')
    expect(steps.every((s) => s.status !== 'locked')).toBe(true)
  })
})

describe('furthestOf', () => {
  it('keeps the later step', () => {
    expect(furthestOf('customer', 'benefits')).toBe('benefits')
    expect(furthestOf('benefits', 'customer')).toBe('benefits')
  })

  // Going back must not re-lock what was already reached.
  it('is stable when both are the same', () => {
    expect(furthestOf('benefits', 'benefits')).toBe('benefits')
  })
})

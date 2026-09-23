import { describe, expect, it } from 'vitest'
import { DEFAULT_STEP, furthestOf, parseStep, toStepSearch, toWorkflowSteps } from './subscriptionSteps'

describe('parseStep', () => {
  it('reads a known step', () => {
    expect(parseStep('prices')).toBe('prices')
  })

  // A mistyped URL should start the flow over, not break it.
  it.each([undefined, null, '', 'nonsense', '3', 'PRICES'])(
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
    expect(toStepSearch('prices')).toEqual({ step: 'prices' })
  })

  it('round-trips', () => {
    for (const step of ['customer', 'prices', 'review'] as const) {
      expect(parseStep(toStepSearch(step)['step'])).toBe(step)
    }
  })
})

describe('toWorkflowSteps', () => {
  it('marks exactly one step current', () => {
    const steps = toWorkflowSteps('prices')
    expect(steps.filter((s) => s.status === 'current')).toHaveLength(1)
    expect(steps.find((s) => s.status === 'current')?.id).toBe('prices')
  })

  // You cannot skip ahead: the next step stays locked until this one is done.
  it('locks everything past where the user has actually been', () => {
    const steps = toWorkflowSteps('customer')
    expect(steps.map((s) => s.status)).toEqual([
      'current',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ])
  })

  // Back-navigation is the reason the flow is a route at all.
  it('leaves visited steps revisitable when the user goes back', () => {
    const steps = toWorkflowSteps('customer', 'prices')
    expect(steps.find((s) => s.id === 'plan')?.status).toBe('complete')
    expect(steps.find((s) => s.id === 'prices')?.status).toBe('upcoming')
    expect(steps.find((s) => s.id === 'credits')?.status).toBe('locked')
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
    expect(furthestOf('customer', 'prices')).toBe('prices')
    expect(furthestOf('prices', 'customer')).toBe('prices')
  })

  // Going back must not re-lock what was already reached.
  it('is stable when both are the same', () => {
    expect(furthestOf('prices', 'prices')).toBe('prices')
  })
})

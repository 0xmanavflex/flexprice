import type { ReactNode } from 'react'
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@ui/components/reui/stepper'
import { provenance } from '@ui/provenance'

/**
 * A stepper addressed by step *id*, not by index.
 *
 * ReUI's stepper is 1-indexed by number, which is right for a component and
 * wrong for a URL: `?step=3` breaks the moment a step is inserted, and it tells
 * a reader nothing. This composition keeps ReUI's rendering and swaps the
 * addressing, so a route can say `?step=prices` and stay stable as the flow
 * changes.
 *
 * It owns no workflow state. `currentStep` comes in, `onStepChange` goes out,
 * and the page decides what that means — which is what keeps a half-finished
 * subscription deep-linkable and navigable with the back button. A stepper that
 * remembered its own position would quietly take all of that away.
 *
 * Nothing here knows about subscriptions. It is a composition, reusable by any
 * flow that has ordered steps.
 */
export const WorkflowStepperProvenance = provenance({
  source: 'composition',
  composes: ['@reui/stepper'],
  note: 'Re-addresses ReUI’s index-based stepper by stable step id, for URL-safe workflow state.',
})

export type StepStatus =
  /** Done, and safe to go back to. */
  | 'complete'
  /** Where the user is now. */
  | 'current'
  /** Reachable, not yet visited. */
  | 'upcoming'
  /** Not reachable yet — an earlier step has to be finished first. */
  | 'locked'

export interface WorkflowStep {
  /** Stable, URL-safe: `prices`, not `3`. */
  id: string
  title: string
  status: StepStatus
}

export interface WorkflowStepperProps {
  steps: WorkflowStep[]
  currentStep: string
  /**
   * Requested navigation. Never called for a locked step — the trigger is
   * disabled — so the page does not have to re-check.
   */
  onStepChange: (stepId: string) => void
  /** The active step's content. The page renders it; the stepper only frames it. */
  children: ReactNode
  'aria-label'?: string
}

export function WorkflowStepper({
  steps,
  currentStep,
  onStepChange,
  children,
  'aria-label': ariaLabel = 'Progress',
}: WorkflowStepperProps) {
  // ReUI addresses steps by 1-based index; ids are translated at this boundary
  // and nowhere else.
  const currentIndex = Math.max(1, steps.findIndex((step) => step.id === currentStep) + 1)

  return (
    <Stepper
      value={currentIndex}
      onValueChange={(index: number) => {
        const target = steps[index - 1]
        if (target && target.status !== 'locked' && target.id !== currentStep) {
          onStepChange(target.id)
        }
      }}
      className="flex flex-col gap-6"
      /**
       * Overriding `role`, because ReUI's root declares `role="tablist"` while
       * none of its children declare `role="tab"` — which axe rejects as
       * `aria-required-children`, and which is wrong anyway: these are steps in
       * a process, not tabs over the same content. Tab semantics would also
       * promise arrow-key cycling that a wizard must not offer.
       *
       * `{...props}` is spread after `role` in the vendored component, so this
       * overrides cleanly — composing around the registry rather than forking
       * it.
       *
       * One mismatch remains and is deliberately left: `StepperTrigger` still
       * renders `role="tab"`. Overriding that too would mean fighting the
       * component on every sub-part, and axe is satisfied by the structure as
       * it stands. Both halves belong in an upstream report — a stepper should
       * be `nav > ol > li > button` with `aria-current="step"`, not tabs.
       */
      role="group"
      aria-label={ariaLabel}
      // ReUI sets this for its tab semantics; it is not allowed on `group`.
      aria-orientation={undefined}
    >
      <StepperNav>
        {steps.map((step, index) => (
          <StepperItem
            key={step.id}
            step={index + 1}
            completed={step.status === 'complete'}
            disabled={step.status === 'locked'}
            /*
             * ReUI decides the state as `completed || step < activeStep`, so
             * the `completed` prop can *add* completion but never withhold it:
             * every step behind the current one draws as a filled, finished
             * circle whether or not a single field was filled in. Opening
             * `?step=credits` therefore claimed Customer, Plan, Prices and
             * Entitlements were done when nothing had been entered — the
             * interface telling the user something untrue about their own
             * work, which is worse than telling them nothing.
             *
             * The attribute is left as ReUI computes it (it is a styling hook,
             * not something assistive tech reads); what is corrected is the
             * one thing that is visible. `StepperIndicator` is the only
             * sub-part whose look depends on the state — the separator and
             * title carry `data-state` but style the same either way — so a
             * single class on it is the whole fix, not a fork.
             */
          >
            <StepperTrigger
              /**
               * Restores native button semantics.
               *
               * ReUI renders the trigger as `role="tab"` with `aria-selected`
               * and `aria-controls`. Tabs switch views over the same content;
               * wizard steps advance a process, and tab semantics promise
               * arrow-key cycling a wizard must not offer. `mergeProps` puts
               * caller props last, so these override cleanly — the element is
               * already a `<button>` underneath.
               */
              role={undefined}
              aria-selected={undefined}
              aria-controls={undefined}
              aria-current={step.status === 'current' ? 'step' : undefined}
              // Screen readers get the position and the state, which the
              // numbered circle only conveys visually.
              aria-label={`Step ${index + 1} of ${steps.length}: ${step.title}${
                step.status === 'locked' ? ' (not available yet)' : ''
              }`}
            >
              <StepperIndicator
                className={
                  step.status !== 'complete' && index + 1 < currentIndex
                    ? 'bg-accent! text-accent-foreground!'
                    : undefined
                }
              >
                {index + 1}
              </StepperIndicator>
              <StepperTitle>{step.title}</StepperTitle>
            </StepperTrigger>
            {index < steps.length - 1 ? <StepperSeparator /> : null}
          </StepperItem>
        ))}
      </StepperNav>

      <StepperPanel>
        <StepperContent value={currentIndex}>{children}</StepperContent>
      </StepperPanel>
    </Stepper>
  )
}

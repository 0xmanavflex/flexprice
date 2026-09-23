/**
 * Generic behaviour composed over ReUI parts.
 *
 * Nothing here knows what an invoice is — that is `../flexprice`. A composition
 * is the preferred way to differ from the registry, because it leaves the
 * registry component untouched and upgradeable.
 */

export { WorkflowStepper, WorkflowStepperProvenance } from './WorkflowStepper'
export type { StepStatus, WorkflowStep, WorkflowStepperProps } from './WorkflowStepper'

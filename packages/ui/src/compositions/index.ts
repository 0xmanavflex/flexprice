/**
 * Generic behaviour composed over ReUI parts.
 *
 * Nothing here knows what an invoice is — that is `../flexprice`. A composition
 * is the preferred way to differ from the registry, because it leaves the
 * registry component untouched and upgradeable.
 */
export { WorkflowStepper, WorkflowStepperProvenance } from './WorkflowStepper'
export type { StepStatus, WorkflowStep, WorkflowStepperProps } from './WorkflowStepper'

export { Field, FieldProvenance } from './Field'
export type { FieldProps } from './Field'

export { Section, SectionProvenance } from './Section'
export type { SectionProps } from './Section'

export { EmptyState, EmptyStateProvenance } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { Toolbar, ToolbarProvenance } from './Toolbar'
export type { ToolbarProps } from './Toolbar'

export { PageBody, PageHeader, PageProvenance, PageToolbar } from './Page'
export type { PageHeaderProps } from './Page'

export * from './shell'

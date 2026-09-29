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

export { ResourceNavigation, ResourceNavigationProvenance } from './ResourceNavigation'
export type { ResourceNavItem, ResourceNavigationProps } from './ResourceNavigation'

export { EmptyState, EmptyStateProvenance } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { Toolbar, ToolbarProvenance } from './Toolbar'
export type { ToolbarProps } from './Toolbar'

export { PageBody, PageHeader, PageProvenance, PageToolbar } from './Page'
export type { PageHeaderProps } from './Page'

export { FilterBar, FilterBarProvenance, emptyFilterQuery } from './FilterBar'
export type { FilterBarProps, FlatFilter } from './FilterBar'
export { SortMenu, SortMenuProvenance } from './SortMenu'
export type { SortMenuProps, SortOption } from './SortMenu'
export { FitToWindow, FitToWindowProvenance } from './FitToWindow'
export { GridToolbar, GridToolbarProvenance } from './GridToolbar'
export type { GridToolbarProps } from './GridToolbar'
export { GridFooter, GridFooterProvenance } from './GridFooter'
export type { GridFooterProps } from './GridFooter'
export type { FitToWindowProps } from './FitToWindow'
export { useViewportPageSize } from './useViewportPageSize'
export type { ViewportPageSizeOptions } from './useViewportPageSize'

export { AppFailure, AppFailureProvenance } from './AppFailure'
export type { AppFailureProps } from './AppFailure'

export { ErrorState, ListState, LoadingRows, StatesProvenance } from './States'
export type { ErrorStateProps, ListStateProps } from './States'

export { DetailList, DetailListProvenance } from './DetailList'
export type { DetailItem, DetailListProps } from './DetailList'

export { DetailHeader, DetailHeaderProvenance } from './DetailHeader'
export type { DetailHeaderProps } from './DetailHeader'

export { DetailStats, DetailStatsProvenance } from './DetailStats'
export type { DetailStat, DetailStatsProps } from './DetailStats'
export { MetricRail, MetricRailProvenance } from './MetricRail'
export type { DetailMetric, MetricRailProps } from './MetricRail'
export { DetailShell, DetailShellProvenance } from './DetailShell'
export type { DetailShellProps } from './DetailShell'
export { ConfirmDialog, ConfirmDialogProvenance } from './ConfirmDialog'
export type { ConfirmDialogProps } from './ConfirmDialog'

export * from './shell'

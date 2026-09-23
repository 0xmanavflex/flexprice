import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'

/**
 * Nothing here — and what to do about it.
 *
 * Two distinct situations get confused constantly, so they are separate props
 * rather than one message: a surface with no data *yet* wants an invitation to
 * create the first one; a filter matching nothing wants an offer to clear it.
 * Showing "Create your first feature" to someone who just typed a search is
 * the failure this prevents.
 *
 * `role="status"` so the change is announced when a filter empties a list —
 * a sighted user sees the rows vanish, and nobody else is told.
 */
export const EmptyStateProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Semantic empty/no-results region; distinguishes "none yet" from "none matching".',
})

export interface EmptyStateProps {
  title: string
  description?: string
  /** Primary action — usually "create the first one". */
  action?: ReactNode
  /** Shown instead when a filter is responsible for the emptiness. */
  isFiltered?: boolean
  onClearFilters?: ReactNode
  icon?: ReactNode
}

export function EmptyState({
  title,
  description,
  action,
  isFiltered = false,
  onClearFilters,
  icon,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center"
    >
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      ) : null}
      {isFiltered ? onClearFilters : action}
    </div>
  )
}

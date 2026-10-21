import { type ReactNode } from 'react'
import { ArrowUpRightIcon } from '@fp/ui/icons'
import { ApiError } from '@fp/query'
import {
  EMPTY_CATALOGUE,
  DelayedHint,
  EmptyState,
  ErrorState,
  TableSkeleton,
  type EmptyScene,
} from '@fp/ui/compositions'
import { DetailTable, type DetailColumn } from '@fp/ui/pages'
import { Button } from '@fp/ui/primitives'
import { type ListFailure, toListFailure } from '../shared/listFailure'

/**
 * The few things every settings panel needs, in one place.
 *
 * Nine panels, each fetching something and each able to fail, is nine copies of
 * the same error-to-sentence switch and the same "a save went wrong" line. They
 * are here instead, so a panel is its own content plus wiring.
 */

export type Failure = ListFailure

/**
 * An error, as a sentence somebody can act on.
 *
 * `noun` is the thing that failed, in the product's words — "your
 * organisation", "the members list". One mapping with every list and detail
 * page (`toListFailure`), so a 403 never offers a retry and a timeout never
 * reads as "offline".
 */
export function toFailure(error: unknown, noun: string): Failure | null {
  return toListFailure(error, noun)
}

export { queryPhase, type QueryPhase } from './queryPhase'

/** The skeleton a settings form shows while its read is genuinely in flight. */
export function PanelLoading({ rows = 5 }: { rows?: number }) {
  return (
    <Panel>
      <TableSkeleton rows={rows} columns={2} header={false} label="Loading settings" />
    </Panel>
  )
}

/**
 * A panel that cannot load because it cannot be asked: no environment is
 * selected, the role lacks access, or the capability is off. Says so, rather
 * than drawing a skeleton for something that is not coming.
 */
export function PanelUnavailable({
  reason,
  title,
  description,
}: {
  reason: 'setup' | 'permission' | 'unavailable'
  title?: string
  description?: string
}) {
  const copy = EMPTY_CATALOGUE[reason]
  return (
    <Panel>
      <EmptyState
        size="inline"
        figure={copy.figure}
        motion={copy.motion}
        title={title ?? copy.title}
        description={description ?? copy.description}
      />
    </Panel>
  )
}

/**
 * Whatever a failed mutation had to say, as one line.
 *
 * Mutations get their own path because the useful case is the opposite of a
 * query's: a failed save is almost always a 400 whose body explains the rule
 * that was broken — "You have reached the maximum limit of 2 development
 * environment(s)" — and collapsing that into "something went wrong" throws away
 * the only sentence that helps. A failed create being invisible is a bug this
 * console already has elsewhere; it is not repeated here.
 */
export function mutationMessage(error: unknown, fallback: string): string | null {
  if (!error) return null
  if (error instanceof ApiError && error.message) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/**
 * A panel that could not load.
 *
 * The retry button is withheld when retrying cannot help — pressing "Try
 * again" against a 403 forever is worse than being told plainly that the
 * answer will not change.
 */
export function PanelError({ failure, onRetry }: { failure: Failure; onRetry: () => void }) {
  return (
    <ErrorState
      title={failure.message}
      kind={failure.kind}
      {...(failure.canRetry ? { onRetry } : {})}
      {...(failure.retryAfterMs !== undefined ? { retryAfterMs: failure.retryAfterMs } : {})}
    />
  )
}

/** A failed action, announced rather than only painted red. */
export function ActionError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  )
}

/** A save that worked, said once. Announced politely, so it does not interrupt. */
export function ActionNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {message}
    </p>
  )
}

/** The settings surfaces, kept in the kit so a page outside the console can use them. */
export { DelayedHint, HINT_DELAY_MS, InfoBlock, SettingsBlock } from '@fp/ui/compositions'

/**
 * The one table every list-type settings tab opens on: the app's shared
 * `DetailTable` (itself `EntityList`, the table list pages use), borderless,
 * with the create action on its toolbar. No title above it; what it is for is
 * said by `empty` and, on a long hover over the action, by `hint`.
 */
export function SettingsTable<T extends object>({
  label,
  noun,
  hint,
  rows,
  columns,
  getRowId,
  action,
  isLoading,
  empty,
  facet,
}: {
  /** Names the table for assistive tech, e.g. "Team". */
  label: string
  noun: string
  /** One short sentence, on a delayed hover over the action. */
  hint?: string
  rows: T[]
  columns: DetailColumn<T>[]
  getRowId?: (row: T) => string
  action?: ReactNode
  isLoading?: boolean
  /** The first-run state: what this table is for and how to start it. */
  empty: ReactNode
  facet?: { label: string; value: (row: T) => string }
}) {
  // With no rows the empty state carries the create button itself, so the
  // toolbar does not offer it a second time above it.
  const firstRun = !isLoading && rows.length === 0
  const toolbarAction = firstRun ? undefined : action && hint ? (
    <DelayedHint text={hint}>{action}</DelayedHint>
  ) : (
    action
  )
  return (
    <DetailTable<T>
      // Flush with the content column: the settings rail is the frame.
      className="p-0"
      label={label}
      noun={noun}
      rows={rows}
      columns={columns}
      isLoading={isLoading ?? false}
      {...(getRowId ? { getRowId } : {})}
      {...(toolbarAction ? { action: toolbarAction } : {})}
      {...(facet ? { facet } : {})}
      empty={empty}
    />
  )
}

/**
 * The stack a settings panel lives in.
 *
 * A narrower measure than a data grid: these are reading and form surfaces, and
 * a 1440px-wide line of body text is not readable.
 */
export function Panel({ children }: { children: ReactNode }) {
  return <div className="flex max-w-3xl flex-col gap-6 pb-10">{children}</div>
}

/**
 * The same stack, at full width — for the panels that are mostly a table.
 *
 * `fill` makes it take the rest of the page body, for a panel whose only
 * content is its first-run `EmptyState`: a `size="page"` block centres in the
 * height it is given, and without this it is given none, so it sits at the top
 * of an otherwise blank page.
 */
export function WidePanel({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-6 ${fill ? 'flex-1' : 'pb-10'}`}>{children}</div>
  )
}

/**
 * A panel with nothing in it yet: the shared `EmptyState` at page size, centred
 * in the page body, with the create button and a link to the docs. Render it
 * *instead of* the panel's list and toolbar, so the create action is offered
 * once, and inside `<WidePanel fill>` so it has a height to centre in.
 */
export function PanelFirstRun({
  scene = 'settings',
  title,
  description,
  action,
  docsHref,
  docsLabel = 'Read the docs',
}: {
  scene?: EmptyScene
  title: string
  description: string
  action: ReactNode
  docsHref?: string
  docsLabel?: string
}) {
  return (
    <EmptyState
      size="page"
      scene={scene}
      title={title}
      description={description}
      action={action}
      {...(docsHref
        ? {
            secondaryAction: (
              <Button
                variant="outline"
                nativeButton={false}
                // `role="link"`: Base UI marks a non-native button `role="button"`,
                // and this navigates — it should be announced as the link it is.
                render={<a href={docsHref} target="_blank" rel="noreferrer" role="link" />}
              >
                {docsLabel}
                <ArrowUpRightIcon aria-hidden data-icon="inline-end" />
              </Button>
            ),
          }
        : {})}
    />
  )
}

/**
 * One fact, on a line. `DetailList` is the richer version; this is for the
 * two-or-three-fact case where a definition list is more markup than content.
 */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

/** A date as a person reads it, or an honest dash. */
export function formatDate(value: Date | null): string {
  if (!value) return '—'
  return value.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

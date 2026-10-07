import type { ReactNode } from 'react'
import { ApiError } from '@fp/query'
import { ErrorState, Section, SettingsCard } from '@fp/ui/compositions'

/**
 * The few things every settings panel needs, in one place.
 *
 * Nine panels, each fetching something and each able to fail, is nine copies of
 * the same error-to-sentence switch and the same "a save went wrong" line. They
 * are here instead, so a panel is its own content plus wiring.
 */

export interface Failure {
  message: string
  canRetry: boolean
}

/**
 * An error, as a sentence somebody can act on.
 *
 * `noun` is the thing that failed, in the product's words — "your
 * organisation", "the members list" — so the message names what is missing
 * rather than reporting a status code. The same shape `ListState` takes.
 */
export function toFailure(error: unknown, noun: string): Failure | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: `You do not have access to ${noun}.`, canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: `Flexprice had a problem loading ${noun}.`, canRetry: true }
      default:
        // The API's own message, when it wrote one — a 400 explaining *why*
        // (an environment limit, a duplicate name) is worth far more than
        // anything this switch could invent.
        return { message: error.message, canRetry: false }
    }
  }

  return { message: `Something went wrong loading ${noun}.`, canRetry: true }
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
  return <ErrorState title={failure.message} {...(failure.canRetry ? { onRetry } : {})} />
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

/**
 * One settings region, as ReUI's settings card.
 *
 * The same shape as the old section — title, description, an action slot, and
 * the body — drawn with `settings-7`'s card: a bordered header and, when there
 * are actions, the footer bar. Callers keep passing `actions`; they land in
 * that footer.
 */
export function SettingsBlock({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <SettingsCard
      title={title}
      {...(description ? { description } : {})}
      contentClassName="flex min-w-0 flex-col gap-4 overflow-x-auto px-5 py-4"
      {...(actions ? { footer: actions } : {})}
    >
      {children}
    </SettingsCard>
  )
}

/**
 * One list or table region: the title, its line and the primary action sit
 * above a bordered body that holds the search and the rows.
 */
export function TableBlock({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <Section
      table
      title={title}
      {...(description ? { description } : {})}
      {...(actions ? { actions } : {})}
      bodyClassName="flex min-w-0 flex-col gap-4 overflow-x-auto p-4"
    >
      {children}
    </Section>
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

/** The same stack, at full width — for the panels that are mostly a table. */
export function WidePanel({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-6 pb-10">{children}</div>
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

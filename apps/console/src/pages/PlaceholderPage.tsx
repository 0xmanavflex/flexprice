import type { ReactNode } from 'react'
import { Button } from '@fp/ui/primitives'
import { EmptyState, PageBody, PageHeader } from '@fp/ui/compositions'
import { env } from '@/env'

/**
 * A destination that exists in the navigation but not yet in V2.
 *
 * It reads as an empty state, not as a construction notice. "No addons yet",
 * with a sentence saying what an addon is, is true and useful on the day the
 * page ships as well as today: whereas "this is being migrated" is a note to
 * ourselves that a customer has to read and cannot act on, so it is not shown
 * at all.
 *
 * The consequence is that this page mostly stops being a placeholder: when the
 * real screen lands it inherits the same copy, and only the action changes
 * from "open the current dashboard" to "create one".
 */
export interface PlaceholderPageProps {
  title: string
  /** The empty state's own headline. */
  emptyTitle: string
  emptyDescription: string
  /** Label for the primary action, or `null` where creating one is not the move. */
  cta?: string | null
  icon?: ReactNode
  /**
   * Where the working version lives today, as a path in the current dashboard.
   * The origin comes from configuration; with none set, no link is offered.
   */
  legacyPath?: string
}

export function PlaceholderPage({
  title,
  emptyTitle,
  emptyDescription,
  cta,
  icon,
  legacyPath,
}: PlaceholderPageProps) {
  /*
   * The action goes to the current dashboard, because that is where the thing
   * can actually be created today. With no legacy origin configured there is
   * nowhere for it to go, so it is not rendered: a primary button that does
   * nothing is worse than no button.
   */
  const href = legacyPath && env.legacyConsoleUrl ? `${env.legacyConsoleUrl}${legacyPath}` : null

  return (
    <>
      <PageHeader title={title} />
      <PageBody>
        <EmptyState
          {...(icon ? { icon } : {})}
          title={emptyTitle}
          description={emptyDescription}
          {...(cta && href
            ? {
                action: (
                  <Button
                    render={
                      <a
                        href={href}
                        rel="noreferrer"
                        // A new tab, so an unfinished form in the console is
                        // not discarded by following a link out of it.
                        target="_blank"
                      />
                    }
                  >
                    {cta}
                  </Button>
                ),
              }
            : {})}
        />
      </PageBody>
    </>
  )
}

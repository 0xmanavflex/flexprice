import { ConstructionIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'
import { EmptyState, PageBody, PageHeader } from '@fp/ui/compositions'
import { env } from '@/env'

/**
 * A destination that exists in the navigation but not yet in V2.
 *
 * The alternative is what the shell did until now: twenty of twenty-four items
 * navigated to a bare "Not Found", which is indistinguishable from a broken
 * link. A destination that says "this one is still in the current dashboard,
 * here is the link" is honest about the migration and keeps the person moving.
 *
 * This is a migration scaffold with an end date, not a pattern. Each page
 * deletes its own placeholder when it lands.
 */
export interface PlaceholderPageProps {
  title: string
  /** What this screen will be for, in the words a finance person would use. */
  description: string
  /**
   * Where the working version lives today, as a path in the current dashboard.
   * The origin comes from configuration; with none set, no link is offered.
   */
  legacyPath?: string
}

export function PlaceholderPage({ title, description, legacyPath }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <PageBody>
        <EmptyState
          icon={<ConstructionIcon className="size-6" aria-hidden />}
          title={`${title} is not in the new console yet`}
          description="It is being migrated. Until then it works exactly as it does today in the current dashboard."
          {...(legacyPath && env.legacyConsoleUrl
            ? {
                action: (
                  <Button
                    render={
                      <a
                        href={`${env.legacyConsoleUrl}${legacyPath}`}
                        rel="noreferrer"
                        // A new tab, so an unfinished form in the console is
                        // not discarded by following a link out of it.
                        target="_blank"
                      />
                    }
                  >
                    Open in the current dashboard
                  </Button>
                ),
              }
            : {})}
        />
      </PageBody>
    </>
  )
}

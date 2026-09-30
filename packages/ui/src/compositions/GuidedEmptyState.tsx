import type { ReactNode } from 'react'
import { ChevronRightIcon } from 'lucide-react'
// eslint-disable-next-line no-restricted-imports -- wraps the empty-state-3 illustration unchanged, by design
import { ProjectsEmptyIllustration } from '@ui/components/blocks/empty-state-3/components/projects-empty-illustration'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@ui/components/primitives/item'

export interface GuideCard {
  title: string
  description?: string | undefined
  href: string
  icon?: ReactNode
}

export interface GuidedEmptyStateProps {
  title: string
  description?: string | undefined
  /** Primary action(s) under the copy. */
  actions?: ReactNode
  /** Up to three "Read docs" cards beneath. */
  guides?: GuideCard[] | undefined
  /** Accessible name for the status region. */
  label?: string
}

/**
 * The first-run empty state: `empty-state-3`'s illustration (unchanged) with
 * title, description, primary action, and three "Read docs" guide cards.
 * Wraps the block's illustration only; the block's own copy/buttons are demo.
 */
export function GuidedEmptyState({ title, description, actions, guides, label }: GuidedEmptyStateProps) {
  return (
    <div
      className="flex w-full flex-col items-center gap-10 py-14"
      role="status"
      {...(label ? { 'aria-label': label } : {})}
    >
      <div className="flex max-w-[28rem] flex-col items-center gap-4 text-center">
        <div className="text-muted-foreground">
          <ProjectsEmptyIllustration />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-lg font-medium tracking-tight">{title}</p>
          {description ? (
            <p className="text-muted-foreground max-w-[25rem] text-sm/relaxed">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{actions}</div>
        ) : null}
      </div>

      {guides && guides.length > 0 ? (
        <div className="grid w-full max-w-[52rem] gap-3 sm:grid-cols-3">
          {guides.slice(0, 3).map((guide) => (
            <Item
              key={guide.href + guide.title}
              variant="outline"
              render={
                <a
                  href={guide.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${guide.title} — read docs`}
                />
              }
              className="hover:bg-muted/30 min-w-0 flex-col items-start gap-2 transition-colors"
            >
              {guide.icon ? (
                <ItemMedia className="text-muted-foreground">{guide.icon}</ItemMedia>
              ) : null}
              <ItemContent className="min-w-0 gap-1">
                <ItemTitle className="font-medium">{guide.title}</ItemTitle>
                {guide.description ? (
                  <ItemDescription className="line-clamp-2">{guide.description}</ItemDescription>
                ) : null}
              </ItemContent>
              <ItemActions className="text-muted-foreground mt-1 gap-1 text-xs">
                Read docs
                <ChevronRightIcon aria-hidden className="size-3.5" />
              </ItemActions>
            </Item>
          ))}
        </div>
      ) : null}
    </div>
  )
}

import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { Button } from '@ui/components/primitives/button'
import { ArrowRightIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { SceneIllustration, type EmptyScene } from './SceneIllustration'

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
  /** Which area of the product this page belongs to; picks the drawing. */
  scene?: EmptyScene | undefined
}

/**
 * The first-run empty state: a hairline drawing for the area of the product
 * (see `SceneIllustration`) with title, description, primary action, and three
 * "Read docs" guide cards. Laid out as `empty-state-3`'s `EmptyState`: a centred message, then the
 * guide grid as three routes forward.
 */
export function GuidedEmptyState({
  title,
  description,
  actions,
  guides,
  label,
  scene = 'table',
}: GuidedEmptyStateProps) {
  const actionCount =
    isValidElement<{ children?: ReactNode }>(actions) && actions.type === Fragment
      ? Children.count(actions.props.children)
      : Children.count(actions)
  return (
    <div
      className="flex w-full flex-col items-center gap-16 pt-12 pb-8"
      role="status"
      {...(label ? { 'aria-label': label } : {})}
    >
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <SceneIllustration scene={scene} />
        <div className="space-y-2">
          <p className="text-lg font-medium tracking-tight">{title}</p>
          {description ? (
            <p className="text-muted-foreground text-sm/relaxed text-balance">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {actions}
            {actionCount === 1 && guides?.[0] ? (
              <Button
                nativeButton={false}
                variant="outline"
                render={<a href={guides[0].href} target="_blank" rel="noopener noreferrer" />}
              >
                View documentation
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {guides && guides.length > 0 ? (
        <GuideGrid guides={guides.slice(0, 3)} className="max-w-6xl" />
      ) : null}
    </div>
  )
}

/**
 * The resource cards, card-39 style: separate, light, small icon tiles. Exported
 * so a page that composes its own empty state gets the same three routes forward.
 */
export function GuideGrid({
  guides,
  className,
}: {
  guides: GuideCard[]
  className?: string | undefined
}) {
  return (
    <div className={cn('grid w-full gap-6 md:grid-cols-3', className)}>
      {guides.map((guide) => (
        <a
          key={guide.href + guide.title}
          href={guide.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${guide.title}: read docs`}
          className="group bg-background hover:border-foreground/15 flex min-w-0 flex-col gap-3 rounded-xl border p-6 transition-colors"
        >
          {guide.icon ? (
            <span className="text-foreground/70 bg-muted/50 flex size-8 items-center justify-center rounded-lg border [&_svg]:size-4">
              {guide.icon}
            </span>
          ) : null}
          <span className="space-y-1">
            <span className="block text-sm font-medium">{guide.title}</span>
            {guide.description ? (
              <span className="text-muted-foreground block text-[13px] leading-relaxed">
                {guide.description}
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground group-hover:text-foreground mt-auto inline-flex items-center gap-1 pt-5 text-xs font-medium">
            Read docs
            <ArrowRightIcon
              className="size-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </a>
      ))}
    </div>
  )
}

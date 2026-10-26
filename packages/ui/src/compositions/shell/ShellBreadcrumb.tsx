import { Fragment } from 'react'
import { ChevronRightIcon } from '@ui/icons'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@ui/components/primitives/breadcrumb'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import type { ReactNode } from 'react'

/**
 * Where am I, as the reference shell's top bar draws it: the environment
 * switcher first, then the trail, earlier crumbs at 80% foreground and the
 * current page at full strength, with muted chevrons between.
 *
 * Three things distinguish it from the plain breadcrumb, and each earns its
 * place:
 *
 * A crumb may carry a mark: a coloured dot for the environment, an avatar for
 * a person. The mark is what makes the trail scannable without reading it,
 * which matters most for the crumb people most need to not misread.
 *
 * The separator is a chevron. A bullet reads as a list of peers; a chevron
 * reads as descent, which is what a trail is.
 *
 * Labels drop out as the window narrows, oldest first, leaving their marks
 * behind. The alternative is a trail that truncates the *current page*: the
 * one crumb nobody can afford to lose.
 *
 * The shell's navigation is nested two deep, so this has real work to do:
 * "Features" alone does not say it sits under Product Catalog, and on a detail
 * screen it does not say which feature. A crumb with nowhere to go: the page
 * you are already on: is not a link. Any earlier crumb, and a last crumb that
 * still has somewhere to go, is.
 */
export const ShellBreadcrumbProvenance = provenance({
  source: 'composition',
  composes: ['ui/breadcrumb'],
  note: "The reference shell's header trail: a mark per crumb, chevron separators, labels that drop out by width.",
})

export interface ShellCrumb {
  label: string
  /** A dot, an avatar, a glyph. Stays visible when the label is dropped. */
  mark?: ReactNode
  /** Absent means it is not navigable: a grouping, or the current page. */
  onClick?: () => void
  /**
   * A control rendered in place of the label: a dropdown, a switcher.
   *
   * When present it owns the crumb entirely: `mark`, `onClick` and the
   * label/link treatment are skipped, and the control is responsible for its
   * own name. This is how the environment leads the trail as a switcher rather
   * than a static word. `label` is still required, as the crumb's key.
   */
  content?: ReactNode
}

export interface ShellBreadcrumbProps {
  trail: ShellCrumb[]
}

/**
 * Oldest crumbs give up their labels first; the current page always keeps its.
 *
 * `null` means the label is always shown. Otherwise the pair is the class that
 * hides the *label* and the class that hides the *separator that belongs to
 * it*: they must move together, or a dropped crumb leaves a chevron pointing
 * at nothing.
 */
function labelVisibility(index: number, total: number): { label: string; separator: string } {
  const fromEnd = total - 1 - index
  if (fromEnd === 0) return { label: '', separator: '' }
  if (fromEnd === 1) return { label: 'hidden md:inline', separator: 'hidden md:flex' }
  return { label: 'hidden lg:inline', separator: 'hidden lg:flex' }
}

export function ShellBreadcrumb({ trail }: ShellBreadcrumbProps) {
  if (trail.length === 0) return null

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="min-w-0 flex-nowrap">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1
          const visibility = labelVisibility(index, trail.length)
          /*
           * `truncate` and never `wrap-break-word`.
           *
           * The primitive's `<ol>` sets `overflow-wrap: break-word`, and with
           * `flex-nowrap` and `min-w-0` children that broke *inside* words:
           * "Custome/rs", "Subscrip/tions": which doubled the h-12 header to
           * two lines on a phone. An ellipsis is the honest way to run out of
           * room.
           */
          const label = (
            <span className={cn('min-w-0 truncate whitespace-nowrap', visibility.label)}>
              {crumb.label}
            </span>
          )
          const content = (
            <>
              {crumb.mark ? (
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {crumb.mark}
                </span>
              ) : null}
              {label}
            </>
          )

          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem
                className={cn(
                  'flex items-center gap-1.5',
                  /*
                   * The environment crumb gets a floor the page crumb does
                   * not. Both shrink, and at 390 the environment lost the
                   * race and rendered as "Sa…": on a billing console the
                   * difference between a sandbox and production is the one
                   * thing that must never be a guess.
                   */
                  crumb.content ? 'min-w-20' : 'min-w-0',
                  crumb.mark || crumb.content ? '' : visibility.separator,
                )}
              >
                {crumb.content ? (
                  crumb.content
                ) : crumb.onClick ? (
                  <BreadcrumbLink
                    render={<button type="button" onClick={crumb.onClick} />}
                    aria-label={crumb.label}
                    className={cn(
                      'flex min-w-0 items-center gap-1.5',
                      !isLast && 'text-foreground/80',
                    )}
                  >
                    {content}
                  </BreadcrumbLink>
                ) : (
                  // The label can be hidden at narrow widths, so the crumb
                  // carries its own name for anything reading the tree.
                  <BreadcrumbPage
                    aria-label={crumb.label}
                    className={cn(
                      'flex min-w-0 items-center gap-1.5',
                      !isLast && 'text-foreground/80',
                    )}
                  >
                    {content}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>

              {isLast ? null : (
                <BreadcrumbSeparator
                  className={cn(
                    'shrink-0 [&>svg]:size-3.5',
                    // A crumb that keeps a mark is still on screen, so its
                    // separator stays. One that drops to nothing takes its
                    // separator with it.
                    crumb.mark || crumb.content ? '' : visibility.separator,
                  )}
                >
                  <ChevronRightIcon aria-hidden />
                </BreadcrumbSeparator>
              )}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

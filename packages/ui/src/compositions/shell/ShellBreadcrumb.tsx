import { Fragment } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@ui/primitives/breadcrumb'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import type { ReactNode } from 'react'

/**
 * Where am I, in the Flux template's treatment.
 *
 * Three things distinguish it from the plain breadcrumb, and each earns its
 * place:
 *
 * A crumb may carry a mark — a coloured dot for the environment, an avatar for
 * a person. The mark is what makes the trail scannable without reading it,
 * which matters most for the crumb people most need to not misread.
 *
 * The separator is a chevron rather than app-shell-3's bullet. A bullet reads
 * as a list of peers; a chevron reads as descent, which is what a trail is.
 *
 * Labels drop out as the window narrows, oldest first, leaving their marks
 * behind. The alternative is a trail that truncates the *current page* — the
 * one crumb nobody can afford to lose.
 *
 * The shell's navigation is nested two deep, so this has real work to do:
 * "Features" alone does not say it sits under Product Catalog, and on a detail
 * screen it does not say which feature. The last crumb is the current page and
 * is never a link, because a link to where you already are does nothing.
 */
export const ShellBreadcrumbProvenance = provenance({
  source: 'composition',
  composes: ['ui/breadcrumb'],
  note: "Flux's header breadcrumb: a mark per crumb, chevron separators, labels that drop out by width.",
})

export interface ShellCrumb {
  label: string
  /** A dot, an avatar, a glyph. Stays visible when the label is dropped. */
  mark?: ReactNode
  /** Absent means it is not navigable — a grouping, or the current page. */
  onClick?: () => void
  /**
   * A control rendered in place of the label — a dropdown, a switcher.
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

/** Oldest crumbs give up their labels first; the current page always keeps its. */
function labelVisibility(index: number, total: number): string {
  const fromEnd = total - 1 - index
  if (fromEnd === 0) return ''
  if (fromEnd === 1) return 'hidden truncate md:inline'
  return 'hidden truncate lg:inline'
}

export function ShellBreadcrumb({ trail }: ShellBreadcrumbProps) {
  if (trail.length === 0) return null

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1
          const label = (
            <span className={cn('min-w-0', labelVisibility(index, trail.length))}>
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
              <BreadcrumbItem className="flex min-w-0 items-center gap-1.5">
                {crumb.content ? (
                  crumb.content
                ) : isLast || !crumb.onClick ? (
                  // The label can be hidden at narrow widths, so the crumb
                  // carries its own name for anything reading the tree.
                  <BreadcrumbPage
                    aria-label={crumb.label}
                    className="flex min-w-0 items-center gap-1.5"
                  >
                    {content}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={<button type="button" onClick={crumb.onClick} />}
                    aria-label={crumb.label}
                    className="flex min-w-0 items-center gap-1.5"
                  >
                    {content}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>

              {isLast ? null : (
                <BreadcrumbSeparator className="[&>svg]:size-3.5 shrink-0">
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

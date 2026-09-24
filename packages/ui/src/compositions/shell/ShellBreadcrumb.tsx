import { Fragment } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@ui/primitives/breadcrumb'
import { provenance } from '@ui/provenance'

/**
 * Where am I, in `@reui/app-shell-3`'s treatment — a bullet between crumbs
 * rather than a chevron.
 *
 * The shell's navigation is nested two deep, so the header has real work to do:
 * "Features" alone does not say it sits under Product Catalog, and on a detail
 * screen it does not say which feature. The last crumb is the current page and
 * is not a link, because a link to where you already are is a control that does
 * nothing.
 */
export const ShellBreadcrumbProvenance = provenance({
  source: 'composition',
  composes: ['@reui/app-shell-3', 'ui/breadcrumb'],
  note: "The block's header breadcrumb with its bullet separator, driven by a trail.",
})

export interface ShellCrumb {
  label: string
  /** Absent means it is not navigable — a grouping, or the current page. */
  onClick?: () => void
}

export interface ShellBreadcrumbProps {
  trail: ShellCrumb[]
}

function Bullet() {
  return <span aria-hidden className="bg-foreground/30 inline-flex h-0.5 w-2 shrink-0 rounded-full" />
}

export function ShellBreadcrumb({ trail }: ShellBreadcrumbProps) {
  if (trail.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1

          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem
                className={index < trail.length - 1 ? 'hidden items-center md:flex' : undefined}
              >
                {isLast || !crumb.onClick ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<button type="button" onClick={crumb.onClick} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {isLast ? null : (
                <BreadcrumbSeparator className="hidden items-center md:flex">
                  <Bullet />
                </BreadcrumbSeparator>
              )}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

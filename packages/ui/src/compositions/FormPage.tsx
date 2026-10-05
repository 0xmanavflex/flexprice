import type { ReactNode } from 'react'
import { FieldGroup, FieldSet } from '@ui/components/primitives/field'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import type { DetailCrumb } from './DetailShell'
import { usePublishDetailTrail } from './shell/ShellDetailTrail'
import { PageBody } from './Page'
import { Section } from './Section'

/**
 * The full-page shell for creating or editing a major resource.
 *
 * Create and Edit share it: the same body measure, and the actions sit in the
 * card under the fields. Edit is the same form prepopulated, so a person who has
 * created a plan already knows how to edit one. The surface is the reference
 * `Section` (never the Card primitive): it opens with what this form is for —
 * the title and the one-line description. The shell still owns the breadcrumb.
 *
 * Layout only: the `<form>` (and its state) lives in the caller. Pass the
 * form's `id` to `FormActions` so the bar can sit outside the `<form>` element.
 */
export const FormPageProvenance = provenance({
  source: 'composition',
  composes: ['compositions/page', 'compositions/section', 'ui/field'],
  note: 'Full-page create/edit shell on a Section. The heading says what the form is for. Actions sit inside the surface under the fields.',
})

export interface FormPageProps {
  title: string
  description?: string
  /** The way back, then this form. The shell header draws it; the parent crumb is a link. */
  trail: DetailCrumb[]
  children: ReactNode
  /** The sticky bar: usually `FormActions` or a stepper's footer. */
  footer: ReactNode
  width?: 'wide' | 'narrow'
  className?: string
}

export function FormPage({
  title,
  description,
  trail,
  children,
  footer,
  width = 'narrow',
  className,
}: FormPageProps) {
  usePublishDetailTrail(trail)

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {/* `self-center`: this column is a flex child, and a flex child with only
          `mx-auto` stays pinned to the start. The cap (`narrow` / `wide`) then
          sits in the middle of the page. `my-auto` on the card centres it
          vertically when the page is taller than the form; a taller form keeps
          its top reachable and scrolls. */}
      <PageBody width={width} className="self-center">
        <Section
          as="h1"
          title={title}
          {...(description ? { description } : {})}
          className="my-auto"
        >
          <FieldSet className="gap-0">
            <FieldGroup>{children}</FieldGroup>
          </FieldSet>
          {footer ? <div className="mt-6 border-t pt-5">{footer}</div> : null}
        </Section>
      </PageBody>
    </div>
  )
}

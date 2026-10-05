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
      {/* The card fills the viewport: `flex-1` takes every pixel the shell
          leaves under the header, and the actions sit at its foot (`mt-auto`),
          so a short form is a full-height page rather than a small card
          floating in the middle of an empty one. A taller form scrolls. Always
          the full `wide` measure; `narrow` caps the fields, not the surface. */}
      <PageBody width="wide" className="self-center">
        <Section
          as="h1"
          title={title}
          {...(description ? { description } : {})}
          className="flex-1"
          bodyClassName="flex flex-col"
        >
          <FieldSet className="gap-0 pb-6">
            <FieldGroup className={cn(width === 'narrow' && 'max-w-3xl')}>{children}</FieldGroup>
          </FieldSet>
          {footer ? <div className="mt-auto border-t pt-5">{footer}</div> : null}
        </Section>
      </PageBody>
    </div>
  )
}

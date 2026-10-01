import type { ReactNode } from 'react'
import { Card, CardContent } from '@ui/components/primitives/card'
import { FieldGroup, FieldSet } from '@ui/components/primitives/field'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import type { DetailCrumb } from './DetailShell'
import { PageBody } from './Page'

/**
 * The full-page shell for creating or editing a major resource.
 *
 * Create and Edit share it: the same body measure, and the actions sit in the
 * card under the fields. Edit is the same form prepopulated, so a person who has
 * created a plan already knows how to edit one. The shell already shows where
 * you are, so this page does not draw its own breadcrumb or title. The title
 * stays in the document outline only.
 *
 * Layout only: the `<form>` (and its state) lives in the caller. Pass the
 * form's `id` to `FormActions` so the bar can sit outside the `<form>` element.
 */
export const FormPageProvenance = provenance({
  source: 'composition',
  composes: ['compositions/page', 'ui/card', 'ui/field'],
  note: 'Full-page create/edit shell. No page heading or breadcrumb — the shell already shows where you are. The body is form-3’s card, and the actions sit inside it under the fields.',
})

export interface FormPageProps {
  title: string
  description?: string
  /** Accepted so existing callers keep compiling. The shell owns navigation, so it is not drawn here. */
  trail: DetailCrumb[]
  children: ReactNode
  /** The sticky bar: usually `FormActions` or a stepper's footer. */
  footer: ReactNode
  width?: 'wide' | 'narrow'
  className?: string
}

export function FormPage({
  title,
  children,
  footer,
  width = 'narrow',
  className,
}: FormPageProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <h1 className="sr-only">{title}</h1>
      <PageBody width={width}>
        {/* form-3's card. The actions sit under the fields, in the same card,
            so Cancel and Next are not stranded at the bottom of the viewport. */}
        <Card className="gap-0 p-0 shadow-xs">
          <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
            <FieldSet className="gap-0">
              <FieldGroup>{children}</FieldGroup>
            </FieldSet>
            {footer ? <div className="mt-6 border-t pt-4">{footer}</div> : null}
          </CardContent>
        </Card>
      </PageBody>
    </div>
  )
}

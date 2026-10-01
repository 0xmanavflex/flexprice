import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ui/components/primitives/card'
import { FieldGroup, FieldSet } from '@ui/components/primitives/field'
import { Separator } from '@ui/components/primitives/separator'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import type { DetailCrumb } from './DetailShell'
import { usePublishDetailTrail } from './shell/ShellDetailTrail'
import { PageBody } from './Page'

/**
 * The full-page shell for creating or editing a major resource.
 *
 * Create and Edit share it: the same body measure, and the actions sit in the
 * card under the fields. Edit is the same form prepopulated, so a person who has
 * created a plan already knows how to edit one. The card opens with what this
 * form is for — the title and the one-line description — the same heading the
 * invoice creator uses. The shell still owns the breadcrumb.
 *
 * Layout only: the `<form>` (and its state) lives in the caller. Pass the
 * form's `id` to `FormActions` so the bar can sit outside the `<form>` element.
 */
export const FormPageProvenance = provenance({
  source: 'composition',
  composes: ['compositions/page', 'ui/card', 'ui/field'],
  note: 'Full-page create/edit shell. The card heading says what the form is for. Actions sit inside the card under the fields.',
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
        <Card className="my-auto gap-0 p-0 shadow-xs">
          <CardHeader className="gap-1 px-5 py-5 sm:px-6">
            <CardTitle>
              <h1 className="text-base leading-snug font-medium">{title}</h1>
            </CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <Separator />
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

import type { ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { DetailBreadcrumb, type DetailCrumb } from './DetailShell'
import { PageBody, PageHeader } from './Page'

/**
 * The full-page shell for creating or editing a major resource.
 *
 * Create and Edit share it: same header, same body measure, same sticky action
 * bar. Edit is the same form prepopulated, so a person who has created a plan
 * already knows how to edit one. The breadcrumb is the back navigation (the
 * last crumb is the page itself), and the action bar stays in view while a long
 * form scrolls beneath it.
 *
 * Layout only: the `<form>` (and its state) lives in the caller. Pass the
 * form's `id` to `FormActions` so the bar can sit outside the `<form>` element.
 */
export const FormPageProvenance = provenance({
  source: 'composition',
  composes: ['compositions/page', 'compositions/detail-shell'],
  note: 'Full-page create/edit shell: breadcrumb back-nav, header, body, sticky action bar.',
})

export interface FormPageProps {
  title: string
  description?: string
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
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <PageHeader
        title={title}
        {...(description ? { description } : {})}
        breadcrumb={<DetailBreadcrumb trail={trail} />}
      />
      <PageBody width={width}>{children}</PageBody>
      <div className="bg-background border-t px-6 py-3">
        <div
          className={cn(
            'mx-auto w-full',
            width === 'narrow' ? 'max-w-3xl' : 'max-w-[var(--shell-max)]',
          )}
        >
          {footer}
        </div>
      </div>
    </div>
  )
}

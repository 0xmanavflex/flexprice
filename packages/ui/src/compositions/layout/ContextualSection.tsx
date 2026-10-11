import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeftIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Section } from './Section'

/**
 * A detail-page section that turns into its own create/edit form and back.
 *
 * "Create subscription" on a customer does not leave the customer: the
 * Subscriptions section swaps its table for the form, in place, under the same
 * header, tabs and breadcrumb. Cancel (or a successful save) swaps the table
 * back. The parent's tab and the surrounding page never unmount, so nothing
 * about "I am working inside this customer" is lost.
 *
 * Presentational: the caller decides whether `form` is present, and refetches
 * the table on success. Focus moves to the form heading when it opens, so a
 * keyboard or screen-reader user lands where the content changed.
 */
export const ContextualSectionProvenance = provenance({
  source: 'composition',
  composes: ['compositions/section', 'ui/button'],
  note: 'Section that swaps its table for an in-place create/edit form, keeping the parent page.',
})

export interface ContextualSectionProps {
  title: string
  description?: string
  /** Buttons for the table state, e.g. "Create subscription". Hidden while the form is open. */
  actions?: ReactNode
  /** The table state. */
  children: ReactNode
  /** When present the section shows this instead of `children`. */
  form?: ReactNode
  formTitle?: string
  formDescription?: string
  /** Label for the way back, defaults to the section title. */
  backLabel?: string
  onBack?: () => void
  className?: string
}

export function ContextualSection({
  title,
  description,
  actions,
  children,
  form,
  formTitle,
  formDescription,
  backLabel,
  onBack,
  className,
}: ContextualSectionProps) {
  const headingRef = useRef<HTMLDivElement>(null)
  const open = form !== undefined && form !== null && form !== false

  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [open])

  if (!open) {
    return (
      <Section
        title={title}
        {...(description ? { description } : {})}
        {...(actions ? { actions } : {})}
        {...(className ? { className } : {})}
      >
        {children}
      </Section>
    )
  }

  return (
    <section
      aria-label={formTitle ?? title}
      className={cn('bg-background flex flex-col rounded-xl border', className)}
    >
      <header className="flex flex-col gap-2 border-b px-6 py-4">
        {onBack ? (
          <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
            <ArrowLeftIcon aria-hidden className="size-4" />
            {backLabel ?? title}
          </Button>
        ) : null}
        <div ref={headingRef} tabIndex={-1} className="flex flex-col gap-1 outline-none">
          <h2 className="text-sm font-medium">{formTitle ?? title}</h2>
          {formDescription ? (
            <p className="text-muted-foreground text-[13px]">{formDescription}</p>
          ) : null}
        </div>
      </header>
      <div className="p-6">{form}</div>
    </section>
  )
}

import { useId, useState, type ReactNode } from 'react'
import { ChevronDownIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { FormCard } from './FormCard'

export const FormDisclosureProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-card'],
  note: 'A form section folded behind one header row. Its fields stay mounted while closed, so values and validation survive; it opens itself when a field inside has an error.',
})

export interface FormDisclosureProps {
  title: string
  /** What is inside, so the closed row still says what it holds. */
  summary?: string
  /** Initial state. */
  defaultOpen?: boolean
  /** Force it open (e.g. a hidden field failed validation). It never forces it closed. */
  forceOpen?: boolean
  children: ReactNode
  className?: string
}

/** Optional fields out of the way: only the required ones are fillable at first sight. */
export function FormDisclosure({
  title,
  summary,
  defaultOpen = false,
  forceOpen = false,
  children,
  className,
}: FormDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const shown = open || forceOpen
  return (
    <section className={cn('bg-background flex w-full flex-col rounded-xl border', className)}>
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={panelId}
        onClick={() => setOpen(!shown)}
        className="hover:bg-muted/40 flex w-full items-center justify-between gap-4 rounded-xl px-5 py-4 text-left transition-colors sm:px-6"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          {summary ? <span className="text-muted-foreground text-[13px]">{summary}</span> : null}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform',
            shown && 'rotate-180',
          )}
        />
      </button>
      <div id={panelId} hidden={!shown} className="border-t">
        <FormCard className="rounded-t-none border-0">{children}</FormCard>
      </div>
    </section>
  )
}

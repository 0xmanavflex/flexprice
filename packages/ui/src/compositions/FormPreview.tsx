import { useId, type ReactNode } from 'react'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@ui/components/primitives/item'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The live preview rail beside a form: a heading with an optional badge, a one
 * line description, then a big amount, titled sections and label/value rows.
 *
 * The structure of the ReUI `solution-billing-8` proration rail
 * (`blocks/solution-billing-8/components/plan-change-wizard.tsx`: `ProrationSummary`,
 * `AmountRow`, `SummarySection`, `SummaryRow`). Those parts are private to that
 * demo and cannot be edited in place, so they are rebuilt here with the same
 * markup and tokens, and fed by props instead of a hard-coded subscription.
 */
export const FormPreviewProvenance = provenance({
  source: 'composition',
  composes: ['ui/item'],
  note: 'solution-billing-8 rail: heading + badge, dashed amount row, titled sections, label/value rows. Lineage: blocks/solution-billing-8.',
})

export interface FormPreviewProps {
  title: string
  /** Names the rail for assistive tech; defaults to the title. */
  label?: string
  /** A status or direction badge beside the title. */
  badge?: ReactNode
  description?: string
  children: ReactNode
  className?: string
}

export function FormPreview({
  title,
  label,
  badge,
  description,
  children,
  className,
}: FormPreviewProps) {
  const headingId = useId()
  return (
    <aside
      aria-label={label ?? title}
      aria-labelledby={label ? undefined : headingId}
      className={cn(
        'flex min-w-0 flex-col gap-5 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 id={headingId} className="text-sm font-medium">
            {title}
          </h2>
          {badge}
        </div>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {children}
    </aside>
  )
}

/** The dashed, emphasised headline figure. */
export function PreviewAmount({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <Item
      variant="outline"
      className="border-foreground/20 bg-muted/35 flex-nowrap gap-3 border-dashed py-3"
    >
      <ItemContent className="gap-0.5">
        <ItemTitle className="text-foreground font-medium">{label}</ItemTitle>
        {hint ? (
          <ItemDescription className="line-clamp-none text-xs leading-4">{hint}</ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions>
        <span className="text-foreground min-w-0 text-right text-lg leading-6 font-medium break-words tabular-nums">
          {value}
        </span>
      </ItemActions>
    </Item>
  )
}

/** A titled group: `PreviewRows` for label/value pairs, or any text. */
export function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-sm leading-5 font-medium">{title}</h3>
      {children}
    </section>
  )
}

export function PreviewRows({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-2.5">{children}</dl>
}

export function PreviewRow({
  label,
  value,
  hint,
  strong,
}: {
  label: string
  value: ReactNode
  hint?: string
  strong?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="text-foreground flex min-w-0 flex-col gap-0.5">
        <span>{label}</span>
        {hint ? <span className="text-muted-foreground text-xs leading-4">{hint}</span> : null}
      </dt>
      <dd
        className={cn(
          'text-foreground min-w-0 text-right break-words tabular-nums',
          strong ? 'text-base font-medium' : 'font-medium',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

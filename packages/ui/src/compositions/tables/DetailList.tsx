import type { ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A read-only list of label → value pairs (the reference's `Properties` look).
 *
 * The detail-page equivalent of `Field`: the same twelve lines of a `<dl>` grid
 * appeared on the coupon detail and the group profile, so it lives here once.
 * A real `<dl>`/`<dt>`/`<dd>` rather than styled `<div>`s, because a definition
 * list *is* what a details card is, and assistive tech reads the pairing.
 *
 * `columns` is the only decision: one column reads as a form, two fills the
 * width of a card the way V1's detail cards do. A value that is missing is the
 * caller's to render: an em dash, "Not set": because "no code" and "no redeem
 * window" are not the same absence.
 */
export const DetailListProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Semantic dl grid for detail cards. Shared by the coupon detail and group profile.',
})

export interface DetailItem {
  label: string
  value: ReactNode
  /** Spans both columns: for wide values like metadata or a description. */
  full?: boolean
}

export interface DetailListProps {
  items: DetailItem[]
  columns?: 1 | 2
  className?: string
}

export function DetailList({ items, columns = 2, className }: DetailListProps) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-8 gap-y-5',
        columns === 2 && 'sm:grid-cols-2',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn('min-w-0 space-y-1', item.full && columns === 2 && 'sm:col-span-2')}
        >
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="min-w-0 text-sm break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

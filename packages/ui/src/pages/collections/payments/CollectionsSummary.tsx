import { Skeleton } from '@ui/components/primitives/skeleton'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

export const CollectionsSummaryProvenance = provenance({
  source: 'composition',
  composes: ['ui/skeleton'],
  note: 'Two-cell strip above the Payments list: total outstanding and total overdue, each with a count beneath.',
})

export interface CollectionsSummaryCell {
  label: string
  /** Formatted by the caller; `null` shows a dash. */
  value: string | null
  hint: string
  /** `danger` colours the hint, never the figure. */
  tone?: 'danger'
}

export interface CollectionsSummaryProps {
  cells: readonly CollectionsSummaryCell[]
  isLoading?: boolean
  className?: string
}

/**
 * What customers owe, before the list of every attempt to collect it.
 *
 * One bordered surface divided into cells rather than separate cards, so the
 * figures read as a single statement. The number stays in the foreground colour;
 * only the hint underneath turns red, so a large overdue total does not shout
 * louder than the page title.
 */
export function CollectionsSummary({
  cells,
  isLoading = false,
  className,
}: CollectionsSummaryProps) {
  return (
    <section
      aria-label="Collections summary"
      className={cn(
        'bg-background grid rounded-xl border sm:divide-x',
        cells.length > 1 ? 'sm:grid-cols-2' : '',
        className,
      )}
    >
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col gap-1 px-6 py-5">
          <p className="text-muted-foreground text-[13px]">{cell.label}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="text-2xl font-medium tracking-tight tabular-nums">{cell.value ?? '—'}</p>
          )}
          <p
            className={cn(
              'text-xs',
              cell.tone === 'danger' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {isLoading ? ' ' : cell.hint}
          </p>
        </div>
      ))}
    </section>
  )
}

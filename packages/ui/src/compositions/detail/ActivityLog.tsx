import { ScrollArea } from '@ui/components/primitives/scroll-area'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Section } from '../layout/Section'

export const ActivityLogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/section', 'ui/scroll-area'],
  note: 'Colourless activity log: one neutral dot for every item, full date and time on its own line, the acted-on record highlighted, "By name" only when a person did it.',
})

export interface ActivityLogEntry {
  id: string | number
  title: string
  /** Full date and time, already formatted ("Sep 28, 2026, 3:42 PM"). */
  at: string
  /** The record that was acted on, highlighted before the summary. */
  record?: string | undefined
  /** What happened, muted. */
  summary?: string | undefined
  /** Who did it. Omitted when the system did. */
  by?: string | undefined
}

/**
 * The neutral log every customer, contract and invoice page shares. Colour
 * carries meaning only, and an activity item has none, so every dot is the same.
 * Pass entries newest first.
 */
export function ActivityLog({ entries }: { entries: ActivityLogEntry[] }) {
  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
          {index < entries.length - 1 ? (
            <span aria-hidden className="bg-border absolute top-4 bottom-0 left-[3px] w-px" />
          ) : null}
          <span
            aria-hidden
            className="bg-muted-foreground/50 relative mt-[7px] size-[7px] shrink-0 rounded-full"
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm leading-5 font-medium">{entry.title}</p>
            <p className="text-muted-foreground text-xs tabular-nums">{entry.at}</p>
            {entry.record || entry.summary ? (
              <p className="text-muted-foreground pt-0.5 text-[13px] leading-5">
                {entry.record ? (
                  <span className="text-foreground font-medium">{entry.record}</span>
                ) : null}
                {entry.record && entry.summary ? ' ' : null}
                {entry.summary}
              </p>
            ) : null}
            {entry.by ? <p className="text-muted-foreground text-xs">By {entry.by}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** The "Activity" panel in a detail page's right rail: fixed height, scrolls. */
export function ActivitySection({
  entries,
  className,
}: {
  entries: ActivityLogEntry[]
  className?: string
}) {
  return (
    <Section title="Activity" flush {...(className ? { className } : {})}>
      {entries.length === 0 ? (
        <p className="text-muted-foreground px-6 py-5 text-[13px]">No activity yet.</p>
      ) : (
        <ScrollArea className={cn('h-[420px]')}>
          <div className="p-6">
            <ActivityLog entries={entries} />
          </div>
        </ScrollArea>
      )}
    </Section>
  )
}

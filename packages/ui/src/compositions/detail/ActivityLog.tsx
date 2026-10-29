import type { ReactNode } from 'react'
import type { ActivityField } from '@fp/domain'
import { provenance } from '@ui/provenance'
import { Button } from '@ui/components/primitives/button'
import { EyeIcon } from '@ui/icons'
import { Section } from '../layout/Section'

export const ActivityLogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/section'],
  note: 'Colourless activity log: one neutral dot for every item, full date and time on its own line, the acted-on record highlighted, its values as muted label / value pairs, "By name" only when a person did it.',
})

export interface ActivityLogEntry {
  id: string | number
  title: string
  /** When, already formatted: compact on the card ("24 Oct · 18:03"). */
  at: string
  /** The full, zone-named time, shown on hover. */
  atTitle?: string | undefined
  /** A status tag beside the title, e.g. a version's Current / Upcoming / History. */
  tag?: ReactNode
  /** The record that was acted on, highlighted before the summary. */
  record?: string | undefined
  /** What happened, muted. */
  summary?: string | undefined
  /**
   * What the record stood at, one labelled value per line ("Total", "$35.00"),
   * so several amounts never run together in one sentence.
   */
  fields?: readonly ActivityField[] | undefined
  /** A second muted line, such as the amount paid. */
  detail?: string | undefined
  /** Who did it. Omitted when the system did. */
  by?: string | undefined
  /** Page for this entity. Set only when the id maps to a route. */
  href?: string | undefined
  /** One action on this entry, e.g. reverting to a price version. */
  action?: ReactNode
  /** Opens the event's details (a drawer); the title becomes the control. */
  onSelect?: (() => void) | undefined
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
            <span aria-hidden className="bg-border absolute top-4 bottom-0 left-[3.5px] w-px" />
          ) : null}
          <span
            aria-hidden
            className="border-muted-foreground/50 bg-background relative mt-1.5 size-2 shrink-0 rounded-full border"
          />
          <div className="min-w-0 space-y-0.5">
            <p className="flex flex-wrap items-center gap-2 text-sm leading-5 font-medium">
              {entry.onSelect ? (
                <Button
                  variant="link"
                  onClick={entry.onSelect}
                  className="text-foreground h-auto p-0 text-sm font-medium"
                >
                  {entry.title}
                </Button>
              ) : entry.href ? (
                <a href={entry.href} className="hover:underline">
                  {entry.title}
                </a>
              ) : (
                entry.title
              )}
              {entry.tag}
            </p>
            <p
              className="text-muted-foreground text-xs tabular-nums"
              {...(entry.atTitle ? { title: entry.atTitle } : {})}
            >
              {entry.at}
            </p>
            {entry.record || entry.summary ? (
              <p className="text-muted-foreground pt-0.5 text-[13px] leading-5">
                {entry.record ? (
                  entry.href ? (
                    <a href={entry.href} className="text-foreground font-medium hover:underline">
                      {entry.record}
                    </a>
                  ) : (
                    <span className="text-foreground font-medium">{entry.record}</span>
                  )
                ) : null}
                {entry.record && entry.summary ? ' · ' : null}
                {entry.summary}
              </p>
            ) : null}
            {entry.fields && entry.fields.length > 0 ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 pt-0.5 text-[13px] leading-5">
                {entry.fields.map((field) => (
                  <div key={field.label} className="contents">
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd className="text-foreground min-w-0 truncate tabular-nums">{field.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {entry.detail ? (
              <p className="text-muted-foreground text-[13px] leading-5">{entry.detail}</p>
            ) : null}
            {entry.by ? <p className="text-muted-foreground text-xs">By {entry.by}</p> : null}
            {entry.action ? <div className="pt-2">{entry.action}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** The "Activity" panel. It grows with its entries, and scrolls once it is taller than the rail. */
const ACTIVITY_MAX_HEIGHT = 'max-h-[420px]'

export function ActivitySection({
  entries,
  className,
  note,
  awaiting = false,
  emptyText = 'No activity yet.',
  onViewAll,
}: {
  entries: ActivityLogEntry[]
  className?: string
  /** Optional line under the log. */
  note?: string
  /** A change just succeeded and the new row has not been written yet. */
  awaiting?: boolean
  emptyText?: string
  /** Opens the full audit trail (the Activity tab). */
  onViewAll?: () => void
}) {
  return (
    <Section
      title="Activity"
      flush
      {...(className ? { className } : {})}
      {...(onViewAll
        ? {
            action: (
              // As the overview's other "View all" buttons (invoices, payments).
              <Button variant="outline" size="sm" className="h-8 px-3" onClick={onViewAll}>
                <EyeIcon aria-hidden="true" />
                View all
                <span className="sr-only"> activity</span>
              </Button>
            ),
          }
        : {})}
    >
      {entries.length === 0 && !awaiting ? (
        <p className="text-muted-foreground px-6 py-5 text-[13px]">{emptyText}</p>
      ) : (
        <div
          role="region"
          aria-label="Activity history"
          tabIndex={0}
          className={`${ACTIVITY_MAX_HEIGHT} overflow-y-auto`}
        >
          <div className="p-6">
            {awaiting ? <ActivityWait /> : null}
            {entries.length > 0 ? <ActivityLog entries={entries} /> : null}
          </div>
        </div>
      )}
      {note ? <p className="text-muted-foreground border-t px-6 py-3 text-xs">{note}</p> : null}
    </Section>
  )
}

function ActivityWait() {
  return (
    <p role="status" className="text-muted-foreground mb-4 flex items-center gap-2 text-[13px]">
      <span
        aria-hidden
        className="border-foreground/40 size-2 animate-pulse rounded-full border border-dashed"
      />
      Waiting for the next activity
    </p>
  )
}

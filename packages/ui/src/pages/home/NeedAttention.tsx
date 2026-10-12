import { CircleCheckIcon, ChevronRightIcon } from '@ui/icons'
import { RetryAction } from '@ui/compositions/feedback/RetryAction'
import { Panel } from '@ui/compositions/layout/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

export const NeedAttentionProvenance = provenance({
  source: 'composition',
  composes: ['compositions/Section', 'compositions/feedback/RetryAction'],
  note: 'The task list on Home: each row is one thing a person has to act on, with how many and where to go. The dot carries urgency, the only colour on the row. Empty means the API answered and nothing is waiting; unavailable means it could not be asked.',
})

export type AttentionTone = 'critical' | 'warning' | 'neutral'

/** One thing that needs a person: a count of records and the list that holds them. */
export interface AttentionItem {
  id: string
  /** The whole claim, with its number: "3 overdue invoices". */
  title: string
  /** Who or what it is, muted: "Acme, Globex and 1 more". */
  detail?: string | undefined
  tone: AttentionTone
  /** The filtered list to open, query string included. */
  path: string
}

export interface AttentionPanel {
  status: 'loading' | 'ready' | 'unavailable'
  items: AttentionItem[]
  /** Retry for an `unavailable` list, or for a `stale` one. Omitted, no button is drawn. */
  onRetry?: (() => void) | undefined
  isRetrying?: boolean | undefined
  /**
   * The last refresh failed and `items` is the previous good copy. Keeps the
   * rows on screen (data beats an error) and says they may be out of date.
   */
  stale?: boolean | undefined
}

const DOT: Record<AttentionTone, string> = {
  critical: 'bg-destructive',
  warning: 'bg-warning',
  neutral: 'bg-muted-foreground',
}

const TONE_LABEL: Record<AttentionTone, string> = {
  critical: 'Urgent',
  warning: 'Soon',
  neutral: 'Routine',
}

export interface NeedAttentionProps {
  attention: AttentionPanel
  onOpen: (path: string) => void
  className?: string
}

/**
 * Home's task list. Rows are ordered as given — the page puts the most urgent
 * first — and the urgency is spoken as well as coloured, so the dot is never
 * the only thing saying so.
 */
export function NeedAttention({ attention, onOpen, className }: NeedAttentionProps) {
  const count = attention.items.length

  return (
    <Panel
      title="Needs attention"
      titleId="need-attention-title"
      titleAdornment={
        attention.status === 'ready' && count > 0 ? (
          <span className="text-muted-foreground text-xs font-normal tabular-nums">{count}</span>
        ) : null
      }
      {...(className ? { className } : {})}
    >
      {attention.status === 'loading' ? (
        <div className="divide-y" role="status" aria-busy="true" aria-label="Loading tasks">
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-3 px-5 py-3.5">
              <span className="bg-muted size-2 rounded-full" aria-hidden="true" />
              <span
                className="bg-muted h-3.5 w-48 rounded motion-safe:animate-pulse"
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
      ) : attention.status === 'unavailable' ? (
        <div
          role="alert"
          className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs"
        >
          <span>Tasks could not be loaded. Nothing is being claimed either way.</span>
          {attention.onRetry ? (
            <RetryAction
              onRetry={attention.onRetry}
              {...(attention.isRetrying !== undefined ? { isRetrying: attention.isRetrying } : {})}
            />
          ) : null}
        </div>
      ) : count === 0 ? (
        <p
          role="status"
          className="text-muted-foreground flex items-center gap-2 px-5 py-4 text-sm"
        >
          <CircleCheckIcon className="size-4" aria-hidden="true" />
          {attention.stale
            ? 'Nothing needed attention when last checked. Couldn’t refresh.'
            : 'Nothing needs attention.'}
          {attention.stale && attention.onRetry ? (
            <RetryAction
              onRetry={attention.onRetry}
              variant="ghost"
              {...(attention.isRetrying !== undefined ? { isRetrying: attention.isRetrying } : {})}
            />
          ) : null}
        </p>
      ) : (
        <>
          {attention.stale ? (
            <div
              role="status"
              className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-b px-5 py-2 text-xs"
            >
              <span>Couldn’t refresh. These tasks may be out of date.</span>
              {attention.onRetry ? (
                <RetryAction
                  onRetry={attention.onRetry}
                  variant="ghost"
                  {...(attention.isRetrying !== undefined
                    ? { isRetrying: attention.isRetrying }
                    : {})}
                />
              ) : null}
            </div>
          ) : null}
          <ul className="divide-y">
            {attention.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item.path)}
                  className="hover:bg-muted/50 focus-visible:ring-ring/50 group flex w-full items-center gap-3 px-5 py-3.5 text-left outline-none first:rounded-t-lg last:rounded-b-lg focus-visible:ring-3 focus-visible:ring-inset"
                >
                  <span
                    aria-hidden="true"
                    className={cn('size-2 shrink-0 rounded-full', DOT[item.tone])}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    {item.detail ? (
                      <span className="text-muted-foreground block truncate text-xs">
                        {item.detail}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {TONE_LABEL[item.tone]}
                  </span>
                  <ChevronRightIcon
                    className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ArrowUpRightIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { SceneIllustration, type EmptyScene } from '../feedback/SceneIllustration'

/**
 * What changed, as a stack of cards at the foot of the sidebar.
 *
 * The shape and the gestures are ReUI's `app-shell-7` news stack: the newest
 * card on top with up to two peeking behind it, swipe it sideways or press
 * Dismiss to take it off, and the click or "Read more" opens the docs in a new
 * tab. Hover (or a drag) fans the rest of the stack out.
 *
 * Two things differ from the block. A dismissal is remembered per entry in
 * `localStorage`, so a card stays gone after a reload and a new entry still
 * shows to someone who dismissed the old ones. And the picture is one of the
 * product's own line figures, chosen by the area the change touches, instead of
 * a photograph.
 */
export const ShellChangelogProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'SceneIllustration'],
  note: "Lineage: @reui/app-shell-7 sidebar-news (stack, swipe-to-dismiss, read more). Adds per-entry dismissal in localStorage and the product's SceneIllustration figures.",
})

export interface ShellChangelogEntry {
  /** Stable and unique: it is the key a dismissal is remembered under. */
  id: string
  title: string
  summary: string
  /** Where "Read more" goes: the docs page for the change. */
  href: string
  /** Which product figure illustrates the card. */
  scene: EmptyScene
}

export interface ShellChangelogProps {
  /** Newest first. The stack shows the first three; the rest wait behind them. */
  entries: ShellChangelogEntry[]
  /**
   * The `localStorage` key holding the dismissed entry ids. Omit it and
   * dismissals last for the session only.
   */
  storageKey?: string
  className?: string
}

const OFFSET_FACTOR = 4
const SCALE_FACTOR = 0.03
const OPACITY_FACTOR = 0.1
const COMPLETED_DISPLAY_MS = 2700
/** Enough to remember every entry ever shipped without the list growing forever. */
const MAX_REMEMBERED = 50

function readDismissed(storageKey: string | undefined): string[] {
  if (!storageKey) return []
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeDismissed(storageKey: string | undefined, ids: string[]) {
  if (!storageKey) return
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids))
  } catch {
    /* private-mode browser: dismissed for this session at least */
  }
}

function ChangelogCard({
  entry,
  onDismiss,
  hideContent,
  active,
}: {
  entry: Pick<ShellChangelogEntry, 'title' | 'summary'> & Partial<ShellChangelogEntry>
  onDismiss?: () => void
  hideContent?: boolean
  active?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({ start: 0, delta: 0, startTime: 0, maxDelta: 0 })
  const animation = useRef<Animation | undefined>(undefined)
  const [dragging, setDragging] = useState(false)

  const onDragMove = (e: globalThis.PointerEvent) => {
    if (!ref.current) return
    const dx = e.clientX - drag.current.start
    drag.current.delta = dx
    drag.current.maxDelta = Math.max(drag.current.maxDelta, Math.abs(dx))
    ref.current.style.setProperty('--dx', dx.toString())
  }

  const dismiss = () => {
    if (!ref.current) return
    const width = ref.current.getBoundingClientRect().width
    // A button press has no drag direction; it leaves to the right.
    const direction = Math.sign(drag.current.delta) || 1
    animation.current = ref.current.animate(
      { opacity: 0, transform: `translateX(${direction * width}px)` },
      { duration: 150, easing: 'ease-in-out', fill: 'forwards' },
    )
    animation.current.onfinish = () => onDismiss?.()
  }

  const stopDragging = (cancelled: boolean) => {
    unbindListeners()
    if (!ref.current) return
    setDragging(false)
    if (Math.abs(drag.current.delta) > ref.current.clientWidth / (cancelled ? 2 : 3)) {
      dismiss()
      return
    }
    animation.current = ref.current.animate(
      { transform: 'translateX(0)' },
      { duration: 150, easing: 'ease-in-out' },
    )
    animation.current.onfinish = () => ref.current?.style.setProperty('--dx', '0')
    drag.current = { start: 0, delta: 0, startTime: 0, maxDelta: 0 }
  }

  const onDragEnd = () => stopDragging(false)
  const onDragCancel = () => stopDragging(true)

  function bindListeners() {
    document.addEventListener('pointermove', onDragMove)
    document.addEventListener('pointerup', onDragEnd)
    document.addEventListener('pointercancel', onDragCancel)
  }

  function unbindListeners() {
    document.removeEventListener('pointermove', onDragMove)
    document.removeEventListener('pointerup', onDragEnd)
    document.removeEventListener('pointercancel', onDragCancel)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!active || !ref.current || animation.current?.playState === 'running') return
    bindListeners()
    setDragging(true)
    drag.current.start = e.clientX
    drag.current.startTime = Date.now()
    drag.current.delta = 0
    ref.current.style.setProperty('--w', ref.current.clientWidth.toString())
  }

  // A tap, not the end of a swipe, opens the docs.
  const onClick = () => {
    if (!ref.current || !entry.href) return
    const still = drag.current.maxDelta < ref.current.clientWidth / 10
    const quick = !drag.current.startTime || Date.now() - drag.current.startTime < 250
    if (still && quick) window.open(entry.href, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      ref={ref}
      className={cn(
        'bg-card text-card-foreground relative cursor-grab rounded-lg border p-3 text-xs shadow-xs select-none',
        'translate-x-[calc(var(--dx)*1px)] rotate-[calc(var(--dx)*0.05deg)] opacity-[calc(1-max(var(--dx),-1*var(--dx))/var(--w)/2)]',
        'transition-shadow data-[dragging=true]:cursor-grabbing data-[dragging=true]:shadow-md',
      )}
      style={{ '--dx': 0, '--w': 1 } as CSSProperties}
      data-dragging={dragging}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div className={cn(hideContent && 'invisible')}>
        <div className="flex flex-col gap-1">
          <span className="text-foreground line-clamp-1 text-sm font-medium">{entry.title}</span>
          <p className="text-muted-foreground line-clamp-2 h-8 leading-4">{entry.summary}</p>
        </div>
        <div className="bg-muted/60 pointer-events-none mt-3 flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border">
          {entry.scene ? <SceneIllustration scene={entry.scene} className="w-40" /> : null}
        </div>
        {/* Read more and Dismiss open under the top card on hover, drag or focus. */}
        <div
          className={cn(
            'grid grid-rows-[0fr] overflow-hidden opacity-0 transition-[grid-template-rows,opacity] duration-200',
            'sm:group-has-[*[data-dragging=true]]:grid-rows-[1fr] sm:group-has-[*[data-dragging=true]]:opacity-100',
            'sm:group-hover:group-data-[active=true]:grid-rows-[1fr] sm:group-hover:group-data-[active=true]:opacity-100',
            'has-focus-visible:grid-rows-[1fr] has-focus-visible:opacity-100',
          )}
        >
          <div className="min-h-0">
            <div className="flex items-center justify-between pt-2">
              <a
                href={entry.href ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium"
              >
                Read more
                <ArrowUpRightIcon aria-hidden className="size-3" />
              </a>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-muted-foreground -mr-2"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  dismiss()
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ShellChangelog({ entries, storageKey, className }: ShellChangelogProps) {
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed(storageKey))
  const cards = entries.filter(({ id }) => !dismissed.includes(id))
  const count = cards.length
  // Only someone who just cleared the stack sees "all caught up"; a reload
  // with nothing new shows nothing at all.
  const [showCompleted, setShowCompleted] = useState(count > 0)

  useEffect(() => {
    if (count !== 0) return
    const timeout = setTimeout(() => setShowCompleted(false), COMPLETED_DISPLAY_MS)
    return () => clearTimeout(timeout)
  }, [count])

  if (count === 0 && !showCompleted) return null

  const dismiss = (id: string) => {
    const next = [id, ...dismissed.filter((d) => d !== id)].slice(0, MAX_REMEMBERED)
    setDismissed(next)
    writeDismissed(storageKey, next)
  }

  // Drawn back to front, so the newest card sits on top.
  const stack = [...cards].reverse()

  return (
    <section
      aria-label="What's new"
      className={cn('group in-data-[state=collapsed]:hidden', className)}
      data-active={count !== 0}
    >
      <div className="relative size-full">
        {stack.map((entry, idx) => {
          const depth = count - (idx + 1)
          const top = idx === count - 1
          return (
            <div
              key={entry.id}
              className={cn(
                'absolute top-0 left-0 size-full scale-(--scale) transition-[opacity,transform] duration-200',
                depth >= 3
                  ? [
                      'opacity-0 sm:group-hover:translate-y-(--y) sm:group-hover:opacity-(--opacity)',
                      'sm:group-has-[*[data-dragging=true]]:translate-y-(--y) sm:group-has-[*[data-dragging=true]]:opacity-(--opacity)',
                    ]
                  : 'translate-y-(--y) opacity-(--opacity)',
              )}
              style={
                {
                  '--y': `-${depth * OFFSET_FACTOR}%`,
                  '--scale': 1 - depth * SCALE_FACTOR,
                  '--opacity': depth >= 6 ? 0 : 1 - depth * OPACITY_FACTOR,
                } as CSSProperties
              }
              aria-hidden={!top}
              {...(top ? {} : { inert: true })}
            >
              <ChangelogCard
                entry={entry}
                hideContent={depth >= 2}
                active={top}
                onDismiss={() => dismiss(entry.id)}
              />
            </div>
          )
        })}

        {/* Holds the stack's height, since every card is absolutely placed. */}
        <div className="pointer-events-none invisible" aria-hidden>
          <ChangelogCard entry={{ title: 'Title', summary: 'Summary' }} />
        </div>

        {showCompleted && count === 0 ? (
          <div className="absolute inset-0 flex size-full flex-col items-center justify-end pb-4">
            <span className="text-muted-foreground text-xs font-medium" role="status">
              You&apos;re all caught up
            </span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

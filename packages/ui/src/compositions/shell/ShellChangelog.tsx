import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ArrowUpRightIcon, PlayIcon } from '@ui/icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/components/primitives/dialog'
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
  composes: ['ui/button', 'ui/dialog', 'SceneIllustration'],
  note: "Lineage: @reui/app-shell-7 sidebar-news (stack, swipe-to-dismiss, read more). Adds per-entry dismissal in localStorage and the product's SceneIllustration figures.",
})

export interface ShellChangelogEntry {
  /** Stable and unique: it is the key a dismissal is remembered under. */
  id: string
  title: string
  summary: string
  /** Where "Read more" goes: the docs page for the change, or the video's own page. */
  href: string
  /**
   * An embeddable player for the change (a Loom `/embed/` URL). With one, the
   * card's picture becomes a play button that opens it here, in an
   * announcement dialog, instead of leaving the console.
   */
  video?: string | undefined
  /** A still of the video, shown on the card and in the dialog before it plays. */
  poster?: string | undefined
  /** How long it runs, as shown on the still: "1:29". */
  duration?: string | undefined
  /** The dialog's copy, which can say more than the card; the card's own words when absent. */
  announcement?: { eyebrow: string; title: string; description: string } | undefined
  /**
   * Opens the video once, unasked, the first time the stack shows (which is
   * right after sign-in). Remembered beside the dismissals, so never twice.
   */
  autoOpen?: boolean | undefined
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
  onPlay,
  hideContent,
  active,
  reserveActions = false,
}: {
  entry: Pick<ShellChangelogEntry, 'title' | 'summary'> & Partial<ShellChangelogEntry>
  onDismiss?: () => void
  /** Plays the entry's video in place. */
  onPlay?: () => void
  hideContent?: boolean
  active?: boolean
  /**
   * Draw the row that opens on hover as already open. The invisible card that
   * sizes the stack does, so the row opens inside the stack's own space
   * instead of spilling over the sidebar item below it.
   */
  reserveActions?: boolean
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

  // A tap, not the end of a swipe, plays the video or opens the docs.
  const onClick = () => {
    if (!ref.current || !entry.href) return
    const still = drag.current.maxDelta < ref.current.clientWidth / 10
    const quick = !drag.current.startTime || Date.now() - drag.current.startTime < 250
    if (!still || !quick) return
    if (entry.video && onPlay) onPlay()
    else window.open(entry.href, '_blank', 'noopener,noreferrer')
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
        {entry.video && onPlay ? (
          // The picture is the play button: what to press is on the card itself.
          <button
            type="button"
            aria-label={`Watch: ${entry.title}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onPlay()
            }}
            className="group/play bg-muted/60 focus-visible:ring-ring/50 relative mt-3 flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border outline-none focus-visible:ring-3"
          >
            {entry.poster ? (
              <img src={entry.poster} alt="" className="absolute inset-0 size-full object-cover" />
            ) : entry.scene ? (
              <SceneIllustration scene={entry.scene} className="w-40" />
            ) : null}
            <span className="bg-background/90 text-foreground relative flex size-9 items-center justify-center rounded-full border shadow-sm transition-transform group-hover/play:scale-105">
              <PlayIcon aria-hidden className="ml-0.5 size-4 fill-current" />
            </span>
            {entry.duration ? (
              <span className="bg-background/90 text-foreground absolute right-1.5 bottom-1.5 rounded px-1.5 py-0.5 text-[10px] tabular-nums">
                {entry.duration}
              </span>
            ) : null}
          </button>
        ) : (
          <div className="bg-muted/60 pointer-events-none mt-3 flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border">
            {entry.scene ? <SceneIllustration scene={entry.scene} className="w-40" /> : null}
          </div>
        )}
        {/* Read more and Dismiss open under the top card on hover, drag or focus. */}
        <div
          className={cn(
            'grid overflow-hidden opacity-0 transition-[grid-template-rows,opacity] duration-200',
            reserveActions ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            'sm:group-has-[*[data-dragging=true]]:grid-rows-[1fr] sm:group-has-[*[data-dragging=true]]:opacity-100',
            'sm:group-hover:group-data-[active=true]:grid-rows-[1fr] sm:group-hover:group-data-[active=true]:opacity-100',
            'has-focus-visible:grid-rows-[1fr] has-focus-visible:opacity-100',
          )}
        >
          <div className="min-h-0">
            <div className="flex items-center justify-between pt-2">
              {entry.video && onPlay ? (
                <span />
              ) : (
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
              )}
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
  const [playing, setPlaying] = useState<ShellChangelogEntry | null>(null)

  // The announcement opens itself once, the first time the stack shows (right
  // after sign-in), and is remembered so a reload or the next visit does not.
  const announced = useRef(false)
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    const playedKey = storageKey ? `${storageKey}.played` : undefined
    const played = readDismissed(playedKey)
    const announce = entries.find(
      (entry) =>
        entry.autoOpen &&
        entry.video &&
        !played.includes(entry.id) &&
        !dismissed.includes(entry.id),
    )
    if (!announce) return
    writeDismissed(playedKey, [announce.id, ...played].slice(0, MAX_REMEMBERED))
    setPlaying(announce)
  }, [entries, storageKey, dismissed])

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
                onPlay={() => setPlaying(entry)}
              />
            </div>
          )
        })}

        {/* Holds the stack's height, since every card is absolutely placed. */}
        <div className="pointer-events-none invisible" aria-hidden>
          <ChangelogCard entry={{ title: 'Title', summary: 'Summary' }} reserveActions />
        </div>

        {showCompleted && count === 0 ? (
          <div className="absolute inset-0 flex size-full flex-col items-center justify-end pb-4">
            <span className="text-muted-foreground text-xs font-medium" role="status">
              You&apos;re all caught up
            </span>
          </div>
        ) : null}
      </div>
      <VideoAnnouncement entry={playing} onClose={() => setPlaying(null)} />
    </section>
  )
}

/** Loom's player without its own title bar, owner, share and comments, starting at once. */
function quietPlayer(url: string): string {
  const params = 'autoplay=1&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true'
  return `${url}${url.includes('?') ? '&' : '?'}${params}`
}

/**
 * The video as a product announcement: what it is about first, then a clean
 * still with one play button (the player, with its controls, only once
 * pressed), then a way out to the video's own page. Closing is always there.
 */
function VideoAnnouncement({
  entry,
  onClose,
}: {
  entry: ShellChangelogEntry | null
  onClose: () => void
}) {
  const [started, setStarted] = useState(false)
  const copy = entry?.announcement ?? {
    eyebrow: "What's new",
    title: entry?.title ?? '',
    description: entry?.summary ?? '',
  }
  const close = () => {
    setStarted(false)
    onClose()
  }
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
        <DialogHeader className="gap-1.5 px-6 pt-6 pb-4">
          <p className="text-primary text-[11px] font-medium tracking-wider uppercase">
            {copy.eyebrow}
          </p>
          <DialogTitle className="text-xl font-medium">{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="px-6">
          {entry?.video ? (
            started ? (
              <iframe
                src={quietPlayer(entry.video)}
                title={copy.title}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full rounded-xl border"
              />
            ) : (
              <button
                type="button"
                aria-label={`Play: ${copy.title}`}
                onClick={() => setStarted(true)}
                className="group/play bg-muted focus-visible:ring-ring/50 relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border outline-none focus-visible:ring-3"
              >
                {entry.poster ? (
                  <img
                    src={entry.poster}
                    alt=""
                    className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/play:scale-[1.02]"
                  />
                ) : (
                  <SceneIllustration scene={entry.scene} className="w-56" />
                )}
                <span className="bg-background/95 text-foreground relative flex size-16 items-center justify-center rounded-full border shadow-lg transition-transform group-hover/play:scale-105">
                  <PlayIcon aria-hidden className="ml-1 size-6 fill-current" />
                </span>
                {entry.duration ? (
                  <span className="bg-background/95 text-foreground absolute bottom-3 left-3 rounded-md px-2 py-1 text-xs tabular-nums shadow-sm">
                    {entry.duration} · Product walkthrough
                  </span>
                ) : null}
              </button>
            )
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
          <span className="text-muted-foreground text-xs">
            Explore what&apos;s new in Flexprice
          </span>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a href={entry?.href ?? '#'} target="_blank" rel="noopener noreferrer" role="link" />
            }
          >
            Open in new tab
            <ArrowUpRightIcon aria-hidden />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

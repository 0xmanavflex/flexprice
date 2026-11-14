import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type * as PdfJs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Button } from '@ui/components/primitives/button'
import { ButtonGroup } from '@ui/components/primitives/button-group'
import { Spinner } from '@ui/components/primitives/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { SparklesIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { layoutMarks, type Segment } from './documentMarks'

/**
 * A document shown as pages, the way it was signed, with what was read from it
 * marked on the page.
 *
 * A PDF is drawn page by page with pdf.js onto paper-like sheets, with a rail
 * of page miniatures to jump between them; an image is one sheet. Over the
 * pages it draws highlights: a highlighter-style fill behind the words each
 * term came from, green when confident, yellow (dashed) when a person should
 * check it. While `scanning`, a scan line travels down the pages instead.
 *
 * pdf.js is loaded on first use, so a page that never shows a PDF never
 * downloads it. Pages are drawn only as they scroll near the view.
 */
export const DocumentViewerProvenance = provenance({
  source: 'composition',
  composes: ['pdfjs-dist', 'ui/spinner', 'ui/tooltip', 'ui/button-group'],
  note: 'Renders a PDF (pdf.js, lazily, page by page) or an image as paper sheets with a rail of page miniatures, highlights where each term was read (confident / needs review), and a scan while the document is being read.',
})

/** pdf.js and its worker, fetched once, on first use. */
let pdfjs: Promise<typeof PdfJs> | null = null
function loadPdfjs() {
  pdfjs ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })
  return pdfjs
}

/** The widest a sheet is drawn, in CSS pixels: `max-w-[40rem]`. */
const SHEET_WIDTH = 640
/** A page in the rail, in CSS pixels: `w-12`. */
const THUMB_WIDTH = 48

/** A file chosen in this browser, or a link to one (for when the server can hand it back). */
export type DocumentSource = { file: File } | { url: string; mediaType?: string | undefined }

/** Where on a page something was read, in fractions of the page from its top-left corner. */
export interface DocumentBox {
  page: number
  left: number
  top: number
  width: number
  height: number
}

export interface DocumentHighlight {
  id: string
  /** What was read, e.g. "Billing frequency". */
  label: string
  /** The value read, e.g. "Monthly". */
  value: string
  tone: 'confident' | 'doubt'
  /** One per line or page the words run over. */
  boxes: readonly DocumentBox[]
}

/** Which highlights are drawn: all, only the ones to check, or none. */
export type DocumentHighlightFilter = 'all' | 'doubt' | 'none'

export interface DocumentViewerProps {
  /** A PDF or an image. Null, or another type, renders `empty`. */
  source: DocumentSource | null
  /** Shown when there is no document, or it cannot be shown. */
  empty: ReactNode
  highlights?: readonly DocumentHighlight[] | undefined
  /** The selected highlight: scrolled into view and emphasised. */
  activeId?: string | null | undefined
  onSelect?: ((id: string) => void) | undefined
  filter?: DocumentHighlightFilter | undefined
  onFilterChange?: ((filter: DocumentHighlightFilter) => void) | undefined
  /** Scrolls to a page. Pass a new object to jump again to the same page. */
  jumpTo?: { page: number } | null | undefined
  /** The document is being read: scan the pages. */
  scanning?: boolean | undefined
  className?: string
}

type Kind = 'pdf' | 'image'

function kindOf(source: DocumentSource | null): Kind | null {
  if (!source) return null
  const [type, name] =
    'file' in source ? [source.file.type, source.file.name] : [source.mediaType ?? '', source.url]
  if (type === 'application/pdf' || /\.pdf($|\?)/i.test(name)) return 'pdf'
  if (type.startsWith('image/') || /\.(png|jpe?g)($|\?)/i.test(name)) return 'image'
  return null
}

/** Identity of a source, so a new document starts the viewer afresh. */
const sourceKey = (source: DocumentSource) =>
  'file' in source
    ? `${source.file.name}:${source.file.size}:${source.file.lastModified}`
    : source.url

export function DocumentViewer({ source, empty, className, ...rest }: DocumentViewerProps) {
  const kind = kindOf(source)
  if (!source || !kind) return <div className={cn('flex min-h-0 flex-1', className)}>{empty}</div>
  return (
    <Viewer
      key={sourceKey(source)}
      kind={kind}
      source={source}
      empty={empty}
      className={className}
      {...rest}
    />
  )
}

type ViewerProps = Omit<DocumentViewerProps, 'source' | 'className'> & {
  kind: Kind
  source: DocumentSource
  className?: string | undefined
}

function Viewer({
  kind,
  source,
  empty,
  className,
  highlights = [],
  activeId = null,
  onSelect,
  filter = 'all',
  onFilterChange,
  jumpTo,
  scanning = false,
}: ViewerProps) {
  const pdf = usePdf(kind === 'pdf' ? source : null)
  const image = useObjectUrl(kind === 'image' ? source : null)
  const [active, setActive] = useState(1)
  const sheets = useRef(new Map<number, HTMLElement>())
  const region = useRef<HTMLDivElement>(null)
  const doc = pdf.doc
  const ratios = usePageRatios(doc)
  // A PDF is laid out once every page's size is known, so the column never
  // shifts under a scroll to a page or a term.
  const numPages = kind === 'image' ? 1 : ratios ? ratios.length : 0

  // The page most in view drives the rail.
  useEffect(() => {
    if (!numPages) return
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting)
        const top = seen.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const page = Number((top?.target as HTMLElement | undefined)?.dataset['page'])
        if (page) setActive(page)
      },
      { threshold: [0.25, 0.5, 0.75] },
    )
    sheets.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [numPages])

  useEffect(() => {
    if (jumpTo)
      sheets.current.get(jumpTo.page)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [jumpTo])

  // A newly selected term is brought to the middle of the view.
  useEffect(() => {
    if (!activeId || !numPages) return
    const box = region.current?.querySelector(`[data-highlight-ids~="${CSS.escape(activeId)}"]`)
    box?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeId, numPages])

  if (pdf.failed) return <div className={cn('flex min-h-0 flex-1', className)}>{empty}</div>
  if (!numPages) {
    return (
      <div className={cn('flex min-h-0 flex-1 items-center justify-center', className)}>
        <Spinner aria-label="Opening the document" />
      </div>
    )
  }

  // Reading order sets the stagger as the strokes are drawn in.
  const order = new Map(highlights.map((h, index) => [h.id, index]))
  const pages = Array.from({ length: numPages }, (_, i) => i + 1)

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <Toolbar
        scanning={scanning}
        highlights={highlights}
        filter={filter}
        onFilterChange={onFilterChange}
      />
      <div className="flex min-h-0 flex-1">
        {doc ? (
          <nav
            aria-label="Pages"
            className="hidden w-20 shrink-0 flex-col items-center gap-3 overflow-y-auto border-r py-4 md:flex"
          >
            {pages.map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Page ${n}`}
                aria-current={n === active ? 'page' : undefined}
                onClick={() =>
                  sheets.current.get(n)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="group text-muted-foreground aria-[current=page]:text-foreground flex shrink-0 flex-col items-center gap-1 rounded-sm text-[10px] leading-none tabular-nums outline-none"
              >
                <span className="group-hover:border-foreground/40 group-focus-visible:ring-ring/50 group-aria-[current=page]:border-primary group-aria-[current=page]:ring-primary/30 relative block w-12 overflow-hidden rounded-[3px] border shadow-xs group-focus-visible:ring-[3px] group-aria-[current=page]:ring-2">
                  <PdfCanvas doc={doc} page={n} ratio={ratios?.[n - 1]} width={THUMB_WIDTH} />
                  {scanning ? <Scan delay={(n - 1) * 0.25} /> : null}
                </span>
                {n}
              </button>
            ))}
          </nav>
        ) : null}
        <div
          ref={region}
          role="region"
          aria-label="Document pages"
          aria-busy={scanning || undefined}
          // Scrollable, so it must be reachable by keyboard.
          tabIndex={0}
          className="focus-visible:ring-ring/50 flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6 outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
        >
          {pages.map((n) => (
            <div
              key={n}
              data-page={n}
              ref={(el) => {
                if (el) sheets.current.set(n, el)
                else sheets.current.delete(n)
              }}
              className="scroll-mt-6"
            >
              <Sheet label={`Page ${n} of ${numPages}`}>
                {doc ? (
                  <PdfCanvas
                    doc={doc}
                    page={n}
                    ratio={ratios?.[n - 1]}
                    width={SHEET_WIDTH}
                    lookAhead
                  />
                ) : (
                  <img src={image ?? undefined} alt={sourceName(source)} className="block w-full" />
                )}
                <PageOverlay
                  page={n}
                  highlights={highlights}
                  order={order}
                  activeId={activeId}
                  onSelect={onSelect}
                  filter={filter}
                  scanning={scanning}
                />
              </Sheet>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const sourceName = (source: DocumentSource) => ('file' in source ? source.file.name : 'Document')

/** Opens a PDF source with pdf.js. The viewer is keyed by its source, so it is read once. */
function usePdf(source: DocumentSource | null) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [initial] = useState(source)
  useEffect(() => {
    if (!initial) return
    let cancelled = false
    // Destroying the loading task also destroys the document it opened.
    let destroy: (() => Promise<void>) | null = null
    void (async () => {
      try {
        const lib = await loadPdfjs()
        const params =
          'file' in initial
            ? { data: new Uint8Array(await initial.file.arrayBuffer()) }
            : { url: initial.url }
        if (cancelled) return
        const task = lib.getDocument(params)
        destroy = () => task.destroy()
        const opened = await task.promise
        if (!cancelled) setDoc(opened)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      void destroy?.()
    }
  }, [initial])
  return { doc, failed }
}

/** Each page's height over its width, read without drawing anything. */
function usePageRatios(doc: PDFDocumentProxy | null): number[] | null {
  const [ratios, setRatios] = useState<number[] | null>(null)
  useEffect(() => {
    if (!doc) return
    let cancelled = false
    void Promise.all(
      Array.from({ length: doc.numPages }, (_, i) =>
        doc.getPage(i + 1).then(
          (page) => {
            const { width, height } = page.getViewport({ scale: 1 })
            return height / width
          },
          () => LETTER,
        ),
      ),
    ).then((next) => {
      if (!cancelled) setRatios(next)
    })
    return () => {
      cancelled = true
    }
  }, [doc])
  return ratios
}

/** US Letter, for a page whose size cannot be read. */
const LETTER = 11 / 8.5

/** An image source's address: an object URL for a file, released on unmount. */
function useObjectUrl(source: DocumentSource | null): string | null {
  const [owned] = useState(() =>
    source && 'file' in source ? URL.createObjectURL(source.file) : null,
  )
  useEffect(
    () => () => {
      if (owned) URL.revokeObjectURL(owned)
    },
    [owned],
  )
  return owned ?? (source && 'url' in source ? source.url : null)
}

function Sheet({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure className="mx-auto flex w-full max-w-[40rem] flex-col gap-1.5">
      <div className="bg-background relative overflow-hidden rounded-sm border shadow-sm">
        {children}
      </div>
      <figcaption className="text-muted-foreground text-center text-xs tabular-nums">
        {label}
      </figcaption>
    </figure>
  )
}

/** The scan line over one page or miniature, while the document is read. */
function Scan({ delay }: { delay: number }) {
  return (
    <span
      aria-hidden
      className="ai-scan pointer-events-none absolute inset-0"
      style={{ '--ai-delay': `${delay}s` } as CSSProperties}
    />
  )
}

const FILTERS: [DocumentHighlightFilter, string][] = [
  ['all', 'All'],
  ['doubt', 'Needs review'],
  ['none', 'Off'],
]

function Toolbar({
  scanning,
  highlights,
  filter,
  onFilterChange,
}: {
  scanning: boolean
  highlights: readonly DocumentHighlight[]
  filter: DocumentHighlightFilter
  onFilterChange?: ((filter: DocumentHighlightFilter) => void) | undefined
}) {
  if (scanning) {
    return (
      <div className="bg-background flex h-10 shrink-0 items-center gap-2 border-b px-4 text-xs">
        <SparklesIcon aria-hidden className="ai-accent size-3.5" />
        <span className="ai-shimmer font-medium">Flexprice AI is reading the pages</span>
      </div>
    )
  }
  if (highlights.length === 0) return null
  const doubts = highlights.filter((h) => h.tone === 'doubt').length
  return (
    <div className="bg-background flex h-10 shrink-0 items-center gap-4 border-b px-4 text-xs">
      <span className="text-muted-foreground flex items-center gap-1.5">
        <span aria-hidden className="bg-success/40 size-2.5 rounded-[2px]" />
        Confident · {highlights.length - doubts}
      </span>
      <span className="text-muted-foreground flex items-center gap-1.5">
        <span
          aria-hidden
          className="bg-warning/45 border-warning size-2.5 rounded-[2px] border border-dashed"
        />
        Needs review · {doubts}
      </span>
      {onFilterChange ? (
        <ButtonGroup aria-label="Highlights" className="ml-auto">
          {FILTERS.map(([value, text]) => (
            <Button
              key={value}
              type="button"
              size="xs"
              variant={filter === value ? 'secondary' : 'outline'}
              aria-pressed={filter === value}
              onClick={() => onFilterChange(value)}
            >
              {text}
            </Button>
          ))}
        </ButtonGroup>
      ) : null}
    </div>
  )
}

/** The highlights (or the scan) drawn over one page. */
function PageOverlay({
  page,
  highlights,
  order,
  activeId,
  onSelect,
  filter,
  scanning,
}: {
  page: number
  highlights: readonly DocumentHighlight[]
  order: Map<string, number>
  activeId: string | null
  onSelect?: ((id: string) => void) | undefined
  filter: DocumentHighlightFilter
  scanning: boolean
}) {
  if (scanning) return <Scan delay={(page - 1) * 0.35} />
  const shown =
    filter === 'none'
      ? []
      : filter === 'doubt'
        ? highlights.filter((h) => h.tone === 'doubt')
        : highlights
  const segments = layoutMarks(shown, page)
  if (segments.length === 0) return null
  // Each term is one stop for the keyboard: the first stretch it leads.
  const stops = new Set<string>()
  const touches = (a: Segment<DocumentHighlight>, b: Segment<DocumentHighlight>, edge: number) =>
    a !== b &&
    Math.abs(edge) < 0.001 &&
    Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) < b.height
  return (
    <div className="pointer-events-none absolute inset-0">
      {segments.map((segment) => {
        const lead = segment.terms[0]
        const stop = lead && !stops.has(lead.id)
        if (stop) stops.add(lead.id)
        return (
          <Mark
            key={`${segment.left.toFixed(4)}:${segment.top.toFixed(4)}:${segment.terms.map((t) => t.id).join(',')}`}
            segment={segment}
            focusable={Boolean(stop)}
            // Flush against a neighbour: no padding or rounding on that side, so
            // the stroke reads as one and nothing is painted twice.
            joinsLeft={segments.some((o) => touches(segment, o, o.left + o.width - segment.left))}
            joinsRight={segments.some((o) =>
              touches(segment, o, segment.left + segment.width - o.left),
            )}
            activeId={activeId}
            delay={Math.min(
              Math.min(...segment.terms.map((t) => order.get(t.id) ?? 0)) * 0.035,
              1.2,
            )}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}

const percent = (fraction: number) => `${(fraction * 100).toFixed(3)}%`

const describe = (h: DocumentHighlight) => {
  const value = h.value.length > 80 ? `${h.value.slice(0, 79)}…` : h.value
  const text = [h.label, value].filter(Boolean).join(' · ')
  return h.tone === 'doubt' ? `${text} · Needs review` : text
}

function Mark({
  segment,
  focusable,
  joinsLeft,
  joinsRight,
  activeId,
  delay,
  onSelect,
}: {
  segment: Segment<DocumentHighlight>
  focusable: boolean
  joinsLeft: boolean
  joinsRight: boolean
  activeId: string | null
  delay: number
  onSelect?: ((id: string) => void) | undefined
}) {
  const { terms } = segment
  const doubt = segment.tone === 'doubt'
  const activeIndex = terms.findIndex((t) => t.id === activeId)
  const active = activeIndex >= 0
  const lead = terms[0]
  if (!lead) return null
  const others = terms.length - 1
  const name = others
    ? `${describe(lead)} · and ${others} more ${others === 1 ? 'term' : 'terms'}`
    : describe(lead)
  const padLeft = joinsLeft ? 0 : 2
  const padRight = joinsRight ? 0 : 2
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-highlight-ids={terms.map((t) => t.id).join(' ')}
            aria-label={name}
            aria-pressed={active}
            aria-hidden={focusable ? undefined : true}
            tabIndex={focusable ? 0 : -1}
            // Where terms share words, clicking again moves to the next of them.
            onClick={() =>
              onSelect?.((terms[active ? (activeIndex + 1) % terms.length : 0] ?? lead).id)
            }
            className={cn(
              'ai-found focus-visible:ring-ring pointer-events-auto absolute cursor-pointer rounded-[2px] mix-blend-multiply transition-[background-color,box-shadow] outline-none focus-visible:ring-2',
              joinsLeft && 'rounded-l-none',
              joinsRight && 'rounded-r-none',
              // "Needs review" is a dashed underline as well as a colour.
              doubt
                ? 'bg-warning/35 hover:bg-warning/50 border-warning border-b-2 border-dashed'
                : 'bg-success/25 hover:bg-success/40',
              active && 'z-[1] ring-2',
              active && (doubt ? 'bg-warning/55 ring-warning' : 'bg-success/45 ring-success'),
            )}
            style={
              {
                // A little room around the words, as a highlighter leaves.
                left: `calc(${percent(segment.left)} - ${padLeft}px)`,
                top: `calc(${percent(segment.top)} - 1px)`,
                width: `calc(${percent(segment.width)} + ${padLeft + padRight}px)`,
                height: `calc(${percent(segment.height)} + 2px)`,
                '--ai-delay': `${delay}s`,
              } as CSSProperties
            }
          >
            {active ? (
              <span
                aria-hidden
                className={cn(
                  'ai-focus absolute inset-0 rounded-[2px] ring-2',
                  doubt ? 'ring-warning' : 'ring-success',
                )}
              />
            ) : null}
          </button>
        }
      />
      <TooltipContent>
        {terms.length === 1 ? (
          name
        ) : (
          <ul className="flex flex-col gap-0.5">
            {terms.map((t) => (
              <li key={t.id}>{describe(t)}</li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * One page drawn onto a canvas `width` CSS pixels wide, the first time it comes
 * into view (or near it, with `lookAhead`). The same drawing serves the sheets
 * and the rail's miniatures, so the rail shows the pages, not placeholders.
 */
function PdfCanvas({
  doc,
  page,
  ratio = LETTER,
  width,
  lookAhead = false,
}: {
  doc: PDFDocumentProxy
  page: number
  /** Height over width, known before the page is drawn. */
  ratio?: number | undefined
  width: number
  lookAhead?: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: lookAhead ? '600px 0px' : '0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [lookAhead])

  useEffect(() => {
    if (!near) return
    let cancelled = false
    let cancelRender: (() => void) | null = null
    void (async () => {
      const pdfPage = await doc.getPage(page)
      const base = pdfPage.getViewport({ scale: 1 })
      if (cancelled || !canvas.current) return
      const scale = (width * (window.devicePixelRatio || 1)) / base.width
      const viewport = pdfPage.getViewport({ scale })
      const el = canvas.current
      el.width = Math.floor(viewport.width)
      el.height = Math.floor(viewport.height)
      const task = pdfPage.render({ canvas: el, viewport })
      cancelRender = () => task.cancel()
      await task.promise.then(
        () => !cancelled && setDrawn(true),
        () => undefined,
      )
    })()
    return () => {
      cancelled = true
      cancelRender?.()
    }
  }, [doc, page, near, width])

  return (
    <canvas
      ref={canvas}
      // The sheet's caption and the rail's button already name the page.
      aria-hidden
      // A muted block until the page is drawn; pdf.js paints the paper itself.
      className={cn('block h-auto w-full', !drawn && 'bg-muted')}
      style={{ aspectRatio: `1 / ${ratio}` }}
    />
  )
}

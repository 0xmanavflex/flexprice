import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * Hairline figures: one-pixel line drawings for the states where there is
 * nothing to show.
 *
 * Drawn here rather than imported. The reference (hairline.lucasmarkes.com)
 * shows what a figure can be: a line drawing that leans toward the pointer:
 * but a dependency would bring thirty-three figures for the dozen we use, and a
 * second visual language. These share Flexprice's tokens: strokes are
 * `currentColor`, so a figure is as muted as the text around it in both themes.
 *
 * Three layers (back, mid, front) so the pointer can shift them by different
 * amounts. That is the whole interaction: no state, no re-render: the pointer
 * writes two CSS variables and the stylesheet does the rest.
 *
 * Motion is a choice per use, not a default everywhere:
 *   static       a drawing. Inside a table body, where the toolbar is the focus.
 *   ambient      the front layer drifts a pixel or two. A whole blank page.
 *   interactive  ambient, plus the layers lean toward the pointer.
 * `prefers-reduced-motion` turns all of it off in the stylesheet, so a figure is
 * then exactly its static drawing. Figures are decorative: `aria-hidden`, with
 * the title and description beside them carrying the meaning.
 */
export const FigureProvenance = provenance({
  source: 'custom',
  reason:
    'ReUI has no line-drawing illustrations; icon-stack is a single abstract layered glyph and cannot say "no results" differently from "no events".',
  note: 'Hairline-style SVG figures for empty and error states. CSS-only motion.',
})

export const FIGURE_NAMES = [
  'drawer',
  'loupe',
  'sieve',
  'plot',
  'plug',
  'rail',
  'padlock',
  'ledger',
  'signal',
  'stack',
  'people',
  'fault',
] as const

export type FigureName = (typeof FIGURE_NAMES)[number]
export type FigureMotion = 'static' | 'ambient' | 'interactive'

type Layers = { back: ReactNode; mid: ReactNode; front: ReactNode }

/**
 * Every drawing lives in a 160 × 120 box. Strokes are 1.25px and do not scale
 * with the figure, so a small one is as fine as a large one.
 */
const DRAWINGS: Record<FigureName, Layers> = {
  // Nothing here yet: an open drawer with an empty, dashed interior.
  drawer: {
    back: <path d="M34 92h92M44 100h72" opacity=".35" />,
    mid: (
      <>
        <path d="M40 46h80v40H40zM40 46l10-12h60l10 12" />
        <path d="M50 34v12M110 34v12" opacity=".5" />
      </>
    ),
    front: (
      <>
        <path d="M48 62h64v22H48z" strokeDasharray="3 3" opacity=".6" />
        <path d="M70 72h20" />
      </>
    ),
  },
  // Searched, nothing matched.
  loupe: {
    back: (
      <path
        d="M28 40h30M28 52h22M28 64h34M104 84h28M112 96h20"
        opacity=".3"
        strokeDasharray="2 4"
      />
    ),
    mid: <circle cx="76" cy="54" r="24" />,
    front: (
      <>
        <path d="M94 72l22 22" strokeWidth="2" />
        <path d="M66 54h20" opacity=".6" />
      </>
    ),
  },
  // Filters narrowed it to nothing.
  sieve: {
    back: <path d="M48 98h64" opacity=".35" />,
    mid: (
      <>
        <path d="M34 30h92l-34 34v26l-24 10V64z" />
        <path d="M44 38h72" opacity=".5" />
      </>
    ),
    front: (
      <>
        <circle cx="64" cy="18" r="2.5" />
        <circle cx="82" cy="12" r="2.5" opacity=".6" />
        <circle cx="98" cy="20" r="2.5" opacity=".8" />
      </>
    ),
  },
  // A chart with no points to plot.
  plot: {
    back: <path d="M36 40h92M36 62h92M36 84h92" opacity=".22" />,
    mid: <path d="M36 28v66h96" />,
    front: (
      <>
        <path d="M44 78c14-4 22-18 36-16s22 10 40-6" strokeDasharray="2 4" opacity=".7" />
        <circle cx="120" cy="56" r="3" />
      </>
    ),
  },
  // Something to connect, not connected yet.
  plug: {
    back: <path d="M20 60h26M114 60h26" opacity=".4" />,
    mid: (
      <>
        <path d="M46 44h22a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H46z" />
        <path d="M74 54h-8M74 66h-8" />
      </>
    ),
    front: (
      <>
        <path d="M114 44H98a6 6 0 0 0-6 6v20a6 6 0 0 0 6 6h16z" />
        <path d="M92 54h10M92 66h10" opacity=".6" />
      </>
    ),
  },
  // A timeline with nothing on it yet.
  rail: {
    back: <path d="M52 18v84" opacity=".4" strokeDasharray="3 4" />,
    mid: (
      <>
        <circle cx="52" cy="32" r="5" />
        <circle cx="52" cy="60" r="5" opacity=".7" />
        <circle cx="52" cy="88" r="5" opacity=".4" />
      </>
    ),
    front: <path d="M70 32h50M70 60h38M70 88h28" opacity=".55" />,
  },
  // Not allowed in.
  padlock: {
    back: <path d="M40 100h80" opacity=".3" />,
    mid: <path d="M50 54h60v42H50z" />,
    front: (
      <>
        <path d="M62 54V40a18 18 0 0 1 36 0v14" />
        <circle cx="80" cy="72" r="4" />
        <path d="M80 76v8" />
      </>
    ),
  },
  // Invoices, payments, credits: a sheet with lines.
  ledger: {
    back: <path d="M52 26h56v72H52z" opacity=".3" transform="translate(8 -6)" />,
    mid: (
      <>
        <path d="M46 22h50l14 14v62H46z" />
        <path d="M96 22v14h14" opacity=".6" />
      </>
    ),
    front: <path d="M58 54h40M58 66h40M58 78h24" opacity=".6" />,
  },
  // Usage events: waiting for the first one to arrive.
  signal: {
    back: <path d="M20 96h120" opacity=".3" />,
    mid: (
      <>
        <circle cx="80" cy="80" r="4" />
        <path d="M62 64a26 26 0 0 1 36 0" opacity=".9" />
      </>
    ),
    front: (
      <>
        <path d="M50 52a42 42 0 0 1 60 0" opacity=".55" />
        <path d="M38 40a60 60 0 0 1 84 0" opacity=".3" strokeDasharray="2 4" />
      </>
    ),
  },
  // Plans, features, charges: layered sheets.
  stack: {
    back: <path d="M40 72l40 18 40-18" opacity=".35" />,
    mid: <path d="M40 58l40 18 40-18" opacity=".7" />,
    front: <path d="M80 22L40 40l40 18 40-18z" />,
  },
  // Customers.
  people: {
    back: (
      <>
        <circle cx="108" cy="46" r="11" opacity=".4" />
        <path d="M90 94c2-16 10-24 18-24s16 8 18 24" opacity=".4" />
      </>
    ),
    mid: <circle cx="66" cy="44" r="13" />,
    front: <path d="M42 98c2-20 12-30 24-30s22 10 24 30z" />,
  },
  // Something went wrong.
  fault: {
    back: <path d="M30 100h100" opacity=".3" />,
    mid: <path d="M80 26L124 98H36z" />,
    front: (
      <>
        <path d="M80 54v22" strokeWidth="2" />
        <circle cx="80" cy="86" r="1.5" />
      </>
    ),
  },
}

export interface FigureProps {
  name: FigureName
  motion?: FigureMotion
  className?: string
}

/** A decorative line drawing. See the file comment for the three motion levels. */
export function Figure({ name, motion = 'ambient', className }: FigureProps) {
  const ref = useRef<HTMLDivElement>(null)
  const drawing = DRAWINGS[name]

  // Written straight to the element: a re-render per pointer move would be
  // the cost of a decoration.
  const lean = (event: PointerEvent<HTMLDivElement>) => {
    const node = ref.current
    if (!node) return
    const box = node.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width - 0.5
    const y = (event.clientY - box.top) / box.height - 0.5
    node.style.setProperty('--fx', (x * 2).toFixed(3))
    node.style.setProperty('--fy', (y * 2).toFixed(3))
  }
  const settle = () => {
    ref.current?.style.setProperty('--fx', '0')
    ref.current?.style.setProperty('--fy', '0')
  }

  return (
    <div
      ref={ref}
      aria-hidden
      data-figure={name}
      data-motion={motion}
      onPointerMove={motion === 'interactive' ? lean : undefined}
      onPointerLeave={motion === 'interactive' ? settle : undefined}
      style={{ '--fx': 0, '--fy': 0 } as CSSProperties}
      className={cn('fp-figure text-muted-foreground w-40 shrink-0', className)}
    >
      <svg viewBox="0 0 160 120" fill="none" className="h-auto w-full overflow-visible">
        <g
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="[&_*]:[vector-effect:non-scaling-stroke]"
        >
          <g className="fp-figure-layer" data-depth="back">
            {drawing.back}
          </g>
          <g className="fp-figure-layer" data-depth="mid">
            {drawing.mid}
          </g>
          <g className="fp-figure-layer text-foreground/80" data-depth="front">
            {drawing.front}
          </g>
        </g>
      </svg>
    </div>
  )
}

import { useLayoutEffect, useRef, type ComponentType } from 'react'
import {
  Exploded,
  Loupe,
  Padlock,
  Phosphor,
  Plot,
  Riffle,
  Settle,
  Slow,
  Terminal,
  type HairlineProps,
} from '@lucasmarkes/hairline/react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The picture on a page that has nothing on it yet, chosen by where in the
 * product the reader is rather than by what is missing.
 *
 * These are the figures of @lucasmarkes/hairline (MIT): isometric line drawings
 * that answer the pointer. They sit beside the smaller `Figure` set, which keeps
 * the inline, error and per-record states; a first-run page is the one place a
 * larger, livelier drawing earns its room.
 *
 *   table       Riffle     a tray of cards: any list of records
 *   contracts   Riffle     contracts and everything inside them
 *   customers   Phosphor   customers and every tab of a customer
 *   catalog     Slow       products, plans, add-ons and pricing widgets
 *   billing     Loupe      invoices and credit memos
 *   payments    Settle     payments and collections
 *   revenue     Plot       the revenue dashboard
 *   developers  Terminal   events, webhooks, exports, workflows, syncs
 *   settings    Padlock    configuration that has not been set up
 *   home        Exploded   the dashboard before anything is connected
 *
 * Decorative, like every figure here: the wrapper is `aria-hidden` and the
 * figure's own tab stop is removed, so the drawing adds nothing to the reading
 * order and the title and description beside it carry the meaning. The package
 * mounts one empty `<div>` and draws into it, so server output is only the box.
 */
export const SceneIllustrationProvenance = provenance({
  source: 'custom',
  reason:
    'ReUI has no line-drawing illustrations; the per-product figures come from the hairline package, themed here with Flexprice tokens.',
  note: '@lucasmarkes/hairline figures for first-run pages, one per area of the product.',
})

export const EMPTY_SCENES = [
  'table',
  'contracts',
  'customers',
  'catalog',
  'billing',
  'payments',
  'revenue',
  'developers',
  'settings',
  'home',
] as const
export type EmptyScene = (typeof EMPTY_SCENES)[number]

const SCENES: Record<EmptyScene, ComponentType<HairlineProps>> = {
  table: Riffle,
  contracts: Riffle,
  customers: Phosphor,
  catalog: Slow,
  billing: Loupe,
  payments: Settle,
  revenue: Plot,
  developers: Terminal,
  settings: Padlock,
  home: Exploded,
}

/**
 * The package's six colour properties, mapped to the app's tokens so a figure
 * is as quiet as the text around it in both themes (the same mapping the
 * hairline shadcn registry item uses).
 */
const TOKENS =
  '[--hairline-plate:var(--background)] [--hairline-hi:var(--foreground)] [--hairline-edge:var(--muted-foreground)] [--hairline-mid:color-mix(in_oklab,var(--muted-foreground)_55%,var(--background))] [--hairline-lo:var(--border)]'

const SIZES = { sm: 'w-48', md: 'w-64', lg: 'w-80' } as const

export interface SceneIllustrationProps {
  scene: EmptyScene
  size?: keyof typeof SIZES
  /** Walks the figure through its answer on its own until the pointer arrives. */
  play?: boolean
  className?: string
}

export function SceneIllustration({
  scene,
  size = 'md',
  play = false,
  className,
}: SceneIllustrationProps) {
  const Figure = SCENES[scene]
  const box = useRef<HTMLDivElement>(null)

  // The interactive figures take a tab stop for their arrow keys. This one is
  // decoration, so it must not hold focus in a hidden subtree.
  useLayoutEffect(() => {
    box.current?.querySelectorAll('[tabindex]').forEach((node) => {
      node.setAttribute('tabindex', '-1')
    })
  }, [scene])

  return (
    <div
      ref={box}
      aria-hidden
      data-scene={scene}
      className={cn('shrink-0', SIZES[size], TOKENS, className)}
    >
      <Figure play={play} />
    </div>
  )
}

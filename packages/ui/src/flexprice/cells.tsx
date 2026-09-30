import { useRef, useState, type ReactNode } from 'react'
import { BracesIcon, PencilIcon, GaugeIcon, HashIcon, ToggleRightIcon } from 'lucide-react'
import type { CircleIcon } from 'lucide-react'
import { type Money as MoneyValue, formatMoney } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Input } from '@ui/primitives/input'
import { Skeleton } from '@ui/primitives/skeleton'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Money } from './Money'

/**
 * The cells every list table is built from.
 *
 * `EntityList` takes a plain array of `EntityColumn`s, and this is where those
 * come from. A list page should never hand-write a `<span className="block
 * truncate tabular-nums">`: it says `dateColumn('createdAt', 'Created', …)` and
 * gets the one agreed treatment — the same truncation, the same em dash for
 * absent values, the same tabular figures for anything numeric.
 *
 * That is the whole point of putting them here rather than in each grid. With
 * twelve grids each writing their own cells, "muted" drifted to four different
 * opacities and three of the twelve forgot `truncate`, which is how a ULID
 * ended up painted over the column beside it. A helper cannot forget.
 *
 * Two rules the helpers enforce, because they were the two most often broken:
 *
 *   **Everything is left-aligned, amounts included.** A right-aligned money
 *   column only pays off when you are summing a column by eye, which nobody
 *   does in a list of invoices; what it actually does is put the amount an
 *   arm's length from the row it belongs to. Numbers get `tabular-nums` so the
 *   digits still line up.
 *
 *   **Medium is the heaviest weight.** Nothing here is bold. In a table, weight
 *   is the strongest signal there is, and a bold name column spends it on the
 *   thing you were already looking at.
 */
export const CellsProvenance = provenance({
  source: 'composition',
  composes: ['@reui/badge'],
  note: 'Column helpers and pills for EntityList. Left-aligned, truncating, medium at most.',
})

/* ------------------------------------------------------------------ *
 * The column contract
 * ------------------------------------------------------------------ */

/**
 * One column of a list table.
 *
 * Deliberately not a TanStack `ColumnDef`. `EntityList` builds those, and a
 * caller that hands over a `ColumnDef` can reach past every layout decision
 * the shared table exists to make — the padding, the truncation, the header
 * type — which is how twelve grids stopped looking alike in the first place.
 * This carries what a list actually varies: what the column is called, what to
 * draw, how wide it wants to be, and whether it sorts.
 */
export interface EntityColumn<T> {
  /** Stable within the table. Used for visibility, pinning and CSV headers. */
  id: string
  /** The header label. Rendered uppercase; write it in sentence case. */
  header: string
  /** The cell. */
  cell: (row: T) => ReactNode
  /**
   * The same value as plain text, for CSV export.
   *
   * Without it a column exports empty, because a `ReactNode` is not a string
   * and guessing at one by walking the tree gets "—" and screen-reader-only
   * text into the file. Every helper here supplies it.
   */
  text?: ((row: T) => string) | undefined
  /**
   * The width this column would like, in px.
   *
   * A *preference*, not a promise: `EntityList` scales every non-`fixed`
   * column so the set fills the page. Treat it as the column's share.
   */
  width?: number | undefined
  /**
   * Never scaled — the column is this many pixels and no other.
   *
   * For the checkbox and the `⋯` menu, whose contents do not get more readable
   * with more room.
   */
  fixed?: boolean | undefined
  /** Clicking the header sorts by `sortValue`. */
  sortable?: boolean | undefined
  /** What a header click reports. Defaults to `id`. */
  sortValue?: string | undefined
  /** Shown in place of the cell while loading. Defaults to a text-width bar. */
  skeleton?: ReactNode | undefined
  /** Offered in the `⋯` column menu. Default true. */
  hideable?: boolean | undefined
  /** Starts hidden, and can be switched on from the `⋯` menu. */
  hiddenByDefault?: boolean | undefined
  /** Extra classes on the `<td>`. Layout only — the helpers own the type. */
  cellClassName?: string | undefined
}

/* ------------------------------------------------------------------ *
 * Pills
 * ------------------------------------------------------------------ */

/**
 * The tones a pill can carry, as tokens.
 *
 * Not a colour, and not a class — a *meaning*. A caller that wants a red pill
 * has to decide the thing is a failure, which is the decision that should be
 * reviewed. The mapping to tokens lives here so the whole console's greens are
 * one green.
 */
export type PillTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'

/** The dot only. Tone is carried by a 6px dot, never by the pill's fill. */
const DOT_TONE: Record<PillTone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-destructive',
}

export interface PillProps {
  tone?: PillTone
  /** Replaces the dot — a feature type's glyph, say. */
  icon?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * A status, as a 24px pill with a dot.
 *
 * The dot rather than a tinted fill: at eighteen rows a column of coloured
 * fills is a traffic light with every bulb lit, which carries exactly as much
 * information as none of them being lit. A neutral pill with one amber dot in
 * it can be found without reading.
 *
 * The label is always spelled out beside the dot, so the tone is never the
 * only thing saying what the status is.
 */
export function Pill({ tone = 'neutral', icon, children, className }: PillProps) {
  return (
    <Badge
      variant="outline"
      radius="full"
      // `xl` is the 24px step. The type is stepped back down to the table's
      // own size — the badge's own `text-sm` reads as a heading in a 13px row.
      size="xl"
      className={cn(
        'border-border/60 gap-1.5 bg-transparent px-2.5 text-xs font-medium whitespace-nowrap text-foreground dark:bg-transparent',
        className,
      )}
    >
      {icon ?? <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT_TONE[tone])} />}
      {children}
    </Badge>
  )
}

/**
 * The feature types, as their agreed glyphs.
 *
 * Gauge for metered (something is being measured), a toggle for boolean (it is
 * on or it is off), a hash for static (it is a quantity). `config` is not in
 * the design's list of three but exists in the domain, so it gets braces
 * rather than falling through to a blank cell.
 */
export const FEATURE_TYPE_GLYPH = {
  metered: GaugeIcon,
  boolean: ToggleRightIcon,
  static: HashIcon,
  config: BracesIcon,
} as const satisfies Record<string, typeof CircleIcon>

export interface FeatureTypePillProps {
  type: keyof typeof FEATURE_TYPE_GLYPH
  label: string
}

/** A feature type: its glyph, and the type spelled out. */
export function FeatureTypePill({ type, label }: FeatureTypePillProps) {
  const Icon = FEATURE_TYPE_GLYPH[type]
  return (
    <Pill icon={<Icon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />}>
      {label}
    </Pill>
  )
}

/** Nothing here — said out loud, rather than left blank. A blank cell reads as
 *  a value that failed to load. */
export function EmDash() {
  return <span className="text-muted-foreground">—</span>
}

/* ------------------------------------------------------------------ *
 * Column helpers
 * ------------------------------------------------------------------ */

/** What every helper accepts on top of its own arguments. */
export interface ColumnOptions {
  width?: number | undefined
  sortable?: boolean | undefined
  sortValue?: string | undefined
  hideable?: boolean | undefined
  hiddenByDefault?: boolean | undefined
}

/** Only the keys that were actually given, so `exactOptionalPropertyTypes`
 *  does not see an explicit `undefined` where the field is optional. The
 *  return type is `ColumnOptions` and not `Partial<EntityColumn>` on purpose —
 *  the latter carries `cell` and `text`, whose row type would then collapse
 *  against the caller's `T`. */
function spreadOptions(options: ColumnOptions | undefined): ColumnOptions {
  if (!options) return {}
  return {
    ...(options.width === undefined ? {} : { width: options.width }),
    ...(options.sortable === undefined ? {} : { sortable: options.sortable }),
    ...(options.sortValue === undefined ? {} : { sortValue: options.sortValue }),
    ...(options.hideable === undefined ? {} : { hideable: options.hideable }),
    ...(options.hiddenByDefault === undefined
      ? {}
      : { hiddenByDefault: options.hiddenByDefault }),
  }
}


/**
 * A table cell that edits in place.
 *
 * Reading shows the text with a pencil that appears on hover or focus; a click
 * on either swaps in a stock `Input`. Enter or blur saves, Escape cancels. An
 * unchanged or empty value saves nothing. Clicks are stopped from reaching the
 * row, so editing never navigates.
 */
function InlineTextCell({
  value,
  label,
  muted,
  onSave,
}: {
  value: string
  label: string
  muted?: boolean | undefined
  onSave: (value: string) => void | Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [pending, setPending] = useState(false)
  const cancelled = useRef(false)

  const commit = async () => {
    const next = draft.trim()
    setEditing(false)
    if (cancelled.current || !next || next === value) return
    setPending(true)
    try {
      await onSave(next)
    } finally {
      setPending(false)
    }
  }

  if (editing) {
    return (
      <Input
        autoFocus
        aria-label={label}
        value={draft}
        className="h-8"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          } else if (event.key === 'Escape') {
            cancelled.current = true
            event.currentTarget.blur()
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      aria-label={`${label}: ${value || 'not set'}. Edit`}
      disabled={pending}
      title="Click to edit"
      className="group/inline flex w-full min-w-0 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
      onClick={(event) => {
        event.stopPropagation()
        cancelled.current = false
        setDraft(value)
        setEditing(true)
      }}
    >
      <span className={cn('truncate', muted && 'text-muted-foreground')}>{value || <EmDash />}</span>
      <PencilIcon
        aria-hidden
        className="text-muted-foreground size-3 shrink-0 opacity-0 group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100"
      />
    </button>
  )
}

/**
 * Text, on one line, clipped rather than wrapped.
 *
 * The `title` is the half people forget: a clipped cell with no tooltip has
 * simply lost the data. An empty string renders the em dash, because "" and
 * "not set" look identical in a table and only one of them is true.
 */
export function textColumn<T>(
  id: string,
  header: string,
  get: (row: T) => string | null | undefined,
  options?: ColumnOptions & {
    muted?: boolean
    /** Makes the cell click-to-edit; saved by the caller's mutation. */
    onEdit?: ((row: T, value: string) => void | Promise<void>) | undefined
  },
): EntityColumn<T> {
  const onEdit = options?.onEdit
  return {
    id,
    header,
    cell: (row) => {
      const value = get(row)
      if (onEdit) {
        return (
          <InlineTextCell
            key={value ?? ''}
            value={value ?? ''}
            label={header}
            muted={options?.muted}
            onSave={(next) => onEdit(row, next)}
          />
        )
      }
      if (!value) return <EmDash />
      return (
        <span
          title={value}
          className={cn('block truncate', options?.muted && 'text-muted-foreground')}
        >
          {value}
        </span>
      )
    },
    text: (row) => get(row) ?? '',
    width: 200,
    skeleton: <Skeleton className="h-4 w-32" />,
    ...spreadOptions(options),
  }
}

/**
 * An identifier — a lookup key, a ULID.
 *
 * Monospaced and clipped with a tooltip. This is the column the truncation
 * rule was written for: an un-clipped 26-character ULID painted straight over
 * the cell beside it and made two columns unreadable instead of one.
 */
export function idColumn<T>(
  id: string,
  header: string,
  get: (row: T) => string | null | undefined,
  options?: ColumnOptions,
): EntityColumn<T> {
  return {
    ...textColumn<T>(id, header, get, options),
    cell: (row) => {
      const value = get(row)
      if (!value) return <EmDash />
      return (
        <span title={value} className="text-muted-foreground block truncate font-mono text-xs">
          {value}
        </span>
      )
    },
    width: 180,
    skeleton: <Skeleton className="h-4 w-28" />,
    ...spreadOptions(options),
  }
}

/** A date, as the reader's locale writes it. Muted: it is metadata, not the
 *  reason anyone opened the page. */
export function dateColumn<T>(
  id: string,
  header: string,
  get: (row: T) => Date | null | undefined,
  options?: ColumnOptions & { locale?: string | undefined; dateStyle?: 'short' | 'medium' },
): EntityColumn<T> {
  const format = (value: Date) =>
    new Intl.DateTimeFormat(options?.locale, { dateStyle: options?.dateStyle ?? 'medium' }).format(
      value,
    )
  return {
    id,
    header,
    cell: (row) => {
      const value = get(row)
      if (!value) return <EmDash />
      return <span className="text-muted-foreground block truncate tabular-nums">{format(value)}</span>
    },
    text: (row) => {
      const value = get(row)
      return value ? format(value) : ''
    },
    width: 140,
    skeleton: <Skeleton className="h-4 w-24" />,
    ...spreadOptions(options),
  }
}

/**
 * An amount — left-aligned like everything else, with tabular figures.
 *
 * `truncate` is always on. A column of amounts is exactly where an overlong
 * value does the most damage, and `Money` keeps the full figure in its
 * `title` and available to a screen reader when it clips.
 */
export function moneyColumn<T>(
  id: string,
  header: string,
  get: (row: T) => MoneyValue | null | undefined,
  options?: ColumnOptions & { locale?: string | undefined; muteZero?: boolean },
): EntityColumn<T> {
  return {
    id,
    header,
    cell: (row) => {
      const value = get(row)
      if (!value) return <EmDash />
      return (
        <Money
          value={value}
          truncate
          {...(options?.locale ? { locale: options.locale } : {})}
          {...(options?.muteZero ? { muteZero: true } : {})}
        />
      )
    },
    text: (row) => {
      const value = get(row)
      return value ? formatMoney(value, options?.locale) : ''
    },
    width: 140,
    skeleton: <Skeleton className="h-4 w-20" />,
    ...spreadOptions(options),
  }
}

/** A plain number — a count, a quantity. Tabular, so a column of them scans. */
export function numberColumn<T>(
  id: string,
  header: string,
  get: (row: T) => number | null | undefined,
  options?: ColumnOptions & { locale?: string | undefined },
): EntityColumn<T> {
  const format = (value: number) => new Intl.NumberFormat(options?.locale).format(value)
  return {
    id,
    header,
    cell: (row) => {
      const value = get(row)
      if (value === null || value === undefined) return <EmDash />
      return <span className="block truncate tabular-nums">{format(value)}</span>
    },
    text: (row) => {
      const value = get(row)
      return value === null || value === undefined ? '' : format(value)
    },
    width: 120,
    skeleton: <Skeleton className="h-4 w-16" />,
    ...spreadOptions(options),
  }
}

/** What a pill column draws for one row. `null` renders the em dash. */
export interface PillSpec {
  label: string
  tone?: PillTone
  icon?: ReactNode
}

/** A status, a type, a lifecycle — anything that is one of a small set. */
export function pillColumn<T>(
  id: string,
  header: string,
  get: (row: T) => PillSpec | null | undefined,
  options?: ColumnOptions,
): EntityColumn<T> {
  return {
    id,
    header,
    cell: (row) => {
      const spec = get(row)
      if (!spec) return <EmDash />
      return (
        <Pill
          {...(spec.tone ? { tone: spec.tone } : {})}
          {...(spec.icon ? { icon: spec.icon } : {})}
        >
          {spec.label}
        </Pill>
      )
    },
    text: (row) => get(row)?.label ?? '',
    width: 150,
    skeleton: <Skeleton className="h-6 w-24 rounded-full" />,
    ...spreadOptions(options),
  }
}

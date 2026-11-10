import { useRef, useState, type ReactNode } from 'react'
import { BracesIcon, PencilIcon, GaugeIcon, HashIcon, ToggleRightIcon } from '@ui/icons'
import type { CircleIcon } from '@ui/icons'
import { type Money as MoneyValue, formatMoney } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { usePillSize } from '../../compositions/detail/pillSize'
import { formatStoredDay } from '../../compositions/forms/DateInput'
import { Money } from './Money'
import { statusTone } from './statusTones'

/**
 * The cells every list table is built from.
 *
 * `EntityList` takes a plain array of `EntityColumn`s, and this is where those
 * come from. A list page should never hand-write a `<span className="block
 * truncate tabular-nums">`: it says `dateColumn('createdAt', 'Created', …)` and
 * gets the one agreed treatment: the same truncation, the same em dash for
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
 *   digits still line up. The one exception is `align: 'center'`, for a narrow
 *   column that is nothing but a count: see the prop.
 *
 *   **Medium is the heaviest weight.** Nothing here is bold. In a table, weight
 *   is the strongest signal there is, and a bold name column spends it on the
 *   thing you were already looking at.
 */
export const CellsProvenance = provenance({
  source: 'composition',
  composes: [],
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
 * the shared table exists to make: the padding, the truncation, the header
 * type: which is how twelve grids stopped looking alike in the first place.
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
   * Never scaled: the column is this many pixels and no other.
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
  /** Extra classes on the `<td>`. Layout only: the helpers own the type. */
  cellClassName?: string | undefined
  /**
   * `center` centres the header and the cell. Left is the default and the
   * rule; see the note at the top of this file for why amounts stay left.
   *
   * The exception is a narrow column of counts: Charges, Entitlements,
   * Credit grants, Contracts on the catalogue lists. There the number *is*
   * the column: there is no label beside it for the eye to start from, so
   * left-aligning a one or two digit figure under a wider header leaves it
   * adrift. The redesign asks for these centred and it is right about them.
   */
  /**
   * `end` right-aligns header and cell: only for a document-shaped table, such
   * as an invoice preview, that must read like the invoice it previews.
   */
  align?: 'start' | 'center' | 'end' | undefined
}

/* ------------------------------------------------------------------ *
 * Pills
 * ------------------------------------------------------------------ */

/**
 * The tones a pill can carry, as tokens.
 *
 * Not a colour, and not a class: a *meaning*. A caller that wants a red pill
 * has to decide the thing is a failure, which is the decision that should be
 * reviewed. The mapping to tokens lives here so the whole console's greens are
 * one green.
 */
export type PillTone = 'neutral' | 'success' | 'info' | 'trial' | 'warning' | 'danger'

/** The dot: tone is carried by a 6px dot, in semantic tokens. */
const DOT_TONE: Record<PillTone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  info: 'bg-info',
  trial: 'bg-trial',
  warning: 'bg-warning',
  danger: 'bg-destructive',
}

export interface PillProps {
  tone?: PillTone
  /** `sm` is the quieter chip that sits beside a name; `default` is the column pill. */
  size?: 'default' | 'sm'
  /** Replaces the dot: a feature type's glyph, say. */
  icon?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * A status, as a bordered pill with a coloured dot: the one status language for
 * the whole product.
 *
 * The dot rather than a tinted fill: at eighteen rows a column of coloured
 * fills is a traffic light with every bulb lit. A neutral pill with one amber
 * dot in it can be found without reading. The label is always spelled out beside
 * the dot, so the tone is never the only thing saying what the status is.
 */
export function Pill({ tone = 'neutral', size, icon, children, className }: PillProps) {
  const inherited = usePillSize()
  size ??= inherited
  // A long label (a plan key, an imported status) truncates inside a capped
  // pill instead of pushing its column wider; the full text is the tooltip.
  const label =
    typeof children === 'string' || typeof children === 'number' ? String(children) : undefined
  return (
    <span
      {...(label ? { title: label } : {})}
      className={cn(
        'border-border bg-background text-foreground inline-flex max-w-64 min-w-0 items-center rounded-full border font-medium whitespace-nowrap shadow-[0_1px_1px_rgba(0,0,0,0.03)] [&_svg]:size-3 [&_svg]:opacity-60',
        size === 'sm' ? 'h-5 gap-1 px-2 text-[11px]' : 'h-6 gap-1.5 px-2.5 text-xs',
        className,
      )}
    >
      {icon ?? (
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT_TONE[tone])} />
      )}
      {label ? <span className="min-w-0 truncate">{children}</span> : children}
    </span>
  )
}

/** A status word as a dot pill; the tone is looked up from the word. */
export function Status({ value }: { value: string }) {
  const tone = statusTone(value)
  return (
    <Pill tone={tone}>
      <span className="capitalize">{value.replace(/_/g, ' ')}</span>
    </Pill>
  )
}

/** Neutral pill for categories such as a feature type or gateway. */
export function Tag({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return <Pill {...(icon ? { icon } : {})}>{children}</Pill>
}

/** A meter's aggregation as a formula chip: an italic "fx" and the expression in mono. */
export function Formula({ value }: { value: string | null }) {
  if (!value) return <EmDash />
  return (
    <span className="bg-muted/60 text-foreground/80 inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-md border px-1.5 font-mono text-xs">
      <span className="text-muted-foreground font-sans italic">fx</span>
      <span title={value} className="min-w-0 truncate">
        {value}
      </span>
    </span>
  )
}

/**
 * The type of a list's name column: a step above the table's 14px body, medium
 * weight. The name is the column a row is found by, so it reads first; the
 * chips and metadata beside it stay at `text-xs` and below. 15px is the
 * redesign's agreed name size (2026-10 product-catalog pass), not an ad-hoc one.
 */
const NAME_TEXT = 'text-foreground text-[15px] font-medium'

/**
 * The name cell: the row's name, truncating, with an optional sub-label: a
 * small chip or muted text: that never outweighs it.
 */
export function EntityCell({ name, sub }: { name: string; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span title={name} className={cn('min-w-0 truncate', NAME_TEXT)}>
        {name}
      </span>
      {sub ? (
        <span className="text-muted-foreground flex shrink-0 items-center text-xs">{sub}</span>
      ) : null}
    </div>
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

/** The glyph colours: metered orange, boolean blue, static and config quiet grey. */
const FEATURE_TYPE_COLOR = {
  metered: 'text-feature-metered',
  boolean: 'text-feature-boolean',
  static: 'text-muted-foreground',
  config: 'text-muted-foreground',
} as const satisfies Record<keyof typeof FEATURE_TYPE_GLYPH, string>

export interface FeatureTypeGlyphProps {
  type: keyof typeof FEATURE_TYPE_GLYPH
  className?: string
}

/** Just the coloured glyph of a feature type, for a pill or the end of a dropdown option. */
export function FeatureTypeGlyph({ type, className }: FeatureTypeGlyphProps) {
  const Icon = FEATURE_TYPE_GLYPH[type]
  return (
    <Icon
      aria-hidden
      className={cn('size-3.5 shrink-0 opacity-100!', FEATURE_TYPE_COLOR[type], className)}
    />
  )
}

export interface FeatureTypePillProps {
  type: keyof typeof FEATURE_TYPE_GLYPH
  label: string
}

/** A feature type: its coloured glyph, and the type spelled out. */
export function FeatureTypePill({ type, label }: FeatureTypePillProps) {
  return (
    <Pill size="sm" icon={<FeatureTypeGlyph type={type} className="size-3" />}>
      {label}
    </Pill>
  )
}

/** Nothing here: said out loud, rather than left blank. A blank cell reads as
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
 *  return type is `ColumnOptions` and not `Partial<EntityColumn>` on purpose:
 *  the latter carries `cell` and `text`, whose row type would then collapse
 *  against the caller's `T`. */
function spreadOptions(options: ColumnOptions | undefined): ColumnOptions {
  if (!options) return {}
  return {
    ...(options.width === undefined ? {} : { width: options.width }),
    ...(options.sortable === undefined ? {} : { sortable: options.sortable }),
    ...(options.sortValue === undefined ? {} : { sortValue: options.sortValue }),
    ...(options.hideable === undefined ? {} : { hideable: options.hideable }),
    ...(options.hiddenByDefault === undefined ? {} : { hiddenByDefault: options.hiddenByDefault }),
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
  primary,
  onSave,
}: {
  value: string
  label: string
  muted?: boolean | undefined
  primary?: boolean | undefined
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
      className="group/inline focus-visible:ring-ring/50 flex w-full min-w-0 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 disabled:opacity-60"
      onClick={(event) => {
        event.stopPropagation()
        cancelled.current = false
        setDraft(value)
        setEditing(true)
      }}
    >
      <span className={cn('truncate', primary && NAME_TEXT, muted && 'text-muted-foreground')}>
        {value || <EmDash />}
      </span>
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
/** A cell value that opens the entity it names, without firing the row's own click. */
export function EntityLink({
  label,
  onOpen,
  muted,
  primary,
  wrap = false,
}: {
  label: string
  onOpen: () => void
  muted?: boolean | undefined
  /** Set in a list's name column: the name type rather than body text. */
  primary?: boolean | undefined
  /** Allow relationship labels to wrap within compact layouts. */
  wrap?: boolean | undefined
}) {
  return (
    <button
      type="button"
      title={label}
      className={cn(
        'block max-w-full min-w-0 text-left underline-offset-4 hover:underline focus-visible:underline',
        wrap ? 'wrap-anywhere whitespace-normal' : 'truncate',
        primary && NAME_TEXT,
        muted && 'text-muted-foreground',
      )}
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
    >
      {label}
    </button>
  )
}

export function textColumn<T>(
  id: string,
  header: string,
  get: (row: T) => string | null | undefined,
  options?: ColumnOptions & {
    muted?: boolean
    /** Makes the cell click-to-edit; saved by the caller's mutation. */
    onEdit?: ((row: T, value: string) => void | Promise<void>) | undefined
    /** Renders the value as a link to the entity it names; the row click is not fired. */
    onOpen?: ((row: T) => void) | undefined
    /**
     * Draw the value as the row's name (`EntityCell` type: larger, medium).
     * Defaults to true for a column whose id is `name`, so every list's Name
     * column gets the same treatment without each grid opting in.
     */
    primary?: boolean | undefined
    /**
     * What an empty value means for this row, drawn muted in place of the
     * dash (e.g. a draft invoice's number: "To be generated"). Null keeps the dash.
     */
    placeholder?: ((row: T) => string | null) | undefined
  },
): EntityColumn<T> {
  const onEdit = options?.onEdit
  const onOpen = options?.onOpen
  const primary = options?.primary ?? id === 'name'
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
            primary={primary}
            onSave={(next) => onEdit(row, next)}
          />
        )
      }
      if (!value?.trim()) {
        const placeholder = options?.placeholder?.(row)
        return placeholder ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <EmDash />
        )
      }
      if (onOpen) {
        return (
          <EntityLink
            label={value}
            muted={options?.muted}
            primary={primary}
            onOpen={() => onOpen(row)}
          />
        )
      }
      if (primary && !options?.muted) return <EntityCell name={value} />
      return (
        <span
          title={value}
          className={cn('block min-w-0 truncate', options?.muted && 'text-muted-foreground')}
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
 * An identifier: a lookup key, a ULID.
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
      if (!value?.trim()) return <EmDash />
      return (
        <span
          title={value}
          className="text-muted-foreground block min-w-0 truncate font-mono text-xs"
        >
          {value}
        </span>
      )
    },
    width: 180,
    skeleton: <Skeleton className="h-4 w-28" />,
    ...spreadOptions(options),
  }
}

/**
 * A moment in full, for hovering a date that shows only its day: date, time
 * and the zone it is read in ("Nov 10, 2026, 6:30:00 PM GMT+5:30"), so a day
 * that looks wrong can be checked against the instant behind it.
 */
export function formatFullDateTime(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'long' }).format(value)
}

/** A date, as the reader's locale writes it. Muted: it is metadata, not the
 *  reason anyone opened the page. `storedDay` reads a day field (saved as a
 *  UTC day) on its own day, in every zone; see `formatStoredDay`. */
export function dateColumn<T>(
  id: string,
  header: string,
  get: (row: T) => Date | null | undefined,
  options?: ColumnOptions & {
    locale?: string | undefined
    dateStyle?: 'short' | 'medium'
    storedDay?: boolean
    /** Name the day in this zone (e.g. `'UTC'`) rather than the reader's. */
    timeZone?: string
  },
): EntityColumn<T> {
  const format = (value: Date) =>
    options?.storedDay
      ? formatStoredDay(value, {
          locale: options.locale,
          ...(options.dateStyle ? { dateStyle: options.dateStyle } : {}),
        })
      : new Intl.DateTimeFormat(options?.locale, {
          dateStyle: options?.dateStyle ?? 'medium',
          ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
        }).format(value)
  return {
    id,
    header,
    cell: (row) => {
      const value = get(row)
      if (!value || Number.isNaN(value.getTime())) return <EmDash />
      const text = format(value)
      return (
        <span
          title={formatFullDateTime(value, options?.locale)}
          className="text-muted-foreground block min-w-0 truncate tabular-nums"
        >
          {text}
        </span>
      )
    },
    text: (row) => {
      const value = get(row)
      return value && !Number.isNaN(value.getTime()) ? format(value) : ''
    },
    width: 140,
    skeleton: <Skeleton className="h-4 w-24" />,
    ...spreadOptions(options),
  }
}

/**
 * An amount: left-aligned like everything else, with tabular figures.
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

/** A plain number: a count, a quantity. Tabular, so a column of them scans. */
export function numberColumn<T>(
  id: string,
  header: string,
  get: (row: T) => number | null | undefined,
  options?: ColumnOptions & {
    locale?: string | undefined
    zeroAsDash?: boolean
    align?: 'start' | 'center'
  },
): EntityColumn<T> {
  const format = (value: number) => new Intl.NumberFormat(options?.locale).format(value)
  return {
    id,
    header,
    cell: (row) => {
      const value = get(row)
      if (
        value === null ||
        value === undefined ||
        Number.isNaN(value) ||
        (options?.zeroAsDash && value === 0)
      )
        return <EmDash />
      const text = format(value)
      return (
        <span title={text} className="block min-w-0 truncate tabular-nums">
          {text}
        </span>
      )
    },
    text: (row) => {
      const value = get(row)
      return value === null || value === undefined ? '' : format(value)
    },
    align: options?.align,
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

/** A status, a type, a lifecycle: anything that is one of a small set. */
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

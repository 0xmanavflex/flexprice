import { useState, type ReactNode } from 'react'
import { CheckIcon, CopyIcon, MailIcon, MoreHorizontalIcon } from '@ui/icons'
import { toast } from 'sonner'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { useInFormDialog } from '../forms/formDialogContext'

/*
 * Shared grammar for every detail page, ported 1:1 from the reference kit
 * (`detail.tsx`):
 *   header  -> what this thing is, in one line, plus its actions
 *   tabs    -> one job per tab; "Information" holds every raw property
 *   section -> a titled surface; tables inside it use the list-page style
 * Status and type pills sit in a small row directly under the title (see
 * `DetailPills`); the right-hand cluster (`DetailHeaderCluster`) holds only the
 * copy chips and the More menu. There is no subtitle line.
 */
export const DetailKitProvenance = provenance({
  source: 'composition',
  composes: ['ui/tabs', 'ui/button', 'ui/tooltip', 'ui/dropdown-menu'],
  note: 'Detail-page pieces (reference detail.tsx): line tabs with counts, light table, property grid, summary row, choice cards, form footer, copyable id, meters.',
})

/** Muted separator dot for subtitles. */
export const Dot = () => <span aria-hidden="true">·</span>

/**
 * A compact copy control for the detail header: an icon (and optional short
 * label) whose tooltip shows the full value that a click copies. The long value
 * itself is never printed in the header.
 */
export function CopyChip({
  value,
  icon,
  label,
  tooltip,
  ariaLabel,
  copiedMessage,
}: {
  value: string
  icon: ReactNode
  /** Short visible text beside the icon, e.g. "ID". Omitted, the chip is icon-only. */
  label?: string
  /** Defaults to the value itself. */
  tooltip?: ReactNode
  ariaLabel: string
  copiedMessage: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(value)
              setCopied(true)
              toast.success(copiedMessage)
              setTimeout(() => setCopied(false), 1200)
            }}
            className={cn(
              'text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-md border text-xs transition-colors',
              label ? 'px-2.5' : 'w-8 justify-center',
            )}
            aria-label={ariaLabel}
          />
        }
      >
        {label ? <span>{label}</span> : null}
        {copied ? <CheckIcon className="size-3.5" aria-hidden="true" /> : icon}
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono">{tooltip ?? value}</span>
      </TooltipContent>
    </Tooltip>
  )
}

/** The record id as "ID" plus a copy icon; hover shows the full id, click copies it. */
export function CopyId({ value, label = 'ID' }: { value: string; label?: string }) {
  return (
    <CopyChip
      value={value}
      label={label}
      icon={<CopyIcon className="size-3.5" aria-hidden="true" />}
      ariaLabel={`Copy ${label} ${value}`}
      copiedMessage={`${label} copied`}
    />
  )
}

/** An email as a mail icon; hover shows the address, click copies it. */
export function CopyEmail({ value }: { value: string }) {
  return (
    <CopyChip
      value={value}
      icon={<MailIcon className="size-3.5" aria-hidden="true" />}
      ariaLabel={`Copy email ${value}`}
      copiedMessage="Email copied"
    />
  )
}

export interface DetailMenuItem {
  id: string
  label: string
  /** Leading glyph; decorative, the label names the item. */
  icon?: ReactNode
  onSelect: () => void
  /** Destructive items are set apart below a divider, last in the menu. */
  destructive?: boolean
  disabled?: boolean
}

/**
 * The header's only action control: one "More" (ellipsis) button that opens
 * every action for the record, destructive ones last under a divider. The
 * trigger is `size-8`, the same height as the copy chips beside it.
 */
export function DetailMoreMenu({
  label,
  items,
}: {
  /** Accessible name of the trigger, e.g. "Customer actions". */
  label: string
  items: DetailMenuItem[]
}) {
  if (items.length === 0) return null
  const regular = items.filter((item) => !item.destructive)
  const destructive = items.filter((item) => item.destructive)
  const renderItem = (item: DetailMenuItem) => (
    <DropdownMenuItem
      key={item.id}
      disabled={item.disabled ?? false}
      {...(item.destructive ? { variant: 'destructive' as const } : {})}
      onClick={item.onSelect}
    >
      {item.icon ?? null}
      {item.label}
    </DropdownMenuItem>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" className="size-8" aria-label={label} />}
      >
        <MoreHorizontalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {regular.map(renderItem)}
        {regular.length > 0 && destructive.length > 0 ? <DropdownMenuSeparator /> : null}
        {destructive.map(renderItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The right-hand cluster every detail header shares, in one fixed order: the id
 * and email copy chips, then the overflow menu (`DetailMoreMenu`), which holds
 * every action. Status and type pills are not here: they sit under the title.
 *
 * The copy chips and the More button share `h-8`.
 *
 * `primary` is legacy: new headers put every action in the menu.
 */
export function DetailHeaderCluster({
  primary,
  leading,
  externalId,
  id,
  email,
  more,
}: {
  /** Legacy inline action slot; prefer menu items. */
  primary?: ReactNode
  /** Connected integration marks, after the copy chips and before the menu. */
  leading?: ReactNode
  /** The id the customer's own systems use, as an "External ID" chip before the internal one. */
  externalId?: string | undefined
  id?: string | undefined
  email?: string | undefined
  /** The overflow ("More") menu, always last. */
  more?: ReactNode
}) {
  if (!primary && !leading && !externalId && !id && !email && !more) return null
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {primary}
      {externalId ? <CopyId value={externalId} label="External ID" /> : null}
      {id ? <CopyId value={id} /> : null}
      {email ? <CopyEmail value={email} /> : null}
      {leading}
      {more}
    </div>
  )
}

export interface DetailTabSpec {
  value: string
  label: string
  count?: number
  /** Optional panel. Omit it when the page renders the active tab's body itself (reference style). */
  content?: ReactNode
}

export function DetailTabs({
  tabs,
  value,
  onValueChange,
  onChange,
  defaultValue,
}: {
  tabs: DetailTabSpec[]
  value?: string
  onValueChange?: (value: string) => void
  /** Reference name for `onValueChange`; either works. */
  onChange?: (value: string) => void
  defaultValue?: string
}) {
  const controlled =
    value !== undefined ? { value } : { defaultValue: defaultValue ?? tabs[0]?.value }
  const handle = onValueChange ?? onChange
  const hasPanels = tabs.some((tab) => tab.content !== undefined)
  return (
    <Tabs
      {...controlled}
      {...(handle ? { onValueChange: (next: unknown) => handle(String(next)) } : {})}
      className={cn(hasPanels && 'gap-6')}
    >
      <TabsList variant="line" className="w-full justify-start gap-7 border-b">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex-none px-0 pb-3">
            {tab.label}
            {tab.count !== undefined ? (
              <span className="text-muted-foreground text-xs tabular-nums">{tab.count}</span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) =>
        tab.content !== undefined ? (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.content}
          </TabsContent>
        ) : null,
      )}
    </Tabs>
  )
}

/** Label/value pairs in a responsive grid. */
export function Properties({
  items,
  columns = 3,
}: {
  items: { label: string; value: ReactNode }[]
  columns?: 2 | 3 | 4
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-8 gap-y-5',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 space-y-1">
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="text-sm break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Inline figures under the header: numbers only, no cards. */
export function SummaryRow({
  items,
  className,
}: {
  items: { label: string; value: ReactNode; hint?: ReactNode }[]
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-y-4 border-y py-5 md:divide-x',
        items.length === 3
          ? 'md:grid-cols-3'
          : items.length === 2
            ? 'md:grid-cols-2'
            : 'md:grid-cols-4',
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={item.label} className={cn('space-y-1', index > 0 && 'md:pl-6')}>
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="text-lg font-medium tabular-nums">{item.value}</dd>
          {item.hint ? <dd className="text-muted-foreground text-xs">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  )
}

export interface OverviewTile {
  label: string
  value: ReactNode
  /** A muted line under the value. */
  detail?: ReactNode
}

/**
 * One bordered box of figures in a 2 x 2 grid split by hairlines: a label, a
 * large value and a muted detail line per tile. It is the first thing in an
 * Overview (or Usage) tab, never above the tabs.
 */
export function OverviewTiles({ tiles, className }: { tiles: OverviewTile[]; className?: string }) {
  return (
    <dl
      className={cn(
        'bg-background grid grid-cols-1 overflow-hidden rounded-xl border sm:grid-cols-2',
        '[&>div]:border-b sm:[&>div:nth-child(odd)]:border-r sm:[&>div:nth-last-child(-n+2)]:border-b-0',
        '[&>div:last-child]:border-b-0',
        className,
      )}
    >
      {tiles.map((tile) => (
        <div key={tile.label} className="min-w-0 space-y-1 px-6 py-5">
          <dt className="text-muted-foreground text-xs">{tile.label}</dt>
          <dd className="truncate text-2xl font-medium tracking-tight tabular-nums">
            {tile.value}
          </dd>
          {tile.detail ? (
            <dd className="text-muted-foreground truncate text-[13px]">{tile.detail}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  )
}

export interface SimpleColumn<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
}

/** Same look as the list-page tables (grey header band, faint rows), sized for a section. */
export function SimpleTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  highlightId,
  highlight,
  empty,
}: {
  columns: SimpleColumn<T>[]
  rows: T[]
  /** Defaults to `row.id`. */
  getRowId?: (row: T) => string
  onRowClick?: (row: T) => void
  highlightId?: string | null
  /** Reference name for `highlightId`; either works. */
  highlight?: string | null
  empty?: ReactNode
}) {
  if (rows.length === 0 && empty)
    return <div className="text-muted-foreground p-6 text-sm">{empty}</div>
  const highlighted = highlightId ?? highlight
  const idOf = (row: T, index: number) =>
    getRowId ? getRowId(row) : String((row as { id?: string }).id ?? index)
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60">
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'text-muted-foreground h-10 px-4 text-left text-[11px] font-normal tracking-wider whitespace-nowrap uppercase',
                    index === 0 && 'pl-6',
                    index === columns.length - 1 && 'pr-6',
                    column.className,
                  )}
                >
                  {/* A column with no title is a row-actions column; a header cell still needs a name. */}
                  {column.header || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const id = idOf(row, rowIndex)
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-border/40 h-14 border-b transition-colors last:border-b-0',
                    onRowClick && 'hover:bg-muted/30 cursor-pointer',
                    highlighted === id && 'bg-success/6',
                  )}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 whitespace-nowrap',
                        index === 0 && 'pl-6',
                        index === columns.length - 1 && 'pr-6',
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export interface Choice<V extends string> {
  value: V
  title: string
  description: string
  icon?: ReactNode
}

/** Two- or three-option choice rendered as cards (fixed vs usage, one-time vs recurring). */
export function ChoiceCards<V extends string>({
  choices,
  options,
  value,
  onChange,
  label,
}: {
  /** Reference name is `options`; either works. */
  choices?: Choice<V>[]
  options?: Choice<V>[]
  value: V
  onChange: (value: V) => void
  /** Accessible name for the radio group. */
  label?: string
}) {
  const items = choices ?? options ?? []
  return (
    <div
      className={cn('grid gap-3', items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}
      role="radiogroup"
      aria-label={label}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
            value === item.value
              ? 'border-primary/60 bg-primary/4 ring-primary/20 ring-2'
              : 'hover:bg-muted/40',
          )}
        >
          {item.icon ? (
            <span className="text-foreground/70 bg-muted/60 flex size-8 shrink-0 items-center justify-center rounded-md border [&_svg]:size-4">
              {item.icon}
            </span>
          ) : null}
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">{item.title}</span>
            <span className="text-muted-foreground block text-[13px]/relaxed">
              {item.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * Wrapper for a create form: lives in a `FormDialog` (which pads the body) or
 * inline in a section (where it pads itself).
 */
export function Composer({
  title,
  children,
  submitLabel,
  onSubmit,
  onCancel,
  submitting,
  disabled,
}: {
  title?: string
  children: ReactNode
  submitLabel: string
  onSubmit: () => void
  /** Hides Cancel when omitted. */
  onCancel?: () => void
  submitting?: boolean
  disabled?: boolean
}) {
  const inDialog = useInFormDialog()
  return (
    <form
      className={cn('flex flex-col gap-6', !inDialog && 'p-6')}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {title ? <p className="text-sm font-medium">{title}</p> : null}
      {children}
      <div className="flex items-center justify-end gap-2 border-t pt-5">
        {onCancel ? (
          <Button type="button" variant="ghost" className="h-8" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="h-8 px-3.5" disabled={disabled || submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** Row of thin pills (reference chart-14): each entry of `colors` paints one pill. */
function Pills({ colors, label }: { colors: string[]; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-6 w-full min-w-0 items-stretch justify-between gap-0.5"
    >
      {colors.map((color, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn('h-full max-w-1 min-w-0.5 flex-1 rounded-full', color)}
        />
      ))}
    </div>
  )
}

interface SplitPart {
  value: number
  /** Tailwind background class, e.g. `bg-success`. */
  color: string
  label: string
}

/**
 * A meter split into parts: each part fills its share of the pills in its own
 * colour. Pass `parts` (reference API), or `used`/`total` with labels for the
 * common used-versus-available case.
 */
export function SplitMeter(
  props:
    | { parts: SplitPart[]; segments?: number }
    | {
        used: number
        total: number
        usedLabel: string
        availableLabel: string
        segments?: number
      },
) {
  const segments = props.segments ?? 48
  const legend = 'parts' in props ? null : props
  const parts: SplitPart[] =
    'parts' in props
      ? props.parts
      : [
          {
            value: Math.min(props.total, Math.max(0, props.used)),
            color: 'bg-success',
            label: props.usedLabel,
          },
          {
            value: Math.max(0, props.total - Math.max(0, props.used)),
            color: 'bg-muted',
            label: props.availableLabel,
          },
        ]
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1
  const colors: string[] = []
  for (const part of parts) {
    const count = Math.round((part.value / total) * segments)
    for (let i = 0; i < count && colors.length < segments; i++) colors.push(part.color)
  }
  while (colors.length < segments) colors.push('bg-muted')
  const meter = (
    <Pills
      colors={colors}
      label={parts
        .map((part) => `${part.label} ${Math.round((part.value / total) * 100)}%`)
        .join(', ')}
    />
  )
  if (!legend) return meter
  return (
    <div className="flex flex-col gap-2">
      {meter}
      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>{legend.usedLabel}</span>
        <span>{legend.availableLabel}</span>
      </div>
    </div>
  )
}

/**
 * Pill meter filled up to `value` (0..1), reference API. The older
 * `segments` list (a share per labelled row, with a legend) still works.
 */
export function SegmentMeter(
  props:
    | { value: number; color?: string; segments?: number; className?: string }
    | { segments: { id: string; label: string; share: number }[] },
) {
  if ('value' in props) {
    const count = props.segments ?? 48
    const filled = Math.round(props.value * count)
    const color = props.color ?? 'bg-primary'
    return (
      <div className={props.className}>
        <Pills
          colors={Array.from({ length: count }, (_, index) =>
            index < filled ? color : 'bg-muted',
          )}
          label={`${Math.round(props.value * 100)}%`}
        />
      </div>
    )
  }
  const { segments } = props
  const shades = ['bg-primary', 'bg-primary/70', 'bg-primary/50', 'bg-primary/30']
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted flex h-2 overflow-hidden rounded-full">
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            className={shades[index % shades.length]}
            style={{ width: `${Math.max(0, segment.share)}%` }}
            title={`${segment.label} ${segment.share.toFixed(0)}%`}
          />
        ))}
      </div>
      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map((segment, index) => (
          <li key={segment.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn('size-2 rounded-full', shades[index % shades.length])}
            />
            {segment.label} <span className="tabular-nums">{segment.share.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

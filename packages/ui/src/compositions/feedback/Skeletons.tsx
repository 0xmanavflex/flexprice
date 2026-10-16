import type { CSSProperties, ReactNode } from 'react'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Spinner } from '@ui/components/primitives/spinner'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * Placeholders shaped like what is coming.
 *
 * Rules every one of these follows:
 *   - Same footprint as the real thing (column widths, row height, line height)
 *     so the page does not move when the data arrives.
 *   - Never a number. A placeholder for money is a bar, not "$0.00": a zero
 *     that is really "not loaded yet" is a lie on a billing screen.
 *   - Never a chart shape. Charts get an empty frame with gridlines; a drawn
 *     curve would be a fabricated trend.
 *   - Decorative bones are `aria-hidden`; one `role="status"` line per region
 *     tells assistive tech once that it is loading.
 *   - Pulse stops under `prefers-reduced-motion` (see styles.css).
 */
export const SkeletonsProvenance = provenance({
  source: 'composition',
  composes: ['ui/skeleton', 'ui/spinner'],
  note: 'Shaped skeletons (table, metric, chart, page), a money-safe value placeholder and an inline loader.',
})

/** One decorative placeholder block. */
export function Bone({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <Skeleton
      aria-hidden
      className={cn('motion-reduce:animate-none', className)}
      {...(style ? { style } : {})}
    />
  )
}

export interface SkeletonRegionProps {
  /** Announced once to assistive tech. */
  label?: string
  /** Off when a parent region already announces. */
  announce?: boolean
  className?: string
  children: ReactNode
}

/** Wraps a set of bones: `aria-busy` plus a single polite announcement. */
export function SkeletonRegion({
  label = 'Loading',
  announce = true,
  className,
  children,
}: SkeletonRegionProps) {
  return (
    <div aria-busy="true" {...(className ? { className } : {})}>
      {announce ? (
        <span role="status" className="sr-only">
          {label}
        </span>
      ) : null}
      {children}
    </div>
  )
}

export type SkeletonCellKind = 'text' | 'short' | 'badge' | 'money' | 'avatar'

export interface SkeletonColumn {
  /** Any CSS grid track: `'2fr'`, `'120px'`, `'minmax(0,1fr)'`. */
  width?: string
  kind?: SkeletonCellKind
  align?: 'start' | 'end'
}

const TEXT_WIDTHS = ['72%', '58%', '84%', '64%', '78%', '52%']

function SkeletonCell({
  column,
  row,
  index,
}: {
  column: SkeletonColumn
  row: number
  index: number
}) {
  const kind = column.kind ?? 'text'
  const end = column.align === 'end' || kind === 'money'
  const width = TEXT_WIDTHS[(row + index * 2) % TEXT_WIDTHS.length]
  return (
    <div className={cn('flex min-w-0 items-center px-4', end ? 'justify-end' : null)}>
      {kind === 'avatar' ? (
        <div className="flex w-full items-center gap-2.5">
          <Bone className="size-7 shrink-0 rounded-full" />
          <Bone className="h-3.5" style={{ width }} />
        </div>
      ) : kind === 'badge' ? (
        <Bone className="h-5 w-16 rounded-full" />
      ) : kind === 'money' ? (
        <Bone className="h-3.5 w-20" />
      ) : kind === 'short' ? (
        <Bone className="h-3.5 w-1/3" />
      ) : (
        <Bone className="h-3.5" style={{ width }} />
      )}
    </div>
  )
}

export interface TableSkeletonProps {
  /** A count (first column wide), or per-column widths that mirror the real table. */
  columns?: number | SkeletonColumn[]
  rows?: number
  /** Draws a header row. Off when the real header is already on screen. */
  header?: boolean
  /** Row height in px. Match the real table's row height to avoid a jump. */
  rowHeight?: number
  label?: string
  className?: string
}

function resolveColumns(columns: number | SkeletonColumn[]): SkeletonColumn[] {
  if (typeof columns !== 'number') return columns
  return Array.from({ length: columns }, (_, i) => (i === 0 ? { width: '2fr' } : {}))
}

/**
 * Rows in the real table's column widths. Pass the same `width` strings the
 * table's columns use; with a header, the loading table and the loaded one
 * line up cell for cell.
 */
export function TableSkeleton({
  columns = 5,
  rows = 8,
  header = false,
  rowHeight = 52,
  label = 'Loading',
  className,
}: TableSkeletonProps) {
  const cols = resolveColumns(columns)
  const template = cols.map((c) => c.width ?? 'minmax(0,1fr)').join(' ')
  return (
    <SkeletonRegion label={label} className={cn('w-full', className)}>
      {header ? (
        <div
          className="border-border grid h-10 items-center border-b"
          style={{ gridTemplateColumns: template }}
        >
          {cols.map((c, i) => (
            <div
              key={i}
              className={cn(
                'flex px-4',
                c.align === 'end' || c.kind === 'money' ? 'justify-end' : null,
              )}
            >
              <Bone className="h-3 w-14" />
            </div>
          ))}
        </div>
      ) : null}
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="border-border/60 grid items-center border-b last:border-b-0"
          style={{ gridTemplateColumns: template, height: rowHeight }}
        >
          {cols.map((c, i) => (
            <SkeletonCell key={i} column={c} row={row} index={i} />
          ))}
        </div>
      ))}
    </SkeletonRegion>
  )
}

export interface MetricCardSkeletonProps {
  /** Show the small comparison line under the figure. */
  delta?: boolean
  className?: string
}

/** A headline figure: label, value (at text-2xl height), optional comparison. */
export function MetricCardSkeleton({ delta = false, className }: MetricCardSkeletonProps) {
  return (
    <SkeletonRegion announce={false} className={cn('flex flex-col gap-2', className)}>
      <Bone className="h-3.5 w-24" />
      <Bone className="h-8 w-32" />
      {delta ? <Bone className="h-3 w-20" /> : null}
    </SkeletonRegion>
  )
}

export interface ChartSkeletonProps {
  height?: number
  /** Horizontal gridlines to draw. */
  lines?: number
  label?: string
  className?: string
}

/**
 * An empty chart frame: gridlines and axis-label bones, and nothing else.
 * No curve, no bars, no "typical" shape: anything drawn here would be read as
 * data about the customer's own account.
 */
export function ChartSkeleton({
  height = 240,
  lines = 4,
  label = 'Loading chart',
  className,
}: ChartSkeletonProps) {
  return (
    <SkeletonRegion label={label} className={cn('flex w-full gap-3', className)}>
      <div className="flex flex-col justify-between py-1" style={{ height }}>
        {Array.from({ length: lines }, (_, i) => (
          <Bone key={i} className="h-2.5 w-8" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="relative flex-1" style={{ height }}>
          {Array.from({ length: lines }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className="border-border absolute inset-x-0 border-t border-dashed"
              style={{ top: `${(i / (lines - 1)) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between">
          {Array.from({ length: 5 }, (_, i) => (
            <Bone key={i} className="h-2.5 w-10" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  )
}

export interface PageLoadingStateProps {
  /** `list` = header, toolbar, table. `detail` = header and two panels. `dashboard` = metrics and charts. */
  variant?: 'list' | 'detail' | 'dashboard'
  columns?: number | SkeletonColumn[]
  label?: string
}

/**
 * The shell of a whole page while its route data loads: the same bands the
 * page will have, so the title and toolbar do not jump in.
 */
export function PageLoadingState({
  variant = 'list',
  columns,
  label = 'Loading page',
}: PageLoadingStateProps) {
  return (
    <SkeletonRegion label={label} className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Bone className="h-6 w-48" />
          <Bone className="h-3.5 w-72 max-w-full" />
        </div>
        <Bone className="h-9 w-28" />
      </div>

      {variant === 'list' ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Bone className="h-9 w-64 max-w-full" />
            <Bone className="h-9 w-24" />
          </div>
          <TableSkeleton {...(columns ? { columns } : {})} header rows={8} />
        </div>
      ) : variant === 'detail' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-4">
            <Bone className="h-40 w-full" />
            <Bone className="h-56 w-full" />
          </div>
          <Bone className="h-72 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <MetricCardSkeleton key={i} delta />
            ))}
          </div>
          <ChartSkeleton />
        </>
      )}
    </SkeletonRegion>
  )
}

export interface InlineLoadingStateProps {
  label?: string
  className?: string
}

/** A small spinner and a sentence, for a card or a section that is working. */
export function InlineLoadingState({ label = 'Loading', className }: InlineLoadingStateProps) {
  return (
    <div
      role="status"
      className={cn('text-muted-foreground flex items-center gap-2 text-sm', className)}
    >
      <Spinner aria-hidden className="size-4 motion-reduce:animate-none" />
      <span>{label}…</span>
    </div>
  )
}

export interface ValuePlaceholderProps {
  /** Width in `ch`, matching the figure it stands in for. */
  width?: number
  label?: string
  className?: string
}

/**
 * Stands in for a figure that is loading or unavailable. A bar, never a digit
 * and never a dash that could be read as "no value": an em dash is for a value
 * that is genuinely empty, this is for one we do not have yet.
 */
export function ValuePlaceholder({
  width = 7,
  label = 'Loading value',
  className,
}: ValuePlaceholderProps) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'bg-muted inline-block h-[0.8em] rounded align-middle motion-safe:animate-pulse',
        className,
      )}
      style={{ width: `${width}ch` }}
    />
  )
}

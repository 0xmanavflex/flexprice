import { useState, type ReactNode } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Button } from '@ui/components/primitives/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'

export const DetailKitProvenance = provenance({
  source: 'composition',
  composes: ['ui/tabs', 'ui/button'],
  note: 'Detail-page pieces: line tabs with counts, light table, property grid, choice cards, form footer, copyable id, meters.',
})

export interface DetailTabSpec {
  value: string
  label: string
  count?: number
  content: ReactNode
}

export function DetailTabs({
  tabs,
  value,
  onValueChange,
  defaultValue,
}: {
  tabs: DetailTabSpec[]
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
}) {
  const controlled =
    value !== undefined ? { value } : { defaultValue: defaultValue ?? tabs[0]?.value }
  return (
    <Tabs
      {...controlled}
      {...(onValueChange ? { onValueChange: (next: unknown) => onValueChange(String(next)) } : {})}
      className="gap-6"
    >
      <TabsList variant="line" className="w-full justify-start border-b">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex-none px-3 font-normal">
            {tab.label}
            {tab.count !== undefined ? (
              <span className="text-muted-foreground text-xs tabular-nums">{tab.count}</span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export interface SimpleColumn<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

export function SimpleTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  highlightId,
  empty,
}: {
  columns: SimpleColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  highlightId?: string
  empty?: ReactNode
}) {
  if (rows.length === 0 && empty)
    return <div className="text-muted-foreground p-6 text-sm">{empty}</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'text-muted-foreground px-4 py-2.5 text-[11px] font-medium tracking-[0.08em] uppercase',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row)
            return (
              <tr
                key={id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-border/50 h-14 border-t tabular-nums',
                  onRowClick && 'hover:bg-muted/40 cursor-pointer',
                  highlightId === id && 'bg-primary/5',
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 align-middle', column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Properties({
  items,
  columns = 2,
}: {
  items: { label: string; value: ReactNode }[]
  columns?: 2 | 3 | 4
}) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[
    columns
  ]
  return (
    <dl className={cn('grid grid-cols-1 gap-x-10 gap-y-5 text-sm', cols)}>
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-1">
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="min-w-0 font-normal break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export interface Choice<V extends string> {
  value: V
  title: string
  description: string
  icon?: ReactNode
}

export function ChoiceCards<V extends string>({
  choices,
  value,
  onChange,
  label,
}: {
  choices: Choice<V>[]
  value: V
  onChange: (value: V) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-3', choices.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}
    >
      {choices.map((choice) => {
        const selected = choice.value === value
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(choice.value)}
            className={cn(
              'hover:bg-muted/40 focus-visible:outline-ring flex flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors focus-visible:outline-2',
              selected && 'border-primary bg-primary/5',
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {choice.icon}
              {choice.title}
            </span>
            <span className="text-muted-foreground text-xs">{choice.description}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Composer({
  children,
  submitLabel,
  onSubmit,
  onCancel,
  submitting,
  disabled,
}: {
  children: ReactNode
  submitLabel: string
  onSubmit: () => void
  onCancel: () => void
  submitting?: boolean
  disabled?: boolean
}) {
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {children}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled || submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={`Copy ${value}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex items-center gap-1.5 rounded-sm font-mono text-xs focus-visible:outline-2"
    >
      {value}
      {copied ? (
        <CheckIcon aria-hidden className="size-3" />
      ) : (
        <CopyIcon aria-hidden className="size-3" />
      )}
    </button>
  )
}

export function SplitMeter({
  used,
  total,
  usedLabel,
  availableLabel,
}: {
  used: number
  total: number
  usedLabel: string
  availableLabel: string
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
  return (
    <div className="flex flex-col gap-2">
      <div className="bg-muted flex h-2 overflow-hidden rounded-full">
        <div className="bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>{usedLabel}</span>
        <span>{availableLabel}</span>
      </div>
    </div>
  )
}

export function SegmentMeter({
  segments,
}: {
  segments: { id: string; label: string; share: number }[]
}) {
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

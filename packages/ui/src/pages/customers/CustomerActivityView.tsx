import { useState, type MouseEvent, type ReactNode } from 'react'
import type { ActivityField } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { Section } from '@ui/compositions/layout/Section'
import { ErrorState } from '@ui/compositions/feedback/States'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import {
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeIcon,
  CreditCardIcon,
  FileTextIcon,
  ReceiptIcon,
  RepeatIcon,
  SearchIcon,
  UserIcon,
  WalletIcon,
} from '@ui/icons'
import { provenance } from '@ui/provenance'
import { cn } from '@ui/lib/cn'
import { CopyValue } from '../shared/CopyValue'
import { Pill, type PillTone } from '../shared/cells'

/**
 * A customer's full audit trail, as its own tab: filters, the event list and
 * an event-details sheet. The overview keeps its compact Activity card.
 *
 * Who did it and what it happened to are always separate: the row names the
 * record (`Customer · Acme`) under the title, and the actor in its own column
 * with the channel it came through. Times carry their zone.
 *
 * The API returns the record's state *after* each change, not a diff, so the
 * sheet shows "State after this change" from an allowlist of fields, and the
 * whole snapshot only behind "View raw payload".
 */
export const CustomerActivityViewProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/select',
    'primitives/input',
    'primitives/sheet',
    'compositions/layout/Section',
    'shared/CopyValue',
    'shared/cells',
  ],
  note: 'Customer Activity tab: server-filtered, cursor-paged audit trail with an event-details sheet.',
})

export interface ActivityStatus {
  label: string
  tone: PillTone
}

export interface ActivityDetailRow {
  label: string
  value: string
  /** Offers a copy button and sets the value in mono. */
  copy?: boolean
}

export interface ActivityRowView {
  id: string
  title: string
  /** API entity type, for the row icon (`invoice`, `subscription`, …). */
  entityType: string
  /** "Customer", "Contract", "Invoice". */
  entityNoun: string
  entityLabel: string
  entityId: string
  /** The record's page, when it has one. */
  entityHref?: string | undefined
  /** Who acted: a person, an API key, a workflow, "System". */
  actor: string
  /** How: "Dashboard", "API key · API", "Workflow". */
  actorDetail: string
  /** In the viewer's zone, with the zone named: "23 Oct 2026, 21:51 IST". */
  at: string
  /** The same instant in UTC, for the sheet. */
  atUtc: string
  statuses: ActivityStatus[]
  /** What the record stood at after the change, from an allowlist. */
  state: readonly ActivityField[]
  /** Source, request id, IP, user agent, actor id, event id. */
  metadata: ActivityDetailRow[]
  /** The event as the API sent it, pretty-printed. */
  raw: string
}

export interface ActivityFilters {
  search: string
  action: string
  actorType: string
  source: string
  range: ActivityRange
}

export type ActivityRange = '24h' | '7d' | '30d'

export const ACTIVITY_RANGES: ReadonlyArray<{ value: ActivityRange; label: string }> = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

export const ACTIVITY_PAGE_SIZES = [25, 50] as const

export interface CustomerActivityViewProps {
  rows: ActivityRowView[]
  filters: ActivityFilters
  onFiltersChange: (filters: ActivityFilters) => void
  actionOptions: ReadonlyArray<{ value: string; label: string }>
  actorOptions: ReadonlyArray<{ value: string; label: string }>
  sourceOptions: ReadonlyArray<{ value: string; label: string }>
  /** "Showing 1–25", "3 of 25 on this page match". */
  summary: string
  page: number
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  pageSize: number
  onPageSizeChange: (size: number) => void
  isLoading?: boolean | undefined
  /** A page is loading while the previous one stays on screen. */
  isFetching?: boolean | undefined
  error?: string | null | undefined
  onRetry?: (() => void) | undefined
  /** Opens a record's page in the app. */
  onNavigate?: ((href: string) => void) | undefined
}

const ENTITY_ICON: Record<string, typeof UserIcon> = {
  customer: UserIcon,
  invoice: FileTextIcon,
  subscription: RepeatIcon,
  payment: CreditCardIcon,
  wallet: WalletIcon,
  credit_note: ReceiptIcon,
}

const ALL = '__all'

function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
  className,
}: {
  label: string
  value: string
  allLabel: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
  className?: string
}) {
  const items = [{ value: ALL, label: allLabel }, ...options]
  return (
    <Select
      value={value || ALL}
      items={items}
      onValueChange={(next) => onChange(next === ALL || next === null ? '' : String(next))}
    >
      <SelectTrigger aria-label={label} className={cn('h-9 w-full sm:w-44', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RecordLink({
  row,
  onNavigate,
  children,
}: {
  row: ActivityRowView
  onNavigate?: ((href: string) => void) | undefined
  children: ReactNode
}) {
  if (!row.entityHref) return <span>{children}</span>
  const href = row.entityHref
  return (
    <a
      href={href}
      className="text-primary hover:underline"
      onClick={(event: MouseEvent) => {
        event.stopPropagation()
        if (!onNavigate || event.metaKey || event.ctrlKey) return
        event.preventDefault()
        onNavigate(href)
      }}
    >
      {children}
    </a>
  )
}

export function CustomerActivityView({
  rows,
  filters,
  onFiltersChange,
  actionOptions,
  actorOptions,
  sourceOptions,
  summary,
  page,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  pageSize,
  onPageSizeChange,
  isLoading = false,
  isFetching = false,
  error = null,
  onRetry,
  onNavigate,
}: CustomerActivityViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = rows.find((row) => row.id === selectedId) ?? null
  const set = (patch: Partial<ActivityFilters>) => onFiltersChange({ ...filters, ...patch })

  return (
    <>
      <Section
        title="Activity"
        description="Audit log of every change made to this customer and its records."
        flush
      >
        <div className="flex flex-col gap-2 border-b px-6 py-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              aria-hidden
              className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              type="search"
              aria-label="Search activity"
              placeholder="Search events, IDs or people…"
              value={filters.search}
              onChange={(event) => set({ search: event.target.value })}
              className="h-9 pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterSelect
              label="Action"
              value={filters.action}
              allLabel="All actions"
              options={actionOptions}
              onChange={(action) => set({ action })}
            />
            <FilterSelect
              label="Actor"
              value={filters.actorType}
              allLabel="All actors"
              options={actorOptions}
              onChange={(actorType) => set({ actorType })}
            />
            <FilterSelect
              label="Source"
              value={filters.source}
              allLabel="All sources"
              options={sourceOptions}
              onChange={(source) => set({ source })}
            />
            <Select
              value={filters.range}
              items={ACTIVITY_RANGES.map((range) => ({ value: range.value, label: range.label }))}
              onValueChange={(range) => range && set({ range: range as ActivityRange })}
            >
              <SelectTrigger aria-label="Date range" className="h-9 w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="p-6">
            <ErrorState
              title="Activity could not be loaded"
              description={error}
              {...(onRetry ? { onRetry } : {})}
            />
          </div>
        ) : isLoading ? (
          <p role="status" className="text-muted-foreground px-6 py-10 text-center text-[13px]">
            Loading activity…
          </p>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              size="inline"
              title="No activity matches"
              description="Nothing was recorded for this customer with these filters. Widen the date range or clear a filter."
            />
          </div>
        ) : (
          <ol
            aria-label="Activity events"
            className={cn('divide-y', isFetching && 'opacity-60 transition-opacity')}
          >
            {rows.map((row) => {
              const Icon = ENTITY_ICON[row.entityType] ?? ActivityIcon
              return (
                <li
                  key={row.id}
                  // The whole row opens the details for a pointer; the chevron
                  // button is the same action for the keyboard and screen
                  // readers, so the record link is never nested in a control.
                  onClick={() => setSelectedId(row.id)}
                  className="hover:bg-muted/40 grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-6 py-3.5 md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1.2fr)_13rem_14rem_auto]"
                >
                  <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-full">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{row.title}</span>
                    <span className="text-muted-foreground block truncate text-[13px]">
                      {row.entityNoun} ·{' '}
                      <RecordLink row={row} onNavigate={onNavigate}>
                        {row.entityLabel}
                      </RecordLink>
                    </span>
                  </span>
                  <span className="hidden min-w-0 md:block">
                    <span className="block truncate text-[13px]">{row.actor}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {row.actorDetail}
                    </span>
                  </span>
                  <span className="text-muted-foreground hidden text-[13px] tabular-nums md:block">
                    {row.at}
                  </span>
                  <span className="hidden flex-nowrap gap-1.5 md:flex">
                    {row.statuses.map((status) => (
                      <Pill key={status.label} tone={status.tone}>
                        {status.label}
                      </Pill>
                    ))}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Open details: ${row.title}, ${row.entityNoun} ${row.entityLabel}, by ${row.actor}, ${row.at}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedId(row.id)
                    }}
                  >
                    <ChevronRightIcon aria-hidden />
                  </Button>
                  <span className="text-muted-foreground col-span-2 col-start-2 text-xs md:hidden">
                    {row.actor} · {row.actorDetail} · {row.at}
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3">
          <p className="text-muted-foreground text-[13px]" aria-live="polite">
            {summary}
          </p>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              items={ACTIVITY_PAGE_SIZES.map((size) => ({
                value: String(size),
                label: `${size} per page`,
              }))}
              onValueChange={(size) => size && onPageSizeChange(Number(size))}
            >
              <SelectTrigger aria-label="Events per page" className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={!hasPrevious || isFetching}
              onClick={onPrevious}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <span className="text-[13px] tabular-nums" aria-label={`Page ${page}`}>
              {page}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={!hasNext || isFetching}
              onClick={onNext}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </div>
      </Section>

      <ActivityEventSheet
        row={selected}
        onClose={() => setSelectedId(null)}
        onNavigate={onNavigate}
      />
    </>
  )
}

/**
 * One event's details: subject, state after the change, request metadata and,
 * on request, the raw payload. Shared by the Activity tab and the overview's
 * Activity card, so a click on either shows the same thing.
 */
export function ActivityEventSheet({
  row,
  onClose,
  onNavigate,
}: {
  row: ActivityRowView | null
  onClose: () => void
  onNavigate?: ((href: string) => void) | undefined
}) {
  return (
    <Sheet open={row !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {row ? <EventDetails row={row} onNavigate={onNavigate} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="rounded-lg border">{children}</div>
    </section>
  )
}

function Rows({ rows }: { rows: ReadonlyArray<ActivityDetailRow | ActivityField> }) {
  return (
    <dl className="divide-y text-[13px]">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[8rem_1fr] items-start gap-3 px-3 py-2.5">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 break-words">
            {'copy' in row && row.copy ? (
              <CopyValue value={row.value} label={row.label} className="max-w-full" />
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function EventDetails({
  row,
  onNavigate,
}: {
  row: ActivityRowView
  onNavigate?: ((href: string) => void) | undefined
}) {
  const [showRaw, setShowRaw] = useState(false)
  return (
    <>
      <SheetHeader>
        <SheetTitle>{row.title}</SheetTitle>
        <SheetDescription>
          {row.at} · {row.atUtc}
        </SheetDescription>
        <p className="text-muted-foreground text-[13px]">
          By <span className="text-foreground">{row.actor}</span> · {row.actorDetail}
        </p>
        {row.statuses.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {row.statuses.map((status) => (
              <Pill key={status.label} tone={status.tone}>
                {status.label}
              </Pill>
            ))}
          </div>
        ) : null}
      </SheetHeader>

      <div className="flex flex-col gap-6 px-4 pb-6">
        <DetailBlock title="Subject">
          <div className="flex flex-col gap-0.5 px-3 py-3 text-[13px]">
            <span className="text-muted-foreground text-xs">{row.entityNoun}</span>
            <RecordLink row={row} onNavigate={onNavigate}>
              <span className="font-medium">{row.entityLabel}</span>
            </RecordLink>
            {row.entityId && row.entityId !== row.entityLabel ? (
              <CopyValue value={row.entityId} label={`${row.entityNoun} ID`} className="text-xs" />
            ) : null}
          </div>
        </DetailBlock>

        {row.state.length > 0 ? (
          <DetailBlock title="State after this change">
            <Rows rows={row.state} />
          </DetailBlock>
        ) : null}

        <DetailBlock title="Event metadata">
          <Rows rows={row.metadata} />
        </DetailBlock>

        <div>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={showRaw}
            onClick={() => setShowRaw((open) => !open)}
          >
            <CodeIcon aria-hidden />
            {showRaw ? 'Hide raw payload' : 'View raw payload'}
          </Button>
          {showRaw ? (
            <pre className="bg-muted mt-2 max-h-96 overflow-auto rounded-lg p-3 font-mono text-xs leading-5">
              {row.raw}
            </pre>
          ) : null}
        </div>
      </div>
    </>
  )
}

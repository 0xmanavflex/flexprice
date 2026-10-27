import { useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import type { ActivityField } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
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
import { Properties } from '@ui/compositions/detail/DetailKit'
import { DateInput } from '@ui/compositions/forms/DateInput'
import type { FlatFilter } from '@ui/compositions/tables/FilterBar'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import {
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeIcon,
  CreditCardIcon,
  EyeIcon,
  FileTextIcon,
  ReceiptIcon,
  RepeatIcon,
  UserIcon,
  WalletIcon,
} from '@ui/icons'
import { provenance } from '@ui/provenance'
import { CopyValue } from '../shared/CopyValue'
import { EntityList } from '../shared/EntityList'
import { EmDash, Pill, Tag, type EntityColumn, type PillTone } from '../shared/cells'

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
    'primitives/sheet',
    'compositions/layout/Section',
    'pages/shared/EntityList',
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
  /** What kind of actor, when not a person or the system: "API key", "Customer". */
  actorKind?: string | undefined
  /** The channel it came through: "API", "Dashboard", "Workflow". */
  source: string
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
  /** With `actorType` `user`: one person's user id. */
  actorId?: string
  source: string
  range: ActivityRange
  /** `custom` only: the first and last day shown, `YYYY-MM-DD`, local time. */
  from?: string
  to?: string
}

export type ActivityRange = '24h' | '7d' | '30d' | 'custom'

export const ACTIVITY_RANGES: ReadonlyArray<{ value: ActivityRange; label: string }> = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
]

export const ACTIVITY_PAGE_SIZES = [25, 50] as const

export interface CustomerActivityViewProps {
  rows: ActivityRowView[]
  filters: ActivityFilters
  onFiltersChange: (filters: ActivityFilters) => void
  actionOptions: ReadonlyArray<{ value: string; label: string }>
  actorOptions: ReadonlyArray<{ value: string; label: string }>
  /** Team members, by user id, offered once the actor is User. */
  personOptions?: ReadonlyArray<{ value: string; label: string }>
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

/** `is` only: each filter is one value, as the URL and the request carry it. */
const IS_OPERATOR = [{ value: 'is', label: 'is' }]

function selectField(
  id: ActivityFilterField,
  label: string,
  options: ReadonlyArray<{ value: string; label: string }>,
): FilterField {
  return {
    id,
    label,
    type: 'select',
    options: options.map((option) => ({ ...option })),
    operators: IS_OPERATOR,
    defaultOperator: 'is',
  }
}

type ActivityFilterField = 'action' | 'actorType' | 'actorId' | 'source'

/** Whether a rule has a value chosen yet: a row just added has none. */
function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasValue)
  return value !== undefined && value !== null && value !== ''
}

/**
 * One rule per field, the latest kept. The URL and the request hold one value
 * per field, so a second Action replaces the first rather than leaving a chip
 * the list ignores. An earlier rule only goes once the later one has a value:
 * Add filter seeds a blank row on the first field, and that row (still being
 * pointed at another field) must not erase a finished filter.
 */
export function oneRulePerField(query: FilterQuery): FilterQuery {
  const key = (node: FilterQuery['rules'][number]) =>
    node.type === 'rule' ? node.path.join('.') : null
  const kept = query.rules.filter(
    (node, index) =>
      key(node) === null ||
      !query.rules
        .slice(index + 1)
        .some(
          (later) => later.type === 'rule' && key(later) === key(node) && hasValue(later.value),
        ),
  )
  return kept.length === query.rules.length ? query : { ...query, rules: kept }
}

/**
 * The filters a change in the filter bar asks for, one value per field (the
 * last rule wins). A person is a user, so the field that just changed decides
 * between them: choosing a person sets the actor to people, and choosing
 * another actor type drops the person.
 */
export function resolveActivityFilters(
  flat: readonly FlatFilter[],
  previous: Pick<ActivityFilters, 'actorType' | 'actorId'>,
): Pick<ActivityFilters, 'action' | 'actorType' | 'actorId' | 'source'> {
  const read = (field: ActivityFilterField) =>
    String(flat.findLast((entry) => entry.field === field)?.values[0] ?? '')
  const actorId = read('actorId')
  let actorType = read('actorType')
  const personChanged = actorId !== (previous.actorId ?? '')
  if (actorId && (personChanged || !actorType)) actorType = 'user'
  return {
    action: read('action'),
    actorType,
    actorId: actorType === 'user' ? actorId : '',
    source: read('source'),
  }
}

export type ActivitySortField = 'at' | 'event' | 'actor' | 'source'

const SORT_OPTIONS: Array<{ value: ActivitySortField; label: string }> = [
  { value: 'at', label: 'Time' },
  { value: 'event', label: 'Event' },
  { value: 'actor', label: 'Actor' },
  { value: 'source', label: 'Source' },
]

const SORT_TEXT: Record<Exclude<ActivitySortField, 'at'>, (row: ActivityRowView) => string> = {
  event: (row) => row.title,
  actor: (row) => row.actor,
  source: (row) => row.source,
}

/**
 * The page in the chosen order. The API returns newest first and nothing
 * else, so the default is the order it sent and every other order rearranges
 * the page on screen.
 */
export function sortActivityRows(
  rows: readonly ActivityRowView[],
  field: ActivitySortField,
  direction: 'asc' | 'desc',
): ActivityRowView[] {
  if (field === 'at') return direction === 'desc' ? [...rows] : [...rows].reverse()
  const text = SORT_TEXT[field]
  const sign = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => sign * text(a).localeCompare(text(b)))
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
  personOptions = [],
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
  const [sort, setSort] = useState<{ field: ActivitySortField; direction: 'asc' | 'desc' }>({
    field: 'at',
    direction: 'desc',
  })
  const selected = rows.find((row) => row.id === selectedId) ?? null
  const set = (patch: Partial<ActivityFilters>) => onFiltersChange({ ...filters, ...patch })
  const sorted = useMemo(
    () => sortActivityRows(rows, sort.field, sort.direction),
    [rows, sort.field, sort.direction],
  )

  const fields = useMemo(
    () => [
      selectField('action', 'Action', actionOptions),
      selectField('actorType', 'Actor', actorOptions),
      // A person is a user: choosing one also sets the actor to people (#222).
      ...(personOptions.length > 0 ? [selectField('actorId', 'Person', personOptions)] : []),
      selectField('source', 'Source', sourceOptions),
    ],
    [actionOptions, actorOptions, personOptions, sourceOptions],
  )

  const active: Array<[ActivityFilterField, string]> = (
    [
      ['action', filters.action],
      ['actorType', filters.actorType],
      ['actorId', filters.actorId ?? ''],
      ['source', filters.source],
    ] as Array<[ActivityFilterField, string]>
  ).filter(([, value]) => value !== '')
  const query = createFilterQuery(
    active.map(([id, value]) => createFilterRule({ id, path: [id], operator: 'is', value })),
  )
  const isFiltered = active.length > 0 || filters.search.trim() !== ''
  const clear = () => set({ search: '', action: '', actorType: '', actorId: '', source: '' })

  const columns: EntityColumn<ActivityRowView>[] = [
    {
      id: 'event',
      header: 'Event',
      width: 360,
      hideable: false,
      sortable: true,
      text: (row) => `${row.title} · ${row.entityNoun} · ${row.entityLabel}`,
      cell: (row) => {
        const Icon = ENTITY_ICON[row.entityType] ?? ActivityIcon
        return (
          <span className="flex min-w-0 items-center gap-3">
            <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
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
          </span>
        )
      },
    },
    {
      id: 'actor',
      header: 'Actor',
      width: 200,
      sortable: true,
      text: (row) => row.actor,
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-[13px]">{row.actor}</span>
          {row.actorKind ? (
            <span className="text-muted-foreground block text-xs">{row.actorKind}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'source',
      header: 'Source',
      width: 140,
      sortable: true,
      text: (row) => row.source,
      cell: (row) => (row.source ? <Tag>{row.source}</Tag> : <EmDash />),
    },
    {
      id: 'at',
      header: 'Time',
      width: 220,
      sortable: true,
      text: (row) => row.at,
      cell: (row) => (
        <span className="text-muted-foreground block truncate text-[13px] tabular-nums">
          {row.at}
        </span>
      ),
    },
  ]

  const rangeControls = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filters.range}
        items={ACTIVITY_RANGES.map((range) => ({ value: range.value, label: range.label }))}
        onValueChange={(range) => range && set({ range: range as ActivityRange })}
      >
        <SelectTrigger aria-label="Date range" className="h-8 w-40">
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
      {filters.range === 'custom' ? (
        <>
          <DateInput
            aria-label="From"
            value={filters.from ?? ''}
            onValueChange={(from) => set({ from })}
            {...(filters.to ? { max: filters.to } : {})}
            placeholder="From"
            className="h-8 w-40"
          />
          <DateInput
            aria-label="To"
            value={filters.to ?? ''}
            onValueChange={(to) => set({ to })}
            {...(filters.from ? { min: filters.from } : {})}
            placeholder="To"
            className="h-8 w-40"
          />
        </>
      ) : null}
    </div>
  )

  return (
    <>
      <Section
        title="Activity"
        description="Audit log of every change made to this customer and its records."
        actions={rangeControls}
        flush
      >
        <EntityList<ActivityRowView>
          label="Activity events"
          noun="events"
          headingAs="h3"
          compact
          hideFooter
          rows={sorted}
          total={rows.length}
          columns={columns}
          getRowId={(row) => row.id}
          // Paging is by cursor, in the footer below; the list shows one page.
          page={1}
          pageSize={pageSize}
          onPaginationChange={() => undefined}
          search={filters.search}
          onSearchChange={(search) => set({ search })}
          searchPlaceholder="Search events, IDs or people…"
          filter={{
            fields,
            query,
            flat: true,
            activeCount: active.length,
            normalize: oneRulePerField,
            onQueryChange: (_next, flat: FlatFilter[]) =>
              set(resolveActivityFilters(flat, filters)),
          }}
          sort={{
            options: SORT_OPTIONS,
            field: sort.field,
            direction: sort.direction,
            activeCount: sort.field === 'at' && sort.direction === 'desc' ? 0 : 1,
            onChange: (field, direction) =>
              setSort({ field: field as ActivitySortField, direction }),
          }}
          onRowClick={(row) => setSelectedId(row.id)}
          rowActions={(row) => [
            {
              label: 'View details',
              icon: <EyeIcon aria-hidden className="size-4" />,
              readOnly: true,
              onSelect: () => setSelectedId(row.id),
            },
          ]}
          isLoading={isLoading}
          isProvisional={isFetching}
          error={error}
          {...(onRetry ? { onRetry } : {})}
          isPageLocalFilter
          isFiltered={isFiltered}
          onClearFilters={clear}
          filteredEmptyTitle="No activity matches"
          filteredEmptyDescription="Nothing was recorded for this customer with these filters. Widen the date range or clear a filter."
          empty={{
            scene: 'customers',
            title: 'No activity matches',
            description:
              'Nothing was recorded for this customer in this date range. Widen the date range.',
          }}
        />

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
    <div className="px-3 py-3">
      {/* One column: the sheet is narrow, and two columns cut IDs and values in half. */}
      <Properties
        columns={1}
        items={rows.map((row) => ({
          label: row.label,
          value:
            'copy' in row && row.copy ? (
              <CopyValue value={row.value} label={row.label} full className="max-w-full" />
            ) : (
              row.value
            ),
        }))}
      />
    </div>
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
            // Wrapped, so a long value reads in the sheet rather than scrolling sideways.
            <pre className="bg-muted mt-2 max-h-96 overflow-auto rounded-lg p-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap">
              {row.raw}
            </pre>
          ) : null}
        </div>
      </div>
    </>
  )
}

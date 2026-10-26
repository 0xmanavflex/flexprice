import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ACTIVITY_ACTOR_TYPES,
  ACTIVITY_SOURCES,
  activityActor,
  activityEntityNoun,
  activityPaymentStatus,
  activitySourceLabel,
  activityStatus,
  activityTitle,
  describeActivity,
  MemberType,
  type ActivityEntry,
} from '@fp/domain'
import { useActivityPage, useMembers } from '@fp/query'
import {
  CustomerActivityView,
  type ActivityRange,
  type ActivityRowView,
  type ActivityStatus,
} from '@fp/ui/pages'
import { activityEntityHref, activityStamp, activityStampUtc } from '@/pages/shared/activityLog'
import { activityFiltersFrom, activitySearchFrom, type ActivitySearch } from './activitySearch'

const RANGE_MS: Record<Exclude<ActivityRange, 'custom'>, number> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
}

/**
 * Actions offered in the filter, for the records a customer's trail holds.
 * Every name is one the API registers (flexprice `internal/activity`: each
 * entity has created / updated / deleted plus its declared actions), because
 * it rejects any other. Rarer ones still appear under "All actions".
 */
const ACTIONS = [
  'customer.created',
  'customer.updated',
  'customer.archived',
  'subscription.created',
  'subscription.activated',
  'subscription.plan_changed',
  'subscription.paused',
  'subscription.resumed',
  'subscription.cancelled',
  'invoice.created',
  'invoice.finalized',
  'invoice.paid',
  'invoice.voided',
  'invoice.refunded',
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  'wallet.created',
  'wallet.topped_up',
  'wallet.terminated',
  'credit_note.finalized',
  'credit_note.voided',
]

const TONE: Record<string, ActivityStatus['tone']> = {
  published: 'success',
  active: 'success',
  paid: 'success',
  succeeded: 'success',
  finalized: 'info',
  trialing: 'info',
  draft: 'neutral',
  pending: 'warning',
  processing: 'warning',
  overdue: 'warning',
  failed: 'danger',
  voided: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
  archived: 'neutral',
  deleted: 'neutral',
}

function status(label: string | undefined): ActivityStatus[] {
  if (!label) return []
  return [{ label, tone: TONE[label.toLowerCase()] ?? 'neutral' }]
}

/** The channel and, for a non-person, what kind of actor it is. */
function actorDetail(entry: ActivityEntry): string {
  const source = activitySourceLabel(entry.source)
  const kind =
    entry.actorType === 'api_key' ? 'API key' : entry.actorType === 'customer' ? 'Customer' : ''
  return [kind, source].filter(Boolean).join(' · ') || '—'
}

export function toActivityRow(entry: ActivityEntry, customerName?: string): ActivityRowView {
  const facts = describeActivity(entry)
  const noun = activityEntityNoun(entry.entityType)
  const isThisCustomer = entry.entityType === 'customer'
  const entityLabel =
    // The name recorded with the event first: after a rename, an old event
    // keeps the name it had. The current name only fills a gap.
    facts.record || entry.entityLabel || (isThisCustomer && customerName) || entry.entityId
  const href = activityEntityHref(entry)
  const statuses = [
    ...status(activityStatus(entry)),
    ...status(activityPaymentStatus(entry)).filter(
      (payment) => payment.label !== activityStatus(entry),
    ),
  ]
  const metadata = [
    { label: 'Source', value: activitySourceLabel(entry.source) || '—' },
    ...(entry.requestId ? [{ label: 'Request ID', value: entry.requestId, copy: true }] : []),
    ...(entry.ip ? [{ label: 'IP address', value: entry.ip, copy: true }] : []),
    ...(entry.userAgent ? [{ label: 'User agent', value: entry.userAgent }] : []),
    {
      label: 'Actor',
      value: `${activityActor(entry)}${entry.actorType ? ` (${entry.actorType.replace('_', ' ')})` : ''}`,
    },
    ...(entry.actorId ? [{ label: 'Actor ID', value: entry.actorId, copy: true }] : []),
    { label: 'Event ID', value: entry.id, copy: true },
  ]
  const raw = JSON.stringify(
    {
      id: entry.id,
      action: entry.action,
      occurred_at: entry.occurredAt?.toISOString() ?? null,
      entity: { type: entry.entityType, id: entry.entityId, label: entry.entityLabel },
      actor: { type: entry.actorType, id: entry.actorId, label: entry.actorLabel },
      source: entry.source,
      ...(entry.customerId ? { customer_id: entry.customerId } : {}),
      ...(entry.requestId ? { request_id: entry.requestId } : {}),
      ...(entry.ip ? { ip: entry.ip } : {}),
      ...(entry.userAgent ? { user_agent: entry.userAgent } : {}),
      ...(entry.state ? { state: entry.state } : {}),
    },
    null,
    2,
  )
  return {
    id: entry.id,
    title: entry.title || activityTitle(entry.action),
    entityType: entry.entityType,
    entityNoun: noun,
    entityLabel,
    entityId: entry.entityId,
    ...(href ? { entityHref: href } : {}),
    actor: activityActor(entry),
    actorDetail: actorDetail(entry),
    at: entry.occurredAt ? activityStamp(entry.occurredAt) : '—',
    atUtc: entry.occurredAt ? activityStampUtc(entry.occurredAt) : '',
    statuses,
    state: facts.fields ?? [],
    metadata,
    raw,
  }
}

/** Search matches what a row shows, plus its ids. */
function matches(row: ActivityRowView, entry: ActivityEntry, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return [
    row.title,
    row.entityNoun,
    row.entityLabel,
    row.actor,
    row.actorDetail,
    entry.entityId,
    entry.actorId,
    entry.requestId ?? '',
    entry.id,
    entry.action,
  ].some((value) => value.toLowerCase().includes(needle))
}

/**
 * The customer's Activity tab, on live data: `POST /activity` scoped to the
 * customer, with the action, actor type and date range filtered on the
 * server and paged by cursor. The API has no text search, source filter or
 * total, so search and source narrow the loaded page, and the footer says so.
 */
export function CustomerActivityPanel({
  customerId,
  customerName,
  search,
  onSearchChange,
}: {
  customerId: string
  customerName?: string | undefined
  /** The filters, as the route's search params (`activitySearch.ts`). */
  search: ActivitySearch
  onSearchChange: (next: ActivitySearch) => void
}) {
  const navigate = useNavigate()
  const filters = activityFiltersFrom(search)
  const [pageSize, setPageSize] = useState(25)
  // Fixed when the range is chosen, so paging does not shift the window.
  const window = useMemo(
    () => windowFor(filters.range, filters.from, filters.to),
    [filters.range, filters.from, filters.to],
  )
  // Cursors of the pages visited, so Previous can go back: `[undefined]` is
  // page 1. They belong to one set of server-side filters: change any of
  // those and the trail starts again from its first page.
  const serverKey = `${filters.action}|${filters.actorType}|${filters.actorId ?? ''}|${filters.range}|${filters.from ?? ''}|${filters.to ?? ''}|${pageSize}`
  const [paging, setPaging] = useState<{ key: string; cursors: Array<string | undefined> }>({
    key: serverKey,
    cursors: [undefined],
  })
  const cursors = paging.key === serverKey ? paging.cursors : [undefined]
  const setCursors = (next: Array<string | undefined>) =>
    setPaging({ key: serverKey, cursors: next })
  const cursor = cursors[cursors.length - 1]

  const page = useActivityPage({
    customerId,
    startTime: window.start,
    endTime: window.end,
    ...(filters.actorType ? { actorTypes: [filters.actorType] } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.action ? { actions: [filters.action] } : {}),
    ...(cursor ? { cursor } : {}),
    limit: pageSize,
  })

  // The Person filter: the tenant's people, read once the actor is User.
  const people = useMembers({
    page: 1,
    pageSize: 100,
    type: MemberType.User,
    search: '',
    roles: [],
  })
  const personOptions = useMemo(
    () =>
      filters.actorType === 'user'
        ? (people.data?.members ?? []).map((member) => ({
            value: member.id,
            label: member.name || member.email || member.id,
          }))
        : [],
    [filters.actorType, people.data],
  )

  const entries = useMemo(() => page.data?.entries ?? [], [page.data])
  const rows = useMemo(
    () =>
      entries
        .map((entry) => ({ entry, row: toActivityRow(entry, customerName) }))
        .filter(
          ({ entry, row }) =>
            (!filters.source || entry.source === filters.source) &&
            matches(row, entry, filters.search),
        )
        .map(({ row }) => row),
    [entries, customerName, filters.source, filters.search],
  )

  const pageNumber = cursors.length
  const first = (pageNumber - 1) * pageSize + 1
  const narrowed = filters.search.trim() !== '' || filters.source !== ''
  const summary =
    entries.length === 0
      ? 'No events'
      : narrowed
        ? `${rows.length} of ${entries.length} events on this page match`
        : `Showing ${first}–${first + entries.length - 1}${page.data?.hasMore ? '' : ` of ${first + entries.length - 1}`} events`

  return (
    <CustomerActivityView
      rows={rows}
      filters={filters}
      onFiltersChange={(next) => onSearchChange(activitySearchFrom(next))}
      actionOptions={ACTIONS.map((action) => ({ value: action, label: activityTitle(action) }))}
      actorOptions={ACTIVITY_ACTOR_TYPES}
      personOptions={personOptions}
      sourceOptions={ACTIVITY_SOURCES.map((source) => ({
        value: source,
        label: activitySourceLabel(source),
      }))}
      summary={summary}
      page={pageNumber}
      hasPrevious={cursors.length > 1}
      hasNext={Boolean(page.data?.hasMore)}
      onPrevious={() => setCursors(cursors.slice(0, -1))}
      onNext={() => {
        const next = page.data?.nextCursor
        if (next) setCursors([...cursors, next])
      }}
      pageSize={pageSize}
      onPageSizeChange={setPageSize}
      isLoading={page.isPending}
      isFetching={page.isFetching && !page.isPending}
      error={page.isError ? (page.error?.message ?? 'Activity could not be loaded.') : null}
      onRetry={() => void page.refetch()}
      onNavigate={(href) => void navigate({ to: href })}
    />
  )
}

/**
 * The trail's window. A custom range runs from the start of its first day to
 * the end of its last, in local time; a missing end is now, a missing start
 * thirty days before the end.
 */
function windowFor(
  range: ActivityRange,
  from?: string,
  to?: string,
): { start: string; end: string } {
  if (range === 'custom') {
    const end = to ? new Date(`${to}T23:59:59.999`) : new Date()
    const start = from ? new Date(`${from}T00:00:00`) : new Date(end.getTime() - RANGE_MS['30d'])
    return { start: start.toISOString(), end: end.toISOString() }
  }
  const end = new Date()
  return {
    start: new Date(end.getTime() - RANGE_MS[range]).toISOString(),
    end: end.toISOString(),
  }
}

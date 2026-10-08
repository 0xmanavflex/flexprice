import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCustomers, useUsageAnalytics, UsageWindowSize } from '@fp/query'
import type { UsageAnalytics } from '@fp/query'
import { CustomerSortField } from '@fp/domain'
import type { Customer } from '@fp/domain'
import { DashboardHome } from '@fp/ui/pages'
import type { CustomersPanel, EventsPanel, FilterOption } from '@fp/ui/pages'

/**
 * Home — the console overview, wired to what the API can actually answer.
 *
 * `DashboardHome` is presentational; it renders whatever panel status it is
 * handed. Choosing that status — ready, empty, or unavailable — is this
 * component's whole job, and the rule it follows is that a number reaches the
 * screen only if a request returned it.
 *
 * Two panels are read from live queries:
 *
 *   - **Usage ingestion and revenue** from `useUsageAnalytics`, the hook over
 *     `POST /events/analytics`: the only time-series the platform exposes.
 *   - **Customers** from `useCustomers`: the account total, plus new customers
 *     per day bucketed here by creation date.
 */

const DAY_MS = 86_400_000

interface RangeSpec extends FilterOption {
  days: number
}

const RANGES: RangeSpec[] = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
]

const GRANULARITIES: (FilterOption & { windowSize: UsageWindowSize })[] = [
  { id: 'hourly', label: 'Hourly', windowSize: UsageWindowSize.Hour },
  { id: 'daily', label: 'Daily', windowSize: UsageWindowSize.Day },
  { id: 'weekly', label: 'Weekly', windowSize: UsageWindowSize.Week },
]

const ALL_CUSTOMERS = 'all'

/** Midnight UTC `daysAgo` days back — the boundary every window is cut on. */
function dayStart(daysAgo: number): Date {
  const date = new Date(Date.now() - daysAgo * DAY_MS)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

const dayLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const hourLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })

export function HomePage() {
  const navigate = useNavigate()
  const [rangeId, setRangeId] = useState('7d')
  const [granularityId, setGranularityId] = useState('daily')
  const [customerId, setCustomerId] = useState(ALL_CUSTOMERS)

  const range = RANGES.find((entry) => entry.id === rangeId) ?? RANGES[0]!
  const granularity = GRANULARITIES.find((entry) => entry.id === granularityId) ?? GRANULARITIES[1]!

  /*
   * Both windows are derived from one `now` per render pass, so the current and
   * prior windows are exactly adjacent and the same width. Two independent
   * `Date.now()` calls would leave a sliver of time in neither.
   */
  const windows = useMemo(() => {
    const end = new Date()
    const start = dayStart(range.days)
    const priorEnd = start
    const priorStart = new Date(start.getTime() - range.days * DAY_MS)
    return { current: { start, end }, prior: { start: priorStart, end: priorEnd } }
  }, [range.days])

  // Customers for the filter. One page is plenty for a picker.
  const customers = useCustomers({
    page: 1,
    pageSize: 50,
    search: '',
    statuses: [],
    sortBy: 'name',
    sortDirection: 'asc',
  })

  const externalCustomerId =
    customerId === ALL_CUSTOMERS
      ? undefined
      : (customers.data?.customers.find((entry) => entry.id === customerId)?.externalId ??
        undefined)

  const analytics = useUsageAnalytics({
    window: windows.current,
    windowSize: granularity.windowSize,
    ...(externalCustomerId !== undefined ? { externalCustomerId } : {}),
  })

  // Newest first, so every customer created inside the window is on this page
  // once the rows run out of it — which makes counting them here exact.
  const recentCustomers = useCustomers({
    page: 1,
    pageSize: 100,
    search: '',
    statuses: [],
    sortBy: CustomerSortField.CreatedAt,
    sortDirection: 'desc',
  })

  const eventsPanel = useMemo<EventsPanel>(
    () => toEventsPanel(analytics.data, analytics.isPending, analytics.isError, granularityId),
    [analytics.data, analytics.isPending, analytics.isError, granularityId],
  )

  const customersPanel = useMemo<CustomersPanel>(
    () =>
      toCustomersPanel(
        recentCustomers.data?.customers ?? [],
        recentCustomers.data?.total ?? null,
        windows.current.start,
        range.days,
        recentCustomers.isPending,
        recentCustomers.isError,
      ),
    [recentCustomers.data, recentCustomers.isPending, recentCustomers.isError, windows, range.days],
  )

  const customerOptions: FilterOption[] = [
    { id: ALL_CUSTOMERS, label: 'All customers' },
    ...(customers.data?.customers ?? []).map((entry) => ({ id: entry.id, label: entry.name })),
  ]

  return (
    <DashboardHome
      rangeOptions={RANGES.map(({ id, label }) => ({ id, label }))}
      range={rangeId}
      onRangeChange={setRangeId}
      granularityOptions={GRANULARITIES.map(({ id, label }) => ({ id, label }))}
      granularity={granularityId}
      onGranularityChange={setGranularityId}
      customerOptions={customerOptions}
      customer={customerId}
      onCustomerChange={setCustomerId}
      rangeLabel={range.label.toLowerCase()}
      events={eventsPanel}
      customers={customersPanel}
      onNavigate={(path) => void navigate({ to: path, search: {} as never })}
    />
  )
}

/* ---- Shaping the panels -------------------------------------------------- */

function toEventsPanel(
  data: UsageAnalytics | undefined,
  isPending: boolean,
  isError: boolean,
  granularityId: string,
): EventsPanel {
  if (isError) return { status: 'unavailable', points: [], total: null, revenue: null }
  if (isPending || data === undefined) {
    return { status: 'loading', points: [], total: null, revenue: null }
  }
  if (data.points.length === 0) {
    return { status: 'empty', points: [], total: null, revenue: null }
  }

  const format = granularityId === 'hourly' ? hourLabel : dayLabel

  return {
    status: 'ready',
    points: data.points.map((point) => ({
      label: format.format(point.timestamp),
      events: point.eventCount,
    })),
    total: data.eventCount,
    revenue: data.revenue,
  }
}

function toCustomersPanel(
  rows: Customer[],
  total: number | null,
  windowStart: Date,
  days: number,
  isPending: boolean,
  isError: boolean,
): CustomersPanel {
  if (isError) return { status: 'unavailable', total: null, points: [] }
  if (isPending) return { status: 'loading', total: null, points: [] }
  if (rows.length === 0) return { status: 'empty', total: total ?? 0, points: [] }

  const points = Array.from({ length: days + 1 }, (_, index) => {
    const start = new Date(windowStart.getTime() + index * DAY_MS)
    const end = new Date(start.getTime() + DAY_MS)
    return {
      label: dayLabel.format(start),
      customers: rows.filter(
        (row) => row.createdAt !== null && row.createdAt >= start && row.createdAt < end,
      ).length,
    }
  })

  return { status: 'ready', total, points }
}

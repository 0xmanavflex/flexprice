import { useMemo } from 'react'
import { DEFAULT_CUSTOMER_QUERY } from '@fp/domain'
import {
  useCustomerNames,
  useCustomerRevenue,
  useCustomers,
  useRecognizedThrough,
  useRevenueRecognitionEnabled,
} from '@fp/query'
import { RevenueRecognitionReport } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import {
  revenueRecognitionMonths,
  type RevenueRecognitionSearch,
} from '@/app/revenueRecognitionSearch'
import { toListFailure } from '@/pages/shared/listFailure'

const monthFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const MONTH_OPTIONS = revenueRecognitionMonths().map((id) => ({
  id,
  label: monthFormat.format(new Date(`${id}-01T00:00:00Z`)),
}))
/** Customers a search may narrow the report to. */
const SEARCH_LIMIT = 100

/** Revenue › Revenue recognition: revenue per customer × month, in USD. */
export function RevenueRecognitionPage({
  search,
  onSearchChange,
  onOpenCustomer,
}: {
  search: RevenueRecognitionSearch
  onSearchChange: (next: RevenueRecognitionSearch) => void
  onOpenCustomer: (customerId: string) => void
}) {
  const { environmentId } = useSession()
  const enabled = useRevenueRecognitionEnabled(environmentId)
  // A name search becomes the matching customers' ids, which the report filters by.
  const matches = useCustomers(
    {
      ...DEFAULT_CUSTOMER_QUERY,
      search: search.search,
      statuses: [],
      filters: [],
      pageSize: SEARCH_LIMIT,
    },
    { enabled: search.search !== '' },
  )
  const customerIds = search.search
    ? matches.data?.customers.map((customer) => customer.id)
    : undefined
  const noMatch = customerIds?.length === 0
  const revenue = useCustomerRevenue(
    enabled.data && !noMatch && (!search.search || customerIds) ? environmentId : null,
    { ...search, currency: 'USD', customerIds },
  )
  const ids = useMemo(() => (revenue.data?.rows ?? []).map((row) => row.id), [revenue.data])
  const names = useCustomerNames(ids)
  const recognizedThrough = useRecognizedThrough(enabled.data ? environmentId : null)
  const failure = toListFailure(enabled.error ?? matches.error ?? revenue.error, 'revenue')

  return (
    <RevenueRecognitionReport
      waterfall={enabled.data === false || noMatch ? undefined : revenue.data}
      recognizedThrough={recognizedThrough.data}
      customerNames={names.data ?? {}}
      isLoading={
        enabled.isPending ||
        (Boolean(search.search) && matches.isPending) ||
        (Boolean(enabled.data) && !noMatch && revenue.isPending)
      }
      error={
        enabled.data === false
          ? 'Revenue recognition is off for this environment.'
          : (failure?.message ?? null)
      }
      onRetry={() => void (enabled.error ? enabled.refetch() : revenue.refetch())}
      search={search.search}
      onSearchChange={(next) => onSearchChange({ ...search, search: next, page: 1 })}
      from={search.from}
      to={search.to}
      monthOptions={MONTH_OPTIONS}
      onRangeChange={(range) => onSearchChange({ ...search, ...range, page: 1 })}
      details={search.details}
      onDetailsChange={(details) => onSearchChange({ ...search, details })}
      page={search.page}
      pageSize={search.pageSize}
      onPageChange={(page) => onSearchChange({ ...search, page })}
      onOpenCustomer={onOpenCustomer}
    />
  )
}

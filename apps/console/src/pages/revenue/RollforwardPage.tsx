import { useMemo, useState } from 'react'
import { DEFAULT_CUSTOMER_QUERY, type RollforwardAccount, type RollforwardRow } from '@fp/domain'
import {
  useAccountEntries,
  useCustomerNames,
  useCustomers,
  useRevenueContracts,
  useRevenueRecognitionEnabled,
  useRollforward,
  useSubscriptionContract,
  useSubscriptionInvoices,
} from '@fp/query'
import { AccountRollforward } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { rollforwardPeriods, type RollforwardSearch } from '@/app/rollforwardSearch'
import { toListFailure } from '@/pages/shared/listFailure'

const monthFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const PERIOD_OPTIONS = rollforwardPeriods().map((id) => ({
  id,
  label: monthFormat.format(new Date(`${id}-01T00:00:00Z`)),
}))
const PAGE_SIZE = 50
/** Customers a search may narrow the report to. */
const SEARCH_LIMIT = 100

/** Revenue › Deferred or Unbilled rollforward: one ended month of the account, in USD. */
export function RollforwardPage({
  account,
  search,
  onSearchChange,
  onOpenCustomer,
  onOpenInvoice,
  onOpenSubscription,
}: {
  account: RollforwardAccount
  search: RollforwardSearch
  onSearchChange: (next: RollforwardSearch) => void
  onOpenCustomer: (customerId: string) => void
  onOpenInvoice: (invoiceId: string) => void
  onOpenSubscription: (subscriptionId: string) => void
}) {
  const { environmentId } = useSession()
  const [selected, setSelected] = useState<RollforwardRow | null>(null)
  const enabled = useRevenueRecognitionEnabled(environmentId)
  const term = search.search
  // A subscription id narrows the report to its contract; any other term matches customer names.
  const byContract = useSubscriptionContract(enabled.data ? environmentId : null, term)
  const matches = useCustomers(
    {
      ...DEFAULT_CUSTOMER_QUERY,
      search: term,
      statuses: [],
      filters: [],
      pageSize: SEARCH_LIMIT,
    },
    { enabled: term !== '' },
  )
  const contractIds = byContract.data ? [byContract.data.id] : undefined
  const customerIds =
    term && !contractIds ? matches.data?.customers.map((customer) => customer.id) : undefined
  const resolved = !term || Boolean(byContract.data) || (!byContract.isPending && !!matches.data)
  const noMatch = Boolean(term) && resolved && !contractIds && customerIds?.length === 0
  const rollforward = useRollforward(enabled.data && resolved && !noMatch ? environmentId : null, {
    account,
    period: search.period,
    currency: 'USD',
    page: search.page,
    pageSize: PAGE_SIZE,
    customerIds,
    contractIds,
  })
  const rows = rollforward.data?.rows
  const customerIdsOnPage = useMemo(
    () => (rows ?? []).flatMap((row) => (row.customerId ? [row.customerId] : [])),
    [rows],
  )
  const contractIdsOnPage = useMemo(
    () => (rows ?? []).flatMap((row) => (row.contractId ? [row.contractId] : [])),
    [rows],
  )
  const names = useCustomerNames(customerIdsOnPage)
  const contracts = useRevenueContracts(environmentId, contractIdsOnPage)

  const subscriptionId =
    (selected?.contractId ? contracts.data?.[selected.contractId]?.subscriptionId : null) ?? ''
  const invoices = useSubscriptionInvoices(subscriptionId)
  const entries = useAccountEntries(environmentId, {
    contractId: selected?.contractId ?? null,
    account,
    period: search.period,
    currency: 'USD',
  })
  const failure = toListFailure(enabled.error ?? matches.error ?? rollforward.error, 'revenue')

  return (
    <AccountRollforward
      account={account}
      rollforward={enabled.data === false || noMatch ? undefined : rollforward.data}
      customerNames={names.data ?? {}}
      contracts={contracts.data ?? {}}
      isLoading={
        enabled.isPending ||
        (Boolean(term) && !resolved) ||
        (Boolean(enabled.data) && !noMatch && rollforward.isPending)
      }
      error={
        enabled.data === false
          ? 'Revenue recognition is off for this environment.'
          : (failure?.message ?? null)
      }
      onRetry={() => void (enabled.error ? enabled.refetch() : rollforward.refetch())}
      search={search.search}
      onSearchChange={(next) => onSearchChange({ ...search, search: next, page: 1 })}
      period={search.period}
      periodOptions={PERIOD_OPTIONS}
      onPeriodChange={(period) => onSearchChange({ ...search, period, page: 1 })}
      page={search.page}
      pageSize={PAGE_SIZE}
      onPageChange={(page) => onSearchChange({ ...search, page })}
      onOpenCustomer={onOpenCustomer}
      selected={selected}
      onSelect={setSelected}
      entries={entries.data}
      entriesLoading={Boolean(selected) && entries.isPending}
      entriesError={toListFailure(entries.error, 'journal entries')?.message ?? null}
      invoiceNumbers={Object.fromEntries(
        (invoices.data ?? []).map((invoice) => [invoice.id, invoice.number]),
      )}
      onOpenInvoice={onOpenInvoice}
      onOpenSubscription={onOpenSubscription}
    />
  )
}

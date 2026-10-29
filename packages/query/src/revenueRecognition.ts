import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  ApiError,
  ErrorKind,
  SettingKey,
  fetchPerformanceObligations,
  fetchRecognizedThrough,
  fetchRevenueContract,
  fetchRevenueWaterfall,
  fetchRollforward,
  getSetting,
  searchJournalEntries,
  searchRevenueContracts,
  type JournalEntryWire,
  type PerformanceObligationWire,
  type RevenueContractWire,
  type RevenueWaterfallWire,
  type RollforwardRowWire,
  type RollforwardWire,
  type WaterfallCellWire,
} from '@fp/api'
import {
  AMORTIZATION_METHOD_LABEL,
  RECOGNITION_METHOD_LABEL,
  addMonths,
  money,
  revenuePeriods,
  type AmortizationMethod,
  type ContractJournal,
  type JournalEntry,
  type Money,
  type PerformanceObligation,
  type RecognitionMethod,
  type RevenueContract,
  type RevenueMonth,
  type RevenueWaterfall,
  type Rollforward,
  type RollforwardAccount,
  type RollforwardRow,
  type SubscriptionRevenue,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'
import { sumDecimals } from './revenue'

const DECIMAL = /^-?\d+(\.\d+)?$/
const amount = (value: string | null | undefined) =>
  value && DECIMAL.test(value.trim()) ? value.trim() : '0'

const date = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const oneOf = <T extends string>(labels: Record<T, string>, value: string | undefined): T | null =>
  value && value in labels ? (value as T) : null

export function toRevenueContract(wire: RevenueContractWire): RevenueContract {
  return {
    id: wire.id ?? '',
    customerId: wire.customer_id ?? '',
    currency: (wire.currency ?? 'usd').toUpperCase(),
    termStart: date(wire.term_start) ?? new Date(0),
    termEnd: date(wire.term_end),
    status: wire.contract_status ?? '',
    subscriptionId:
      (wire.associations ?? []).find((a) => a.entity_type === 'subscription')?.entity_id ?? null,
  }
}

export function toPerformanceObligation(wire: PerformanceObligationWire): PerformanceObligation {
  return {
    id: wire.id ?? '',
    name: wire.name ?? '',
    recognitionMethod: oneOf<RecognitionMethod>(RECOGNITION_METHOD_LABEL, wire.recognition_method),
    amortizationMethod: oneOf<AmortizationMethod>(
      AMORTIZATION_METHOD_LABEL,
      wire.amortization_method,
    ),
    serviceStart: date(wire.service_start) ?? new Date(0),
    serviceEnd: date(wire.service_end),
    status: wire.pob_status ?? '',
  }
}

function toRevenueMonth(wire: WaterfallCellWire, currency: string): RevenueMonth {
  const balance = (value: string | null | undefined) =>
    value == null ? null : money(amount(value), currency)
  return {
    period: wire.period ?? '',
    total: money(amount(wire.revenue?.total), currency),
    actual: money(amount(wire.revenue?.actual), currency),
    pending: money(amount(wire.revenue?.pending), currency),
    scheduled: money(amount(wire.revenue?.scheduled), currency),
    deferred: balance(wire.deferred),
    unbilled: balance(wire.unbilled),
  }
}

const sum = (amounts: Money[], currency: string) =>
  money(sumDecimals(amounts.map((m) => m.amount)), currency)

/** Wire to domain; row totals are exact sums of the months the server sent. */
export function toRevenueWaterfall(wire: RevenueWaterfallWire, currency: string): RevenueWaterfall {
  const totals = (wire.totals ?? []).map((cell) => toRevenueMonth(cell, currency))
  const rows = (wire.items ?? []).map((item) => {
    const months = (item.cells ?? []).map((cell) => toRevenueMonth(cell, currency))
    return {
      id: item.pob_id ?? item.customer_id ?? item.contract_id ?? '',
      months,
      total: sum(
        months.map((m) => m.total),
        currency,
      ),
      earned: sum(
        months.flatMap((m) => [m.actual, m.pending]),
        currency,
      ),
      scheduled: sum(
        months.map((m) => m.scheduled),
        currency,
      ),
    }
  })
  return {
    periods: totals.map((m) => m.period),
    rows,
    totals,
    total: sum(
      totals.map((m) => m.total),
      currency,
    ),
    count: wire.pagination?.total ?? rows.length,
  }
}

function useAuth() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return async (environmentId: string) => {
    const token = await auth.getToken()
    if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to see revenue.')
    return { serverURL, token, environmentId }
  }
}

/** Whether revenue recognition is on for the environment (`revenue_recognition_config`). */
export function useRevenueRecognitionEnabled(
  environmentId: string | null,
): UseQueryResult<boolean> {
  const authFor = useAuth()
  return useQuery({
    queryKey: queryKeys.revenueRecognition.enabled(environmentId),
    queryFn: async () => {
      const auth = await authFor(environmentId as string)
      const value = await getSetting(
        auth.serverURL,
        auth.token,
        auth.environmentId,
        SettingKey.RevenueRecognitionConfig,
      )
      return (value as { enabled?: unknown } | null)?.enabled === true
    },
    enabled: Boolean(environmentId),
    staleTime: 5 * 60_000,
  })
}

/**
 * A subscription's revenue: its revenue contract, the contract's POBs and the
 * POB × month waterfall over the contract term. Null when no contract exists yet.
 */
export function useSubscriptionRevenue(
  environmentId: string | null,
  subscriptionId: string,
): UseQueryResult<SubscriptionRevenue | null> {
  const authFor = useAuth()
  return useQuery({
    queryKey: queryKeys.revenueRecognition.subscription(environmentId, subscriptionId),
    queryFn: async () => {
      const auth = await authFor(environmentId as string)
      const [wire] = await searchRevenueContracts(auth, { subscription_ids: [subscriptionId] })
      if (!wire?.id) return null
      const contract = toRevenueContract(wire)
      const periods = revenuePeriods(contract.termStart, contract.termEnd)
      const [obligations, waterfall, recognizedThrough] = await Promise.all([
        fetchPerformanceObligations(auth, contract.id),
        fetchRevenueWaterfall(auth, {
          period_start: periods.start,
          period_end: periods.end,
          currency: contract.currency.toLowerCase(),
          group_by: 'pob_id',
          contract_ids: [contract.id],
          details: true,
          limit: 100,
        }),
        fetchRecognizedThrough(auth, [contract.id]),
      ])
      return {
        contract,
        obligations: obligations.map(toPerformanceObligation),
        waterfall: toRevenueWaterfall(waterfall, contract.currency),
        recognizedThrough: date(recognizedThrough),
      }
    },
    enabled: Boolean(environmentId && subscriptionId),
    // Payments and invoices post in the background; reopening the tab reads them.
    staleTime: 0,
  })
}

/** Wire to domain, oldest first, with both sides totalled; a malformed amount reads as zero. */
export function toContractJournal(wire: JournalEntryWire[], currency: string): ContractJournal {
  const entries: JournalEntry[] = wire.map((entry) => ({
    id: entry.id ?? '',
    date: date(entry.business_date) ?? new Date(0),
    eventType: entry.event_type ?? '',
    sourceType: entry.source_entity_type ?? '',
    sourceId: entry.source_entity_id ?? '',
    reversalOf: entry.reversal_of || null,
    lines: (entry.lines ?? []).map((line) => {
      const value = money(amount(line.amount), currency)
      return {
        id: line.id ?? '',
        account: line.account ?? '',
        debit: line.direction === 'debit' ? value : null,
        credit: line.direction === 'credit' ? value : null,
        pobId: line.pob_id || null,
      }
    }),
  }))
  return toContractJournalTotals(entries, currency)
}

/** Entries with both sides totalled over their lines. */
function toContractJournalTotals(entries: JournalEntry[], currency: string): ContractJournal {
  const lines = entries.flatMap((entry) => entry.lines)
  return {
    entries,
    lineCount: lines.length,
    debits: sum(
      lines.flatMap((l) => (l.debit ? [l.debit] : [])),
      currency,
    ),
    credits: sum(
      lines.flatMap((l) => (l.credit ? [l.credit] : [])),
      currency,
    ),
  }
}

const JOURNAL_PAGE = 1000

/** Every journal entry of a revenue contract; a contract holds hundreds at most, so all pages are read. */
export function useContractJournal(
  environmentId: string | null,
  contract: { id: string; currency: string } | undefined,
): UseQueryResult<ContractJournal> {
  const contractId = contract?.id
  const authFor = useAuth()
  return useQuery({
    queryKey: queryKeys.revenueRecognition.journal(environmentId, contractId ?? ''),
    queryFn: async () => {
      const auth = await authFor(environmentId as string)
      const entries: JournalEntryWire[] = []
      for (let offset = 0; ; offset += JOURNAL_PAGE) {
        const page = await searchJournalEntries(
          auth,
          { contract_ids: [contractId as string] },
          {
            limit: JOURNAL_PAGE,
            offset,
          },
        )
        entries.push(...page.items)
        if (page.items.length < JOURNAL_PAGE || entries.length >= page.total) break
      }
      return toContractJournal(entries, contract?.currency ?? 'USD')
    },
    enabled: Boolean(environmentId && contractId),
    // Payments and invoices post in the background; reopening the tab reads them.
    staleTime: 0,
  })
}

export interface CustomerRevenueQuery {
  /** `YYYY-MM`, inclusive. */
  from: string
  to: string
  currency: string
  /** 1-based. */
  page: number
  pageSize: number
  /** Only these customers; absent for every customer. */
  customerIds?: string[] | undefined
}

/** Revenue per customer × month for the environment, one page of customers; totals cover every customer. */
export function useCustomerRevenue(
  environmentId: string | null,
  query: CustomerRevenueQuery,
): UseQueryResult<RevenueWaterfall> {
  const authFor = useAuth()
  return useQuery({
    queryKey: queryKeys.revenueRecognition.customers(environmentId, { ...query }),
    queryFn: async () => {
      const auth = await authFor(environmentId as string)
      const wire = await fetchRevenueWaterfall(auth, {
        period_start: query.from,
        period_end: query.to,
        currency: query.currency.toLowerCase(),
        group_by: 'customer_id',
        ...(query.customerIds ? { customer_ids: query.customerIds } : {}),
        details: true,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      })
      return toRevenueWaterfall(wire, query.currency.toUpperCase())
    },
    enabled: Boolean(environmentId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
}

function toRollforwardRow(wire: RollforwardRowWire, currency: string): RollforwardRow {
  const movements = wire.movements ?? {}
  const other = Object.entries(movements)
    .filter(([category]) => category !== 'invoiced' && category !== 'earned')
    .map(([, value]) => amount(value))
  return {
    customerId: wire.customer_id || null,
    contractId: wire.contract_id || null,
    opening: money(amount(wire.opening), currency),
    invoiced: money(amount(movements['invoiced']), currency),
    earned: money(amount(movements['earned']), currency),
    adjustments: money(sumDecimals(other.length ? other : ['0']), currency),
    closing: money(amount(wire.closing), currency),
  }
}

/** Wire to domain for one month and one account. */
export function toRollforward(
  wire: RollforwardWire,
  period: string,
  currency: string,
): Rollforward {
  const [totals] = wire.totals ?? []
  return {
    period,
    totals: totals ? toRollforwardRow(totals, currency) : null,
    rows: (wire.items ?? []).map((row) => toRollforwardRow(row, currency)),
    count: wire.pagination?.total ?? 0,
  }
}

export interface RollforwardQuery {
  account: RollforwardAccount
  /** An ended month, `YYYY-MM`. */
  period: string
  currency: string
  /** 1-based. */
  page: number
  pageSize: number
  /** Only these customers; absent for every customer. */
  customerIds?: string[] | undefined
  /** Only these contracts; absent for every contract. */
  contractIds?: string[] | undefined
}

/** One ended month of an account, totalled and per customer × contract. */
export function useRollforward(
  environmentId: string | null,
  query: RollforwardQuery,
): UseQueryResult<Rollforward> {
  const authFor = useAuth()
  return useQuery({
    queryKey: queryKeys.revenueRecognition.rollforward(environmentId, { ...query }),
    queryFn: async () => {
      const auth = await authFor(environmentId as string)
      const wire = await fetchRollforward(auth, {
        period_start: query.period,
        period_end: query.period,
        currency: query.currency.toLowerCase(),
        accounts: [query.account],
        group_by: ['customer_id', 'contract_id'],
        ...(query.customerIds ? { customer_ids: query.customerIds } : {}),
        ...(query.contractIds ? { contract_ids: query.contractIds } : {}),
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      })
      return toRollforward(wire, query.period, query.currency.toUpperCase())
    },
    enabled: Boolean(environmentId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
}

/**
 * Revenue contracts by id, with their terms and subscriptions. Contract search leaves associations
 * out, so each is read on its own, in parallel: a page holds at most 50.
 */
export function useRevenueContracts(
  environmentId: string | null,
  contractIds: readonly string[],
): UseQueryResult<Readonly<Record<string, RevenueContract>>> {
  const authFor = useAuth()
  const ids = [...new Set(contractIds)].sort()
  return useQuery({
    queryKey: queryKeys.revenueRecognition.contracts(environmentId, ids),
    queryFn: async () => {
      const auth = await authFor(environmentId as string)
      const wires = await Promise.all(ids.map((id) => fetchRevenueContract(auth, id)))
      return Object.fromEntries(wires.map((wire) => [wire.id ?? '', toRevenueContract(wire)]))
    },
    enabled: Boolean(environmentId) && ids.length > 0,
    staleTime: 5 * 60_000,
  })
}

/** The last month-end recognized in the environment; null before the first recognition run. */
export function useRecognizedThrough(environmentId: string | null): UseQueryResult<Date | null> {
  const authFor = useAuth()
  return useQuery({
    queryKey: queryKeys.revenueRecognition.recognizedThrough(environmentId),
    queryFn: async () => date(await fetchRecognizedThrough(await authFor(environmentId as string))),
    enabled: Boolean(environmentId),
    staleTime: 5 * 60_000,
  })
}

/** A contract's entries on one account in one month, with only that account's lines. */
export function useAccountEntries(
  environmentId: string | null,
  query: {
    contractId: string | null
    account: RollforwardAccount
    period: string
    currency: string
  },
): UseQueryResult<ContractJournal> {
  const authFor = useAuth()
  return useQuery({
    queryKey: queryKeys.revenueRecognition.entries(environmentId, { ...query }),
    queryFn: async () => {
      const auth = await authFor(environmentId as string)
      const start = `${query.period}-01T00:00:00Z`
      const end = `${addMonths(query.period, 1)}-01T00:00:00Z`
      const page = await searchJournalEntries(
        auth,
        {
          contract_ids: [query.contractId as string],
          accounts: [query.account],
          start_time: start,
          end_time: end,
        },
        { limit: JOURNAL_PAGE, offset: 0 },
      )
      const journal = toContractJournal(page.items, query.currency.toUpperCase())
      const entries = journal.entries.map((entry) => ({
        ...entry,
        lines: entry.lines.filter((line) => line.account === query.account),
      }))
      return toContractJournalTotals(entries, query.currency.toUpperCase())
    },
    enabled: Boolean(environmentId && query.contractId),
    staleTime: 60_000,
  })
}

/** The revenue contract behind a subscription id, or null when the id is not one. */
export function useSubscriptionContract(
  environmentId: string | null,
  subscriptionId: string,
): UseQueryResult<RevenueContract | null> {
  const authFor = useAuth()
  return useQuery({
    queryKey: queryKeys.revenueRecognition.subscriptionContract(environmentId, subscriptionId),
    queryFn: async () => {
      const auth = await authFor(environmentId as string)
      const [wire] = await searchRevenueContracts(auth, { subscription_ids: [subscriptionId] })
      return wire?.id ? toRevenueContract(wire) : null
    },
    enabled: Boolean(environmentId && subscriptionId),
    staleTime: 5 * 60_000,
  })
}

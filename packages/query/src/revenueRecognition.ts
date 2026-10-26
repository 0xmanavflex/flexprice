import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  ApiError,
  ErrorKind,
  SettingKey,
  fetchPerformanceObligations,
  fetchRevenueWaterfall,
  getSetting,
  searchJournalEntries,
  searchRevenueContracts,
  type JournalEntryWire,
  type PerformanceObligationWire,
  type RevenueContractWire,
  type RevenueWaterfallWire,
  type WaterfallCellWire,
} from '@fp/api'
import {
  AMORTIZATION_METHOD_LABEL,
  RECOGNITION_METHOD_LABEL,
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
      pobId: item.pob_id ?? '',
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
      const [wire] = await searchRevenueContracts(auth, [subscriptionId])
      if (!wire?.id) return null
      const contract = toRevenueContract(wire)
      const periods = revenuePeriods(contract.termStart, contract.termEnd)
      const [obligations, waterfall] = await Promise.all([
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
      ])
      return {
        contract,
        obligations: obligations.map(toPerformanceObligation),
        waterfall: toRevenueWaterfall(waterfall, contract.currency),
      }
    },
    enabled: Boolean(environmentId && subscriptionId),
    staleTime: 60_000,
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
        const page = await searchJournalEntries(auth, contractId as string, {
          limit: JOURNAL_PAGE,
          offset,
        })
        entries.push(...page.items)
        if (page.items.length < JOURNAL_PAGE || entries.length >= page.total) break
      }
      return toContractJournal(entries, contract?.currency ?? 'USD')
    },
    enabled: Boolean(environmentId && contractId),
    staleTime: 60_000,
  })
}

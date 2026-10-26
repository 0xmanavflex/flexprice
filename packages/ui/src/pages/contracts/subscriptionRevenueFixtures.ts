import {
  money,
  type ContractJournal,
  type JournalEntry,
  type JournalLine,
  type RevenueMonth,
  type SubscriptionRevenue,
} from '@fp/domain'

const usd = (amount: string) => money(amount, 'USD')

const month = (
  period: string,
  parts: { actual?: string; pending?: string; scheduled?: string; total: string },
  balances?: { deferred: string; unbilled: string },
): RevenueMonth => ({
  period,
  total: usd(parts.total),
  actual: usd(parts.actual ?? '0'),
  pending: usd(parts.pending ?? '0'),
  scheduled: usd(parts.scheduled ?? '0'),
  deferred: balances ? usd(balances.deferred) : null,
  unbilled: balances ? usd(balances.unbilled) : null,
})

const LATER = [
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
  '2026-11',
  '2026-12',
]

/**
 * Acme on Mar 15 2026: $1,200/year prepaid (Line A) and $100/month in advance
 * (Line B), invoiced Jan 1, Feb 1 and Mar 1. Jan–Feb posted, March half earned.
 */
export const ACME_REVENUE: SubscriptionRevenue = {
  contract: {
    id: 'contract_acme',
    customerId: 'cust_acme',
    currency: 'USD',
    termStart: new Date('2026-01-01T00:00:00Z'),
    termEnd: new Date('2027-01-01T00:00:00Z'),
    status: 'active',
  },
  obligations: [
    {
      id: 'pob_annual',
      name: 'Platform licence',
      recognitionMethod: 'straight_line',
      amortizationMethod: 'period_even',
      serviceStart: new Date('2026-01-01T00:00:00Z'),
      serviceEnd: new Date('2027-01-01T00:00:00Z'),
      status: 'active',
    },
    {
      id: 'pob_monthly',
      name: 'Support',
      recognitionMethod: 'straight_line',
      amortizationMethod: 'period_even_prorated',
      serviceStart: new Date('2026-01-01T00:00:00Z'),
      serviceEnd: new Date('2027-01-01T00:00:00Z'),
      status: 'active',
    },
  ],
  waterfall: {
    periods: ['2026-01', '2026-02', '2026-03', ...LATER],
    rows: [
      {
        pobId: 'pob_annual',
        months: [
          month('2026-01', { actual: '100', total: '100' }, { deferred: '1100', unbilled: '0' }),
          month('2026-02', { actual: '100', total: '100' }, { deferred: '1000', unbilled: '0' }),
          month('2026-03', { pending: '45.16', scheduled: '54.84', total: '100' }),
          ...LATER.map((p) => month(p, { scheduled: '100', total: '100' })),
        ],
        total: usd('1200'),
        earned: usd('245.16'),
        scheduled: usd('954.84'),
      },
      {
        pobId: 'pob_monthly',
        months: [
          month('2026-01', { actual: '100', total: '100' }, { deferred: '0', unbilled: '0' }),
          month('2026-02', { actual: '100', total: '100' }, { deferred: '0', unbilled: '0' }),
          month('2026-03', { pending: '45.16', scheduled: '54.84', total: '100' }),
          ...LATER.map((p) => month(p, { total: '0' })),
        ],
        total: usd('300'),
        earned: usd('245.16'),
        scheduled: usd('54.84'),
      },
    ],
    totals: [
      month('2026-01', { actual: '200', total: '200' }, { deferred: '1100', unbilled: '0' }),
      month('2026-02', { actual: '200', total: '200' }, { deferred: '1000', unbilled: '0' }),
      month('2026-03', { pending: '90.32', scheduled: '109.68', total: '200' }),
      ...LATER.map((p) => month(p, { scheduled: '100', total: '100' })),
    ],
    total: usd('1500'),
  },
}

const line = (
  id: string,
  account: string,
  side: 'debit' | 'credit',
  amount: string,
  pobId: string | null = null,
): JournalLine => ({
  id,
  account,
  debit: side === 'debit' ? usd(amount) : null,
  credit: side === 'credit' ? usd(amount) : null,
  pobId,
})

const entry = (
  id: string,
  date: string,
  eventType: string,
  source: [string, string],
  lines: JournalLine[],
): JournalEntry => ({
  id,
  date: new Date(`${date}T00:00:00Z`),
  eventType,
  sourceType: source[0],
  sourceId: source[1],
  reversalOf: null,
  lines,
})

/** Acme's January: the Jan 1 invoice, then January's revenue for both POBs. */
export const ACME_JOURNAL: ContractJournal = {
  entries: [
    entry(
      'je_1',
      '2026-01-01',
      'invoice_finalized',
      ['invoice', 'inv_jan'],
      [
        line('1', 'accounts_receivable', 'debit', '1300'),
        line('2', 'deferred_revenue', 'credit', '1200', 'pob_annual'),
        line('3', 'deferred_revenue', 'credit', '100', 'pob_monthly'),
      ],
    ),
    entry(
      'je_2',
      '2026-01-31',
      'revenue_earned',
      ['pob', 'pob_annual'],
      [
        line('4', 'deferred_revenue', 'debit', '100', 'pob_annual'),
        line('5', 'revenue', 'credit', '100', 'pob_annual'),
      ],
    ),
    entry(
      'je_3',
      '2026-01-31',
      'revenue_earned',
      ['pob', 'pob_monthly'],
      [
        line('6', 'deferred_revenue', 'debit', '100', 'pob_monthly'),
        line('7', 'revenue', 'credit', '100', 'pob_monthly'),
      ],
    ),
  ],
  lineCount: 7,
  debits: usd('1500'),
  credits: usd('1500'),
}

export const ACME_POB_NAMES = { pob_annual: 'Platform licence', pob_monthly: 'Support' }

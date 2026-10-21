import type { SelfBillingSummary } from '@fp/domain'

/** Today in every self-billing story: the prototype's Oct 20, 2026. */
export const TODAY = '2026-10-20'

const TRIAL: SelfBillingSummary = {
  state: 'trialing',
  trialEndsOn: '2026-11-04',
  invoices: [],
  events: { used: 31_240, cap: 50_000 },
  billed: 0,
  period: { start: '2026-10-05', end: '2026-11-04' },
}

/** One summary per account state the handoff draws. */
export const ACCOUNTS = {
  trial: TRIAL,
  ending: { ...TRIAL, trialEndsOn: '2026-10-23' },
  near: { ...TRIAL, events: { used: 46_500, cap: 50_000 } },
  lockedEvents: { ...TRIAL, state: 'suspended', events: { used: 51_870, cap: 50_000 } },
  lockedTrial: {
    ...TRIAL,
    state: 'suspended',
    trialEndsOn: '2026-10-10',
    events: { used: 46_900, cap: 50_000 },
    period: { start: '2026-10-10', end: '2026-11-10' },
    invoices: [
      {
        id: 'inv_s1',
        number: 'FP-0001',
        status: 'overdue',
        total: 199,
        currency: 'USD',
        dueDate: '2026-10-10',
        pdfUrl: null,
      },
    ],
  },
  live: {
    state: 'active',
    trialEndsOn: null,
    events: { used: 12_480_000, cap: null },
    billed: 184_200,
    period: { start: '2026-10-01', end: '2026-10-31' },
    invoices: [
      {
        id: 'inv_3',
        number: 'FP-0003',
        status: 'paid',
        total: 1_041.5,
        currency: 'USD',
        dueDate: '2026-10-01',
        pdfUrl: 'https://example.com/fp-0003.pdf',
      },
      {
        id: 'inv_2',
        number: 'FP-0002',
        status: 'paid',
        total: 902.75,
        currency: 'USD',
        dueDate: '2026-09-01',
        pdfUrl: 'https://example.com/fp-0002.pdf',
      },
    ],
  },
} satisfies Record<string, SelfBillingSummary>

export const DUE: SelfBillingSummary = {
  ...ACCOUNTS.live,
  invoices: [
    {
      id: 'inv_4',
      number: 'FP-0004',
      status: 'open',
      total: 1_120.25,
      currency: 'USD',
      dueDate: '2026-10-30',
      pdfUrl: null,
    },
    ...ACCOUNTS.live.invoices,
  ],
}

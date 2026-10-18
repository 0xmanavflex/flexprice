import { type HostedInvoice, money } from '@fp/domain'

const inr = (amount: string) => money(amount, 'INR')

/** An open invoice with two lines and a failed attempt, for the hosted invoice stories. */
export const DEMO_HOSTED_INVOICE: HostedInvoice = {
  tenant: { name: 'Paras', contactEmail: 'help@paras.test' },
  number: 'DSADDWUO-0001',
  state: 'open',
  currency: 'INR',
  total: inr('8800'),
  subtotal: inr('8800'),
  discount: null,
  tax: null,
  amountPaid: inr('0'),
  amountRemaining: inr('8800'),
  dueAt: new Date('2026-11-14T00:00:00Z'),
  paidAt: null,
  paidWith: null,
  customerName: 'FX G5 1791253409',
  memo: 'Invoice for advance charges - subscription subs_01M4BA1R31CJXYATYRTXKV82KY',
  lines: [
    { id: 'li_1', name: 'Platform fee', quantity: '1', amount: inr('8000') },
    { id: 'li_2', name: 'API calls', quantity: '4000', amount: inr('800') },
  ],
  payments: [
    { id: 'pay_1', amount: inr('8800'), status: 'FAILED', method: 'Card', at: new Date('2026-10-13T08:01:00Z') },
  ],
  payEnabled: true,
}

export const DEMO_PAID_HOSTED_INVOICE: HostedInvoice = {
  ...DEMO_HOSTED_INVOICE,
  state: 'paid',
  amountPaid: inr('8800'),
  amountRemaining: inr('0'),
  paidAt: new Date('2026-10-14T08:01:00Z'),
  paidWith: 'Stripe',
  payments: [
    ...DEMO_HOSTED_INVOICE.payments,
    { id: 'pay_2', amount: inr('8800'), status: 'SUCCEEDED', method: 'Stripe', at: new Date('2026-10-14T08:01:00Z') },
  ],
  payEnabled: false,
}

/** What a response with no customer, lines, payments or contact leaves. */
export const SPARSE_HOSTED_INVOICE: HostedInvoice = {
  ...DEMO_HOSTED_INVOICE,
  tenant: { name: 'Paras', contactEmail: null },
  customerName: null,
  memo: null,
  dueAt: null,
  lines: [],
  payments: [],
}

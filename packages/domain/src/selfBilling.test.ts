import { describe, expect, it } from 'vitest'
import {
  accountCopy,
  accountPill,
  checkoutOutcome,
  chargePriceText,
  lockReason,
  periodText,
  planFixedTotal,
  planPriceText,
  selfInvoiceStatus,
  type SelfBillingCharge,
  type SelfBillingPlan,
  type SelfBillingSummary,
} from './selfBilling'

const charge = (patch: Partial<SelfBillingCharge> = {}): SelfBillingCharge => ({
  id: 'price_base',
  name: 'Platform fee',
  type: 'fixed',
  amount: '199',
  currency: 'USD',
  billingPeriod: 'MONTHLY',
  billingPeriodCount: 1,
  divideBy: null,
  meterName: null,
  ...patch,
})
const PLAN: SelfBillingPlan = {
  id: 'plan_payg',
  name: 'Pay as you go',
  description: '',
  charges: [
    charge(),
    charge({
      id: 'price_usage',
      name: 'Billing fee',
      type: 'usage',
      amount: '0.005',
      meterName: 'Invoice value',
    }),
  ],
}

const TODAY = '2026-10-20'
const trial = (patch: Partial<SelfBillingSummary> = {}): SelfBillingSummary => ({
  state: 'trialing',
  plan: PLAN,
  trialEndsOn: '2026-11-04',
  invoices: [],
  events: { used: 31_240, cap: 50_000 },
  billed: 0,
  period: null,
  ...patch,
})

describe('accountPill', () => {
  it('counts the days left in a calm trial, in purple', () => {
    expect(accountPill(trial(), TODAY)).toEqual({ tone: 'trial', label: 'Trial · 15 days left' })
  })
  it('turns amber in the last 7 days', () => {
    expect(accountPill(trial({ trialEndsOn: '2026-10-23' }), TODAY)).toEqual({
      tone: 'urgent',
      label: 'Trial · 3 days left',
    })
  })
  it('says the share of events once past 80%, which wins over days', () => {
    expect(accountPill(trial({ events: { used: 46_500, cap: 50_000 } }), TODAY)).toEqual({
      tone: 'urgent',
      label: 'Trial · 93% of events',
    })
  })
  it('is red when locked, and gone once active', () => {
    expect(accountPill(trial({ state: 'suspended' }), TODAY)).toEqual({
      tone: 'locked',
      label: 'Account locked',
    })
    expect(accountPill(trial({ state: 'active' }), TODAY)).toBeNull()
  })
})

describe('accountCopy', () => {
  it('words each state as the spec does', () => {
    expect(accountCopy(trial(), TODAY)).toBe(
      'Ends on Nov 4, 2026, or at 50,000 events. Then $199.00 a month + $0.005 per Invoice value.',
    )
    expect(accountCopy(trial({ trialEndsOn: '2026-10-23' }), TODAY)).toBe(
      'Ends on Oct 23, 2026. After that your account becomes read-only.',
    )
    expect(accountCopy(trial({ events: { used: 46_500, cap: 50_000 } }), TODAY)).toBe(
      '93% of trial events used. At 50,000 your account becomes read-only.',
    )
    expect(accountCopy(trial({ state: 'suspended', trialEndsOn: '2026-10-10' }), TODAY)).toBe(
      'Your account is locked and read-only. Your trial ended on Oct 10.',
    )
    expect(
      accountCopy(trial({ state: 'suspended', events: { used: 51_870, cap: 50_000 } }), TODAY),
    ).toBe('Your account is locked and read-only. You used all 50,000 trial events.')
  })
})

describe('lockReason', () => {
  it('is the event limit when the cap is used up before the trial ends, else the trial end', () => {
    expect(lockReason(trial({ events: { used: 50_000, cap: 50_000 } }), TODAY)).toBe('event_limit')
    expect(lockReason(trial({ events: { used: 46_900, cap: 50_000 } }), TODAY)).toBe('trial_end')
    expect(lockReason(trial({ events: null }), TODAY)).toBe('trial_end')
    // The trial ended with a full cap: the API suspended an expired trial.
    expect(
      lockReason(
        trial({ trialEndsOn: '2026-10-10', events: { used: 51_000, cap: 50_000 } }),
        TODAY,
      ),
    ).toBe('trial_end')
  })
})

describe('selfInvoiceStatus', () => {
  it('is paid, open until due, then overdue', () => {
    expect(selfInvoiceStatus('SUCCEEDED', '2026-10-01', TODAY)).toBe('paid')
    expect(selfInvoiceStatus('PENDING', '2026-10-25', TODAY)).toBe('open')
    expect(selfInvoiceStatus('PENDING', '2026-10-10', TODAY)).toBe('overdue')
  })
})

describe('checkoutOutcome', () => {
  it('settles from the polled checkout and the way back', () => {
    expect(checkoutOutcome({ status: 'completed', terminal: true }, 'success', 0)).toBe('success')
    expect(checkoutOutcome({ status: 'failed', terminal: true }, 'success', 0)).toBe('failed')
    expect(checkoutOutcome({ status: 'pending', terminal: false }, 'failure', 0)).toBe('canceled')
    expect(checkoutOutcome({ status: 'pending', terminal: false }, 'success', 5_000)).toBe(
      'processing',
    )
    expect(checkoutOutcome(null, 'success', 61_000)).toBe('slow')
  })
})

describe('the plan, as the API reports it', () => {
  it('prices a fixed charge by its period', () => {
    expect(chargePriceText(charge())).toBe('$199.00 a month')
    expect(chargePriceText(charge({ billingPeriod: 'QUARTERLY' }))).toBe('$199.00 every 3 months')
    expect(chargePriceText(charge({ billingPeriod: '' }))).toBe('$199.00')
  })

  it('prices a usage charge per unit, or per the units it groups', () => {
    expect(chargePriceText(PLAN.charges[1]!)).toBe('$0.005 per Invoice value')
    expect(
      chargePriceText(charge({ type: 'usage', amount: '2', divideBy: 1000, meterName: 'API calls' })),
    ).toBe('$2.00 per 1,000 API calls')
  })

  it('joins the charges, and has nothing to say without a plan', () => {
    expect(planPriceText(PLAN)).toBe('$199.00 a month + $0.005 per Invoice value')
    expect(planPriceText(null)).toBeNull()
    expect(planPriceText({ ...PLAN, charges: [] })).toBeNull()
  })

  it('sums the flat fees: what an upgrade charges up front', () => {
    expect(planFixedTotal(PLAN)).toEqual({ amount: 199, currency: 'USD' })
    expect(planFixedTotal({ ...PLAN, charges: [PLAN.charges[1]!] })).toBeNull()
  })

  it('says when a period repeats', () => {
    expect(periodText('ANNUAL')).toBe('a year')
    expect(periodText('MONTHLY', 2)).toBe('every 2 months')
    expect(periodText('SOMETHING')).toBe('')
  })

  it('leaves the price out of the trial line when there is no plan', () => {
    expect(accountCopy(trial({ plan: null }), TODAY)).toBe(
      'Ends on Nov 4, 2026, or at 50,000 events.',
    )
  })
})

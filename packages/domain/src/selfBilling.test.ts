import { describe, expect, it } from 'vitest'
import {
  accountCopy,
  accountPill,
  checkoutOutcome,
  lockReason,
  selfInvoiceStatus,
  type SelfBillingSummary,
} from './selfBilling'

const TODAY = '2026-10-20'
const trial = (patch: Partial<SelfBillingSummary> = {}): SelfBillingSummary => ({
  state: 'trialing',
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
      'Ends on Nov 4, 2026, or at 50,000 events. Then $199.00 a month + 0.5% of what you bill through Flexprice.',
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

import { describe, expect, it } from 'vitest'
import {
  BillingCycle,
  BillingModel,
  type CreateSubscription,
  PriceType,
  emptyPhase,
  emptySubscription,
} from '@fp/domain'
import { makeCharge } from '../product-catalog/plans/planDetailFixtures'
import { everyPeriod, firstInvoiceEstimate, runsText } from './ContractSummary'

const TODAY = '2026-10-20'
const draft = (patch: Partial<CreateSubscription> = {}): CreateSubscription => ({
  ...emptySubscription(),
  customerId: 'cus_1',
  planId: 'plan_1',
  currency: 'USD',
  ...patch,
})
// $9 and $29 a month in advance, and a usage charge billed in arrears.
const seats = makeCharge(0, { type: PriceType.Fixed })
const platform = makeCharge(1, { type: PriceType.Fixed })
const usage = makeCharge(0, { type: PriceType.Usage })
const CHARGES = [seats, platform, usage]

describe('firstInvoiceEstimate', () => {
  it('waits for a plan and a currency', () => {
    expect(firstInvoiceEstimate(draft({ planId: '' }), CHARGES, TODAY)).toBeNull()
    expect(firstInvoiceEstimate(draft({ currency: '' }), CHARGES, TODAY)).toBeNull()
  })

  it('bills the fixed charges up front, on the start date, and leaves usage to the period end', () => {
    const estimate = firstInvoiceEstimate(draft(), CHARGES, TODAY)
    expect(estimate).toMatchObject({ amount: 38, date: TODAY })
    expect(estimate?.note).toMatch(/usage is billed at the end of the period/)
  })

  it('moves the invoice past the trial', () => {
    const estimate = firstInvoiceEstimate(draft({ trialPeriodDays: 14 }), CHARGES, TODAY)
    expect(estimate?.date).toBe('2026-11-03')
    expect(estimate?.note).toMatch(/^On Nov 3, 2026, after the 14-day trial\./)
  })

  it('counts quantities and flat-fee overrides on the first phase', () => {
    const estimate = firstInvoiceEstimate(
      draft({
        phases: [
          {
            ...emptyPhase(),
            quantities: [{ priceId: seats.id, quantity: '10' }],
            priceOverrides: [
              { priceId: platform.id, billingModel: BillingModel.FlatFee, amount: '100' },
            ],
          },
        ],
      }),
      CHARGES,
      TODAY,
    )
    expect(estimate?.amount).toBe(9 * 10 + 100)
  })

  it('says what it leaves out', () => {
    const estimate = firstInvoiceEstimate(
      draft({
        billingCycle: BillingCycle.Calendar,
        addons: [{ addonId: 'addon_1', name: 'Support' }],
      }),
      CHARGES,
      TODAY,
    )
    expect(estimate?.note).toMatch(/Before proration to the 1st, add-ons\.$/)
  })

  it('says when nothing bills up front', () => {
    expect(firstInvoiceEstimate(draft(), [usage], TODAY)?.note).toMatch(
      /Nothing is billed up front/,
    )
  })
})

describe('summary text', () => {
  it('reads the cadence and the run', () => {
    expect(everyPeriod('MONTHLY', 1)).toBe('every month')
    expect(everyPeriod('MONTHLY', 3)).toBe('every 3 months')
    expect(runsText(draft(), TODAY)).toBe('Oct 20, 2026 → until cancelled')
    expect(
      runsText(
        draft({ startDate: '2026-11-01', phases: [{ ...emptyPhase(), endDate: '2027-10-31' }] }),
        TODAY,
      ),
    ).toBe('Nov 1, 2026 → Oct 31, 2027')
  })
})

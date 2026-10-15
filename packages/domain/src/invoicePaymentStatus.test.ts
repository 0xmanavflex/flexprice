import { describe, expect, it } from 'vitest'
import { InvoiceStatus } from './invoice'
import { PaymentStatus } from './payment'
import {
  manualPaymentStatusBlocked,
  manualPaymentStatusChoices,
  toWirePaymentStatus,
} from './invoicePaymentStatus'

describe('manualPaymentStatusChoices', () => {
  it("follows the backend's transitions", () => {
    expect(manualPaymentStatusChoices(PaymentStatus.Pending)).toEqual([
      PaymentStatus.Succeeded,
      PaymentStatus.Failed,
      PaymentStatus.Overpaid,
      PaymentStatus.Pending,
    ])
    expect(manualPaymentStatusChoices(PaymentStatus.Succeeded)).toEqual([PaymentStatus.Overpaid])
    expect(manualPaymentStatusChoices(PaymentStatus.Overpaid)).toEqual([])
    expect(manualPaymentStatusChoices(PaymentStatus.Refunded)).toEqual([])
  })

  it('treats a missing status as pending', () => {
    expect(manualPaymentStatusChoices(null)).toContain(PaymentStatus.Succeeded)
  })
})

describe('manualPaymentStatusBlocked', () => {
  const open = {
    status: InvoiceStatus.Open,
    paymentStatus: PaymentStatus.Pending,
    succeededPayments: 0,
  }

  it('allows drafts and finalized invoices without payments', () => {
    expect(manualPaymentStatusBlocked(open)).toBeNull()
    expect(manualPaymentStatusBlocked({ ...open, status: InvoiceStatus.Draft })).toBeNull()
  })

  it('says why when it cannot', () => {
    expect(manualPaymentStatusBlocked({ ...open, status: InvoiceStatus.Void })).toMatch(/void/i)
    expect(manualPaymentStatusBlocked({ ...open, succeededPayments: 1 })).toMatch(/payments/i)
    expect(manualPaymentStatusBlocked({ ...open, paymentStatus: PaymentStatus.Overpaid })).toMatch(
      /no further/i,
    )
  })
})

it('sends the status uppercase', () => {
  expect(toWirePaymentStatus(PaymentStatus.Overpaid)).toBe('OVERPAID')
})

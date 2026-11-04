import { describe, expect, it } from 'vitest'
import { toInvoiceDetail } from '@fp/query'
import { invoiceLinesCsv } from './invoiceCsv'

describe('invoiceLinesCsv', () => {
  it("lists a contract invoice's charged lines with type and period, as V1 does", () => {
    const invoice = toInvoiceDetail({
      id: 'inv_1',
      currency: 'usd',
      subscriptionId: 'subs_1',
      lineItems: [
        {
          displayName: 'API calls, "metered"',
          priceType: 'USAGE',
          quantity: '1200',
          amount: '12.34',
          periodStart: new Date('2026-10-01T00:00:00Z'),
          periodEnd: new Date('2026-11-01T00:00:00Z'),
        },
        { displayName: 'Free tier', priceType: 'USAGE', quantity: '10', amount: '0' },
      ],
    })
    expect(invoiceLinesCsv(invoice).split('\r\n')).toEqual([
      'Display name,Price type,Billing period,Quantity,Amount,Currency',
      '"API calls, ""metered""",Usage,"Oct 1, 2026 – Nov 1, 2026",1200,12.34,USD',
    ])
  })

  it('leaves out price type and period on a one-off invoice', () => {
    const invoice = toInvoiceDetail({
      id: 'inv_2',
      currency: 'eur',
      lineItems: [{ displayName: 'Setup', quantity: '1', amount: '50' }],
    })
    expect(invoiceLinesCsv(invoice)).toBe('Display name,Quantity,Amount,Currency\r\nSetup,1,50,EUR')
  })
})

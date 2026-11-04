import { describe, expect, it } from 'vitest'
import { type CustomerDetail } from '@fp/domain'
import { toCharge, toInvoiceDetail, type InvoiceDetailWire } from '@fp/query'
import { toInvoiceDocument } from './invoiceDocumentAdapter'

const wire: InvoiceDetailWire = {
  id: 'inv_1',
  invoiceNumber: 'INV-202611-00008',
  customerId: 'cust_billing_math',
  // The API expands the contract's customer, not the one the invoice bills.
  customer: { id: 'cust_active_child', name: 'QA Active Child' },
  currency: 'usd',
  invoiceStatus: 'FINALIZED',
  description: 'Thanks for your business',
  lineItems: [
    {
      id: 'line_fixed',
      priceId: 'price_fixed',
      displayName: 'Contract-only fee',
      quantity: '3',
      amount: '7.04',
      metadata: { description: 'Billed per seat' },
    },
    { id: 'line_manual', displayName: 'Setup', quantity: '4', amount: '10' },
    { id: 'line_rounded', displayName: 'Rounded', quantity: '3', amount: '7.04' },
  ],
}

const invoice = toInvoiceDetail(wire)

describe('toInvoiceDocument', () => {
  it('prints the memo and each line note the invoice was saved with', () => {
    const doc = toInvoiceDocument(invoice)
    expect(doc.number).toBe('INV-202611-00008')
    expect(doc.memo).toBe('Thanks for your business')
    expect(doc.lines[0]?.note).toBe('Billed per seat')
    expect(doc.lines[1]).not.toHaveProperty('note')
  })

  it("bills the invoice's own customer, not the contract's expanded one", () => {
    expect(toInvoiceDocument(invoice).billTo.name).toBe('cust_billing_math')

    const billTo = {
      id: 'cust_billing_math',
      name: 'QA Billing Math',
      email: 'math@example.test',
      addressLine1: '1 Main St',
      addressLine2: '',
      addressCity: 'Austin',
      addressState: 'TX',
      addressPostalCode: '78701',
      addressCountry: 'US',
    } as CustomerDetail
    expect(toInvoiceDocument(invoice, { billTo }).billTo).toEqual({
      name: 'QA Billing Math',
      email: 'math@example.test',
      address: ['1 Main St', 'Austin, TX, 78701', 'US'],
    })
  })

  it("reads a line's rate from its price rather than the rounded amount", () => {
    const charges = new Map([
      [
        'price_fixed',
        toCharge({
          id: 'price_fixed',
          billingModel: 'FLAT_FEE',
          amount: '2.3456',
          currency: 'usd',
        }),
      ],
    ])
    const lines = toInvoiceDocument(invoice, { charges }).lines
    expect(lines[0]?.unitPrice).toBe(2.3456)
    // No price to read: the quotient only when it multiplies back exactly.
    expect(lines[1]?.unitPrice).toBe(2.5)
    expect(lines[2]?.unitPrice).toBeNull()
  })

  it('states no rate for a price that is not a flat per-unit amount', () => {
    const charges = new Map([
      ['price_fixed', toCharge({ id: 'price_fixed', billingModel: 'TIERED', currency: 'usd' })],
    ])
    expect(toInvoiceDocument(invoice, { charges }).lines[0]?.unitPrice).toBeNull()
  })
})

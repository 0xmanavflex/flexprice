import { describe, expect, it } from 'vitest'
import { CREATE_ACTIONS, pathForCreateAction } from './createActions'

describe('the Create menu', () => {
  it('offers exactly the four cold-start flows, in order', () => {
    expect(CREATE_ACTIONS.map((action) => action.label)).toEqual([
      'New contract',
      'New customer',
      'New invoice',
      'Record a payment',
    ])
  })

  it('is one flat list, with no groups', () => {
    expect(CREATE_ACTIONS.some((action) => action.startsGroup)).toBe(false)
  })

  // A "New invoice" that lands on the invoice list advertised a flow it did
  // not open.
  it('opens each create flow rather than a list page', () => {
    expect(pathForCreateAction('subscription')).toBe('/contracts/new')
    expect(pathForCreateAction('customer')).toBe('/customers/new')
    expect(pathForCreateAction('invoice')).toBe('/invoices/new')
    expect(pathForCreateAction('payment')).toBe('/payments/new')
    for (const action of CREATE_ACTIONS) expect(action.path).toMatch(/\/new$/)
  })
})

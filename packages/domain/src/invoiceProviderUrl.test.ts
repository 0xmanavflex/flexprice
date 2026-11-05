import { describe, expect, it } from 'vitest'
import { invoiceProviderUrl } from './invoice'
import { paymentMethodName } from './payment'

describe('invoiceProviderUrl', () => {
  it('reads the Stripe hosted invoice the sync stored', () => {
    const metadata = { stripe_hosted_invoice_url: ' https://invoice.stripe.com/i/acct_1/x ' }
    expect(invoiceProviderUrl(metadata, 'stripe')).toBe('https://invoice.stripe.com/i/acct_1/x')
    expect(invoiceProviderUrl(metadata, 'STRIPE')).toBe('https://invoice.stripe.com/i/acct_1/x')
  })

  it('is null without a stored page, for other providers, or for a non-web address', () => {
    expect(invoiceProviderUrl({}, 'stripe')).toBeNull()
    expect(invoiceProviderUrl(undefined, 'stripe')).toBeNull()
    expect(invoiceProviderUrl({ stripe_hosted_invoice_url: 'x' }, 'zoho')).toBeNull()
    expect(
      invoiceProviderUrl({ stripe_hosted_invoice_url: 'javascript:alert(1)' }, 'stripe'),
    ).toBeNull()
  })
})

describe('paymentMethodName', () => {
  it('names a payment link plainly, from either wire spelling', () => {
    expect(paymentMethodName('PAYMENT_LINK')).toBe('Payment link')
    expect(paymentMethodName('payment_link')).toBe('Payment link')
  })

  it('drops the bracketed note and spaces an unknown method', () => {
    expect(paymentMethodName('OFFLINE')).toBe('Offline')
    expect(paymentMethodName('bank_transfer')).toBe('Bank transfer')
    expect(paymentMethodName('')).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { emptyPayment, recordPaymentSchema } from '@fp/domain'
import { toRecordPaymentRequest } from './payments'

const base = { ...emptyPayment(), invoiceId: 'inv_1', currency: 'USD', amount: '40' }

describe('recording a payment from credits', () => {
  it('names the wallet as the payment method', () => {
    expect(
      toRecordPaymentRequest({ ...base, methodType: 'CREDITS', walletId: 'wallet_1' }),
    ).toMatchObject({ paymentMethodType: 'CREDITS', paymentMethodId: 'wallet_1' })
  })

  it('sends no method id for an offline payment', () => {
    expect(toRecordPaymentRequest({ ...base, methodType: 'OFFLINE' })).not.toHaveProperty(
      'paymentMethodId',
    )
  })

  it('requires a wallet for credits', () => {
    expect(recordPaymentSchema.safeParse({ ...base, methodType: 'CREDITS' }).success).toBe(false)
    expect(
      recordPaymentSchema.safeParse({ ...base, methodType: 'CREDITS', walletId: 'w' }).success,
    ).toBe(true)
  })
})

describe('recording a payment as a payment link', () => {
  it('names the provider and where the customer comes back to', () => {
    const body = toRecordPaymentRequest({
      ...base,
      methodType: 'PAYMENT_LINK',
      gateway: 'stripe',
      returnUrl: 'https://console.test/invoices/inv_1',
      processNow: false,
    })
    expect(body).toMatchObject({
      paymentMethodType: 'PAYMENT_LINK',
      paymentGateway: 'stripe',
      successUrl: 'https://console.test/invoices/inv_1',
      cancelUrl: 'https://console.test/invoices/inv_1',
      // A link is raised at once, whatever the switch said.
      processPayment: true,
    })
  })

  it('requires a provider', () => {
    expect(recordPaymentSchema.safeParse({ ...base, methodType: 'PAYMENT_LINK' }).success).toBe(
      false,
    )
  })
})

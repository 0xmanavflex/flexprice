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

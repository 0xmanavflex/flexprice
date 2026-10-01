import { describe, expect, it } from 'vitest'
import { CreatePaymentRequest$outboundSchema } from '@flexprice/sdk/sdk/models'
import { emptyPayment } from '@fp/domain'
import { toPaymentDetail, toRecordPaymentRequest } from './payments'

describe('payment requests', () => {
  it('maps a record-payment form to a valid CreatePaymentRequest', () => {
    const body = toRecordPaymentRequest({
      ...emptyPayment(),
      invoiceId: 'inv_1',
      currency: 'usd',
      amount: '120.50',
    })
    const parsed = CreatePaymentRequest$outboundSchema.parse(body)
    expect(parsed.destination_id).toBe('inv_1')
    expect(parsed.destination_type).toBe('INVOICE')
    expect(parsed.payment_method_type).toBe('OFFLINE')
    expect(parsed.currency).toBe('USD')
    expect(parsed.amount).toBe('120.50')
    expect(parsed.process_payment).toBe(true)
  })
})

describe('payment detail mapping', () => {
  it('reads the invoice, attempts and failure fields', () => {
    const detail = toPaymentDetail({
      id: 'pay_1',
      amount: '10',
      currency: 'USD',
      paymentStatus: 'FAILED',
      destinationType: 'INVOICE',
      destinationId: 'inv_9',
      errorMessage: 'Card declined',
      attempts: [{}, {}],
    })
    expect(detail.invoiceId).toBe('inv_9')
    expect(detail.status).toBe('failed')
    expect(detail.attempts).toBe(2)
    expect(detail.errorMessage).toBe('Card declined')
  })
})

import { describe, expect, it } from 'vitest'
import { emptyFxRateDraft } from '@fp/domain'
import { toCreateFxRateRequest, toUpdateFxRateRequest } from './fxRates'

describe('forex requests', () => {
  it('sends a global rate without a window, a fixed source and lower-case codes', () => {
    expect(
      toCreateFxRateRequest(
        { scope: 'tenant' },
        {
          ...emptyFxRateDraft('USD', 'INR'),
          rate: ' 83.5 ',
          startDate: '2026-11-01T00:00:00.000Z',
        },
      ),
    ).toEqual({
      scope: 'tenant',
      fromCurrency: 'usd',
      toCurrency: 'inr',
      source: 'fixed',
      rate: '83.5',
    })
  })

  it('sends an override with its owner and window', () => {
    expect(
      toCreateFxRateRequest(
        { scope: 'customer', scopeId: 'cus_1' },
        { ...emptyFxRateDraft('usd', 'eur'), rate: '0.92', startDate: '2026-11-01T00:00:00.000Z' },
      ),
    ).toEqual({
      scope: 'customer',
      scopeId: 'cus_1',
      fromCurrency: 'usd',
      toCurrency: 'eur',
      source: 'fixed',
      rate: '0.92',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
    })
  })

  it('updates only what changed, and never clears a saved date', () => {
    const original = {
      ...emptyFxRateDraft('usd', 'eur'),
      rate: '0.92',
      startDate: '2026-11-01T00:00:00.000Z',
    }
    expect(toUpdateFxRateRequest(original, { ...original })).toEqual({})
    expect(toUpdateFxRateRequest(original, { ...original, rate: '0.93', startDate: '' })).toEqual({
      rate: '0.93',
    })
  })
})

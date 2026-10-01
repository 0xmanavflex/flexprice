import { describe, expect, it } from 'vitest'
import {
  CreateWalletRequest$outboundSchema,
  TopUpWalletRequest$outboundSchema,
} from '@flexprice/sdk/sdk/models'
import { emptyTopUp, emptyWallet } from '@fp/domain'
import { toCreateWalletRequest, toTopUpRequest, toWallet, toWalletTransaction } from './wallets'

describe('wallet requests', () => {
  it('maps a create form to a valid CreateWalletRequest', () => {
    const body = toCreateWalletRequest('cust_1', { ...emptyWallet('usd'), initialCredits: '500' })
    const parsed = CreateWalletRequest$outboundSchema.parse(body)
    expect(parsed.customer_id).toBe('cust_1')
    expect(parsed.currency).toBe('USD')
    expect(parsed.initial_credits_to_load).toBe('500')
  })

  it('omits initial credits when blank', () => {
    expect(toCreateWalletRequest('c', emptyWallet())).not.toHaveProperty('initialCreditsToLoad')
  })

  it('sends purchased and free top-ups with their reasons', () => {
    const purchased = TopUpWalletRequest$outboundSchema.parse(
      toTopUpRequest({ ...emptyTopUp(), credits: '100' }),
    )
    const free = TopUpWalletRequest$outboundSchema.parse(
      toTopUpRequest({ ...emptyTopUp(), kind: 'free', credits: '5' }),
    )
    expect(purchased.transaction_reason).toBe('PURCHASED_CREDIT_DIRECT')
    expect(purchased.credits_to_add).toBe('100')
    expect(free.transaction_reason).toBe('FREE_CREDIT_GRANT')
  })
})

describe('wallet mapping', () => {
  it('keeps balances as exact strings and falls back sensibly', () => {
    const wallet = toWallet({ id: 'w1', currency: 'EUR', creditBalance: '12.50', balance: '0.125' })
    expect(wallet.balance).toEqual({ amount: '0.125', currency: 'EUR' })
    expect(wallet.realTimeCreditBalance).toBe('12.50')
    expect(wallet.status).toBe('active')
  })

  it('reads debits as outgoing', () => {
    expect(
      toWalletTransaction({ type: 'debit', transactionReason: 'CREDIT_EXPIRED' }).direction,
    ).toBe('out')
    expect(toWalletTransaction({ type: 'credit' }).reason).toBe('Wallet activity')
  })
})

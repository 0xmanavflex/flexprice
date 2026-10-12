import { describe, expect, it } from 'vitest'
import {
  CreateWalletRequest$outboundSchema,
  TopUpWalletRequest$outboundSchema,
  UpdateWalletRequest$outboundSchema,
} from '@flexprice/sdk/sdk/models'
import { autoTopupSchema, emptyAutoTopup, emptyTopUp, emptyWallet } from '@fp/domain'
import {
  toCreateWalletRequest,
  toTopUpRequest,
  toUpdateAutoTopupRequest,
  toWallet,
  toWalletTransaction,
} from './wallets'

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

describe('auto top-up', () => {
  it('sends the threshold, amount and invoicing when on', () => {
    const body = UpdateWalletRequest$outboundSchema.parse(
      toUpdateAutoTopupRequest({
        enabled: true,
        threshold: '100',
        amount: '500',
        invoicing: false,
      }),
    )
    expect(body.auto_topup).toMatchObject({
      enabled: true,
      threshold: 100,
      amount: 500,
      invoicing: false,
    })
  })

  it('sends only the switch when off, so saved values survive', () => {
    expect(
      toUpdateAutoTopupRequest({ ...emptyAutoTopup(), threshold: '10', amount: '20' }),
    ).toEqual({ autoTopup: { enabled: false } })
  })

  it('requires a threshold and an amount only when on', () => {
    expect(autoTopupSchema.safeParse(emptyAutoTopup()).success).toBe(true)
    expect(autoTopupSchema.safeParse({ ...emptyAutoTopup(), enabled: true }).success).toBe(false)
    expect(
      autoTopupSchema.safeParse({ ...emptyAutoTopup(), enabled: true, threshold: '0', amount: '5' })
        .success,
    ).toBe(false)
    expect(
      autoTopupSchema.safeParse({
        ...emptyAutoTopup(),
        enabled: true,
        threshold: '50',
        amount: '5',
      }).success,
    ).toBe(true)
  })

  it('reads the saved settings off a wallet', () => {
    expect(
      toWallet({ id: 'w', autoTopup: { enabled: true, threshold: 100, amount: 500 } }).autoTopup,
    ).toEqual({ enabled: true, threshold: '100', amount: '500', invoicing: true })
    expect(toWallet({ id: 'w' }).autoTopup.enabled).toBe(false)
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

  it('carries what is left of a top-up and when it expires, null when unsent', () => {
    const expiry = new Date('2026-10-17T00:00:00Z')
    const topUp = toWalletTransaction({
      type: 'credit',
      creditAmount: '1000',
      creditsAvailable: '250',
      expiryDate: expiry,
    })
    expect(topUp.creditsAvailable).toBe('250')
    expect(topUp.expiresAt).toBe(expiry)
    const bare = toWalletTransaction({ type: 'credit', creditAmount: '1000' })
    expect(bare.creditsAvailable).toBeNull()
    expect(bare.expiresAt).toBeNull()
  })

  it('shows the wallet currency in capitals', () => {
    expect(toWallet({ id: 'w1', currency: 'usd' }).currency).toBe('USD')
  })
})

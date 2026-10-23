import { describe, expect, it } from 'vitest'
import {
  CreateWalletRequest$outboundSchema,
  TopUpWalletRequest$outboundSchema,
  UpdateWalletRequest$outboundSchema,
} from '@flexprice/sdk/sdk/models'
import { autoTopupSchema, emptyAutoTopup, emptyDebit, emptyTopUp, emptyWallet } from '@fp/domain'
import {
  toCreateWalletRequest,
  toDebitRequest,
  toTopUpRequest,
  toUpdateAutoTopupRequest,
  toWallet,
  toWalletTransaction,
} from './wallets'

describe('wallet requests', () => {
  it('sends a manual debit with the credits and a required reference', () => {
    expect(
      toDebitRequest({
        ...emptyDebit(),
        credits: '25',
        idempotencyKey: 'debit-1',
        description: 'Adjustment',
      }),
    ).toEqual({
      credits: '25',
      idempotencyKey: 'debit-1',
      description: 'Adjustment',
    })
  })

  it('maps a create form to a valid CreateWalletRequest', () => {
    const body = toCreateWalletRequest('cust_1', { ...emptyWallet('usd'), initialCredits: '500' })
    const parsed = CreateWalletRequest$outboundSchema.parse(body)
    expect(parsed.customer_id).toBe('cust_1')
    expect(parsed.currency).toBe('USD')
    expect(parsed.initial_credits_to_load).toBe('500')
  })

  it('sends a postpaid wallet with its top-up rate and initial-credit expiry', () => {
    const parsed = CreateWalletRequest$outboundSchema.parse(
      toCreateWalletRequest('c', {
        ...emptyWallet(),
        walletType: 'POST_PAID',
        topupConversionRate: '2',
        initialCredits: '10',
        initialCreditsExpiry: '2030-01-31',
      }),
    )
    expect(parsed.wallet_type).toBe('POST_PAID')
    expect(parsed.topup_conversion_rate).toBe('2')
    expect(parsed.initial_credits_expiry_date_utc).toBe('2030-01-31T00:00:00Z')
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

  it('sends an invoiced top-up with its expiry, priority and reference', () => {
    const body = TopUpWalletRequest$outboundSchema.parse(
      toTopUpRequest({
        ...emptyTopUp(),
        credits: '100',
        invoice: true,
        expiryDate: '2030-01-31',
        priority: '2',
        referenceId: 'po-77',
      }),
    )
    expect(body.transaction_reason).toBe('PURCHASED_CREDIT_INVOICED')
    expect(body.expiry_date_utc).toBe('2030-01-31T00:00:00Z')
    expect(body.priority).toBe(2)
    expect(body.idempotency_key).toBe('po-77')
  })

  it('leaves blank options out of a top-up', () => {
    const body = TopUpWalletRequest$outboundSchema.parse(
      toTopUpRequest({ ...emptyTopUp(), credits: '1' }),
    )
    expect(body).not.toHaveProperty('expiry_date_utc')
    expect(body).not.toHaveProperty('priority')
    expect(body).not.toHaveProperty('idempotency_key')
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

describe('toWallet on the real-time balance response', () => {
  // GET /wallets/{id}/balance/real-time nets usage since the last invoice off
  // the stored balance, so it can be negative while the stored one is not.
  it('keeps the real-time figures apart from the stored balance', () => {
    const wallet = toWallet({
      id: 'wallet_01',
      currency: 'usd',
      creditBalance: '10',
      balance: '10',
      realTimeCreditBalance: '-122.5',
      realTimeBalance: '-122.5',
    })
    expect(wallet.creditBalance).toBe('10')
    expect(wallet.realTimeCreditBalance).toBe('-122.5')
    expect(wallet.realTimeBalance).toEqual({ amount: '-122.5', currency: 'USD' })
  })
})

describe('toWallet alert settings', () => {
  it('reads the balance alerts the wallet carries, and null when it has none', () => {
    expect(
      toWallet({
        id: 'wallet_1',
        alertSettings: { alertEnabled: true, critical: { threshold: '10', condition: 'below' } },
      }).alertSettings,
    ).toEqual({
      alertEnabled: true,
      thresholdType: 'percentage',
      critical: { threshold: '10', condition: 'below' },
    })
    expect(toWallet({ id: 'wallet_2' }).alertSettings).toBeNull()
  })
})

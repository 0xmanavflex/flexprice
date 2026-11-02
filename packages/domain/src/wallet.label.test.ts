import { describe, expect, it } from 'vitest'
import { WalletKind, walletLabel } from './wallet'

describe('walletLabel', () => {
  it('uses the name, and does not repeat a currency the name already has', () => {
    expect(
      walletLabel({
        name: 'Postpaid Wallet - USD',
        description: '',
        walletType: WalletKind.PostPaid,
        currency: 'usd',
      }),
    ).toBe('Postpaid Wallet - USD')
  })

  it('falls back to the description, then the type, never assuming prepaid', () => {
    expect(
      walletLabel({ name: '', description: 'Ops budget', walletType: null, currency: 'eur' }),
    ).toBe('Ops budget · EUR')
    expect(
      walletLabel({ name: '', description: '', walletType: WalletKind.PostPaid, currency: 'usd' }),
    ).toBe('Postpaid wallet · USD')
    expect(walletLabel({ name: '', description: '', walletType: null, currency: 'usd' })).toBe(
      'Credit wallet · USD',
    )
  })
})

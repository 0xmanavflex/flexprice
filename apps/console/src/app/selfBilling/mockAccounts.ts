import { useState } from 'react'
import { useRefreshSelfBilling } from '@fp/query'
import type { MockAccountOption } from '@fp/ui/compositions'
import { env } from '@/env'
import { type MockAccountChoice, mockAccountChoice, setMockAccount } from '@/mocks/selfBillingState'

/**
 * The account states the mocks can answer with, as the prototype's
 * environment switcher lists them: so every self-billing state can be walked
 * in the running console without touching storage by hand.
 */
export const MOCK_ACCOUNT_OPTIONS: readonly (MockAccountOption & { value: MockAccountChoice })[] = [
  { value: 'trial', name: 'Trial', note: '15 days left', tone: 'info' },
  { value: 'ending', name: 'Trial ending', note: '3 days left', tone: 'warning' },
  { value: 'near', name: 'Near the event cap', note: '93% of trial events', tone: 'warning' },
  { value: 'limit', name: 'Account locked', note: 'Event limit reached', tone: 'destructive' },
  {
    value: 'suspended',
    name: 'Account locked',
    note: 'Trial ended, invoice unpaid',
    tone: 'destructive',
  },
  { value: 'active', name: 'Live', note: 'Paid', tone: 'success' },
  { value: 'due', name: 'Live, invoice due', note: "This month's invoice to pay", tone: 'success' },
  {
    value: 'off',
    name: 'Self-billing off',
    note: 'A deployment that does not bill',
    tone: 'muted',
  },
]

/**
 * The switcher's Mock accounts group, under mocks only. Choosing one points
 * the mocks at that state and refetches the account, so the pill, the lock and
 * Usage & billing follow at once.
 */
export function useMockAccounts() {
  const refresh = useRefreshSelfBilling()
  const [value, setValue] = useState<MockAccountChoice>(mockAccountChoice)
  if (!env.useMocks) return undefined
  return {
    value,
    options: MOCK_ACCOUNT_OPTIONS,
    onChange: (next: string) => {
      setMockAccount(next as MockAccountChoice)
      setValue(next as MockAccountChoice)
      void refresh()
    },
  }
}

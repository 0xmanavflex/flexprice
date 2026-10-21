/**
 * The mock self-billing account state, shared by the mock handlers and the
 * environment switcher's Mock accounts group. No MSW here, so the console can
 * read and set it without pulling the mock server into its bundle.
 */
export const MOCK_ACCOUNT_KEY = 'flexprice.mock.selfBilling'
/** Set once a mock checkout is polled: the account then reads as paid for the tab. */
export const MOCK_PAID_KEY = 'flexprice.mock.selfBilling.paid'

export const MOCK_ACCOUNT_STATES = [
  'trial',
  'ending',
  'near',
  'limit',
  'suspended',
  'active',
  'due',
] as const
export type MockAccountState = (typeof MOCK_ACCOUNT_STATES)[number]

/** `off` is self-billing switched off, as a deployment that does not bill its workspaces. */
export type MockAccountChoice = MockAccountState | 'off'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** The state the mocks answer with right now; null while self-billing is off. */
export function mockAccountState(): MockAccountState | null {
  if (read(MOCK_PAID_KEY)) return 'active'
  const value = read(MOCK_ACCOUNT_KEY)
  return value && (MOCK_ACCOUNT_STATES as readonly string[]).includes(value)
    ? (value as MockAccountState)
    : null
}

/** The choice the switcher shows ticked. */
export function mockAccountChoice(): MockAccountChoice {
  return mockAccountState() ?? 'off'
}

export function setMockAccount(choice: MockAccountChoice): void {
  try {
    localStorage.removeItem(MOCK_PAID_KEY)
    if (choice === 'off') localStorage.removeItem(MOCK_ACCOUNT_KEY)
    else localStorage.setItem(MOCK_ACCOUNT_KEY, choice)
  } catch {
    // Without storage the mocks stay as they are.
  }
}

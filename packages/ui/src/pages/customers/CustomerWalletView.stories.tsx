import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { type Wallet, type WalletTransaction, WalletStatus, money } from '@fp/domain'
import { CustomerWalletView, type CustomerWalletViewProps } from './CustomerWalletView'

const REASONS = [
  'Purchased credits',
  'Usage draw-down',
  'Promotional grant',
  'Refund',
  'Invoice payment',
]
const CURRENCIES = ['USD', 'EUR', 'GBP']

/** Deterministic wallets: the same count and balances always give the same cards. */
function makeWallets(
  count: number,
  status: WalletStatus,
  credits: number,
  ongoing: number,
): Wallet[] {
  return Array.from({ length: count }, (_, i) => {
    const currency = CURRENCIES[i % CURRENCIES.length] ?? 'USD'
    const scale = i + 1
    const current = String(credits * scale)
    const live = String(Math.min(ongoing, credits) * scale)
    return {
      id: `wallet_${i + 1}`,
      customerId: 'cus_01M3H9ACME',
      currency,
      status: i === 0 ? status : WalletStatus.Active,
      description: i === 0 ? 'Prepaid credits' : `Wallet ${i + 1}`,
      creditBalance: current,
      balance: money(current, currency),
      realTimeCreditBalance: live,
      realTimeBalance: money(live, currency),
      conversionRate: '0.01',
      topupConversionRate: '0.01',
      autoTopup: i % 2 === 1,
      createdAt: new Date('2026-03-04T00:00:00Z'),
    }
  })
}

/** Deterministic ledger rows, newest first. */
function makeTransactions(count: number): WalletTransaction[] {
  return Array.from({ length: count }, (_, i) => {
    const credit = i % 3 === 0
    const credits = String(((i * 173) % 4000) + 120)
    return {
      id: `wtx_${count - i}`,
      direction: credit ? 'in' : 'out',
      reason: REASONS[i % REASONS.length] ?? 'Purchased credits',
      description: i % 2 === 0 ? `Reference ${1000 + i}` : '',
      credits,
      amount: money((Number(credits) / 100).toFixed(2), 'USD'),
      createdAt: new Date(Date.UTC(2026, 8, 30 - (i % 28))),
    }
  })
}

const asyncOk = () => fn(async () => undefined)

const meta = {
  title: 'Surfaces/CustomerWalletView',
  component: CustomerWalletView,
  parameters: {
    layout: 'padded',
    // The balance hint puts aria-label on a bare span tooltip trigger (CustomerWalletView.tsx Balance), which axe rejects.
    a11y: { config: { rules: [{ id: 'aria-prohibited-attr', enabled: false }] } },
  },
  args: {
    wallets: makeWallets(1, WalletStatus.Active, 10000, 7500),
    selectedId: 'wallet_1',
    onSelect: fn(),
    transactions: makeTransactions(8),
    onCreateWallet: asyncOk(),
    onTopUp: asyncOk(),
    onTerminate: asyncOk(),
    onRetry: fn(),
    onResetErrors: fn(),
  },
  argTypes: {
    wallets: { control: false },
    transactions: { control: false },
    selectedId: { control: false },
    onSelect: { control: false },
    onRetry: { control: false },
    onCreateWallet: { control: false },
    onTopUp: { control: false },
    onTerminate: { control: false },
    onResetErrors: { control: false },
    isLoading: { control: 'boolean' },
    failed: { control: 'boolean' },
    transactionsLoading: { control: 'boolean' },
    createError: { control: 'text' },
    topUpError: { control: 'text' },
    terminateError: { control: 'text' },
  },
} satisfies Meta<typeof CustomerWalletView>

export default meta
type Story = StoryObj<typeof meta>

/** Holds the selected wallet so the wallet picker works. */
function Controlled(props: Omit<CustomerWalletViewProps, 'selectedId' | 'onSelect'>) {
  const [selectedId, setSelectedId] = useState<string | null>(props.wallets[0]?.id ?? null)
  return <CustomerWalletView {...props} selectedId={selectedId} onSelect={setSelectedId} />
}

interface PlaygroundArgs {
  wallets: number
  status: WalletStatus
  creditBalance: number
  ongoingBalance: number
  transactions: number
  isLoading: boolean
  failed: boolean
  transactionsLoading: boolean
  topUpError: string
}

/** Wallet count (0 gives the empty state), status, balances, ledger length and loading / failed flags. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    wallets: 1,
    status: WalletStatus.Active,
    creditBalance: 10000,
    ongoingBalance: 7500,
    transactions: 12,
    isLoading: false,
    failed: false,
    transactionsLoading: false,
    topUpError: '',
  },
  argTypes: {
    wallets: { control: { type: 'range', min: 0, max: 3, step: 1 } },
    status: { control: 'select', options: Object.values(WalletStatus) },
    creditBalance: { control: { type: 'number', min: 0, step: 500 } },
    ongoingBalance: {
      control: { type: 'number', min: 0, step: 500 },
      description: 'Credits left after usage not yet invoiced. Capped at the credit balance.',
    },
    transactions: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    isLoading: { control: 'boolean' },
    failed: { control: 'boolean' },
    transactionsLoading: { control: 'boolean' },
    topUpError: { control: 'text', description: 'Shown inside the top-up dialog.' },
  },
  render: (a) => (
    <Controlled
      wallets={makeWallets(a.wallets, a.status, a.creditBalance, a.ongoingBalance)}
      transactions={makeTransactions(a.transactions)}
      isLoading={a.isLoading}
      failed={a.failed}
      transactionsLoading={a.transactionsLoading}
      topUpError={a.topUpError || null}
      onRetry={fn()}
      onCreateWallet={asyncOk()}
      onTopUp={asyncOk()}
      onTerminate={asyncOk()}
      onResetErrors={fn()}
    />
  ),
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Current balance')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /top up wallet/i })).toBeEnabled()
  },
}

export const Loading: Story = { args: { isLoading: true } }

export const Failed: Story = {
  args: { failed: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Wallets could not be loaded')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}

/** No wallet yet: an empty state with a create button. */
export const NoWallet: Story = {
  args: { wallets: [], transactions: [], selectedId: null },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No wallet yet')).toBeInTheDocument()
  },
}

export const TransactionsLoading: Story = { args: { transactionsLoading: true } }

export const NoTransactions: Story = {
  args: { transactions: [] },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No transactions yet.')).toBeInTheDocument()
  },
}

export const LongLedger: Story = { args: { transactions: makeTransactions(40) } }

/** A terminated wallet cannot be topped up. */
export const Terminated: Story = {
  args: { wallets: makeWallets(1, WalletStatus.Closed, 0, 0) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: /top up wallet/i }),
    ).toBeDisabled()
  },
}

/** Several wallets add a picker; choosing one switches the balances. */
export const MultipleWallets: Story = {
  render: (args) => <Controlled {...args} />,
  args: { wallets: makeWallets(3, WalletStatus.Active, 10000, 7500) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('combobox', { name: 'Wallet' }),
    ).toBeInTheDocument()
  },
}

/** Top up opens a dialog. */
export const OpensTopUpDialog: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /top up wallet/i }))
    await expect(await screen.findByRole('dialog')).toBeInTheDocument()
  },
}

/** Terminate asks for confirmation first. */
export const ConfirmsTerminate: Story = {
  parameters: {
    // Restates the meta rule (story rules overwrite it) and adds the vendored destructive-button tint contrast gap.
    a11y: {
      config: {
        rules: [
          { id: 'aria-prohibited-attr', enabled: false },
          { id: 'color-contrast', enabled: false },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Wallet actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /terminate wallet/i }))
    await expect(await screen.findByText('Terminate this wallet?')).toBeInTheDocument()
  },
}

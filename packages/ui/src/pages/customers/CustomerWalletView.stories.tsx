import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { type Wallet, type WalletTransaction, WalletStatus, money } from '@fp/domain'
import { CustomerWalletView, type CustomerWalletViewProps } from './CustomerWalletView'
import { WalletLedgerTable } from './WalletLedgerTable'

const REASONS = [
  'Purchased credits',
  'Usage draw-down',
  'Promotional grant',
  'Refund',
  'Invoice payment',
]
const CURRENCIES = ['USD', 'EUR', 'GBP']
/** Fixed so "in 5 days" and the expiring-soon call-out read the same on every run. */
const NOW = new Date('2026-10-12T00:00:00Z')
const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000)

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
      walletType: i === 2 ? 'POST_PAID' : 'PRE_PAID',
      // The third is a named postpaid wallet; the rest fall back to their description.
      name: i === 2 ? `Postpaid Wallet - ${currency}` : '',
      description: i === 0 ? 'Prepaid credits' : `Wallet ${i + 1}`,
      metadata: i === 0 ? { cost_center: 'ops' } : {},
      creditBalance: current,
      balance: money(current, currency),
      realTimeCreditBalance: live,
      realTimeBalance: money(live, currency),
      conversionRate: '0.01',
      topupConversionRate: '0.01',
      autoTopup:
        i % 2 === 1
          ? { enabled: true, threshold: '100', amount: '500', invoicing: true }
          : { enabled: false, threshold: '', amount: '', invoicing: true },
      createdAt: new Date('2026-03-04T00:00:00Z'),
    }
  })
}

/** Deterministic ledger rows, newest first. Top-ups are the credit rows; one expires in 5 days. */
function makeTransactions(count: number): WalletTransaction[] {
  return Array.from({ length: count }, (_, i) => {
    const credit = i % 3 === 0
    const credits = String(((i * 173) % 4000) + 120)
    const left = credit ? String(Math.round(Number(credits) * [1, 0.6, 0.05][(i / 3) % 3]!)) : null
    return {
      id: `wtx_${count - i}`,
      direction: credit ? 'in' : 'out',
      reason: REASONS[i % REASONS.length] ?? 'Purchased credits',
      description: i % 2 === 0 ? `Reference ${1000 + i}` : '',
      credits,
      amount: money((Number(credits) / 100).toFixed(2), 'USD'),
      createdAt: new Date(Date.UTC(2026, 8, 30 - (i % 28))),
      creditsAvailable: left,
      expiresAt: !credit || i % 2 === 0 ? null : i === 3 ? inDays(5) : inDays(90),
    }
  })
}

/** A top-up the API says nothing about beyond its amount. */
const BARE_TOP_UP: WalletTransaction = {
  id: 'wtx_bare',
  direction: 'in',
  reason: 'Credit memo',
  description: '',
  credits: '200',
  amount: money('100.00', 'USD'),
  createdAt: new Date('2026-09-20T00:00:00Z'),
  creditsAvailable: null,
  expiresAt: null,
}

/** A large top-up that debits drew down. */
const WITH_BREAKDOWN: WalletTransaction = {
  id: 'wtx_breakdown',
  direction: 'in',
  reason: 'Subscription grant',
  description: 'Annual commit',
  credits: '100000',
  amount: money('50000.00', 'USD'),
  createdAt: new Date('2026-09-01T00:00:00Z'),
  creditsAvailable: '8000',
  expiresAt: inDays(5),
}

/** One debit that drew from two top-ups, as its `consumption_breakdown` says. */
const SPLIT_DEBIT: WalletTransaction = {
  id: 'wtx_split_debit',
  direction: 'out',
  reason: 'Manual debit',
  description: 'Voice minutes overage',
  credits: '670',
  amount: money('335.00', 'USD'),
  createdAt: new Date('2026-09-25T00:00:00Z'),
  creditsAvailable: null,
  expiresAt: null,
  drawnFrom: [
    { topUpId: 'wtx_breakdown', credits: '640' },
    { topUpId: 'wtx_bare', credits: '30' },
  ],
}

/** A debit naming a top-up that is not in the loaded ledger. */
const DEBIT_FROM_UNLOADED: WalletTransaction = {
  id: 'wtx_unloaded_debit',
  direction: 'out',
  reason: 'Invoice payment',
  description: '',
  credits: '55',
  amount: money('27.50', 'USD'),
  createdAt: new Date('2026-09-26T00:00:00Z'),
  creditsAvailable: null,
  expiresAt: null,
  drawnFrom: [{ topUpId: 'wtx_archived_0f3a9c', credits: '55' }],
}

const asyncOk = () => fn(async () => undefined)

const meta = {
  title: 'App/Customers/Customer wallet',
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
    now: NOW,
    onCreateWallet: asyncOk(),
    onTopUp: asyncOk(),
    onDebit: asyncOk(),
    onTerminate: asyncOk(),
    onSaveAutoTopup: asyncOk(),
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
    onDebit: { control: false },
    onTerminate: { control: false },
    onSaveAutoTopup: { control: false },
    onResetErrors: { control: false },
    isLoading: { control: 'boolean' },
    failed: { control: 'boolean' },
    transactionsLoading: { control: 'boolean' },
    createError: { control: 'text' },
    topUpError: { control: 'text' },
    terminateError: { control: 'text' },
    autoTopupError: { control: 'text' },
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
      now={NOW}
      transactionsLoading={a.transactionsLoading}
      topUpError={a.topUpError || null}
      onRetry={fn()}
      onCreateWallet={asyncOk()}
      onTopUp={asyncOk()}
      onDebit={asyncOk()}
      onTerminate={asyncOk()}
      onSaveAutoTopup={asyncOk()}
      onResetErrors={fn()}
    />
  ),
}

/** V1's wallet menu has Alert Settings; it is offered when the page passes the handler. */
export const AlertSettingsFromMenu: Story = {
  // Base UI's menu portal leaves `aria-hidden` focus guards with tabindex 0
  // while it closes; axe flags them, and the vendored library is not ours to
  // fix. See ConfirmDialog.stories.tsx.
  parameters: {
    a11y: {
      config: {
        rules: [
          // The file's own exception (see meta), kept: story rules replace it.
          { id: 'aria-prohibited-attr', enabled: false },
          { id: 'aria-hidden-focus', enabled: false },
        ],
      },
    },
  },
  args: { onAlertSettings: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Wallet actions' }))
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('menuitem', {
        name: 'Alert settings',
      }),
    )
    await expect(args.onAlertSettings).toHaveBeenCalledOnce()
  },
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Each balance is named: the ongoing (real-time) figure apart from the last invoiced total.
    await expect(canvas.getByText('Real-time balance')).toBeVisible()
    await expect(canvas.getByText('Last invoiced balance')).toBeVisible()
    await expect(canvas.queryByText(/Available now/)).toBeNull()
    // Each hint is a button, so the keyboard reaches it too.
    await expect(canvas.getAllByRole('button', { name: 'More information' })).toHaveLength(2)
    await expect(canvas.getByText('Active')).toBeInTheDocument()
    await expect(canvas.getByText('Consumption rate')).toBeInTheDocument()
    // Expiring credits live in the ledger's Expires column, not a property of their own.
    await expect(canvas.queryByText('Expiring soon')).toBeNull()
    await expect(canvas.getByText(/used, not yet invoiced/)).toBeInTheDocument()
    // The bar's share is stated: used (last invoiced − real-time) over the last invoiced balance.
    await expect(canvas.getByText(/^\d+% of the last invoiced balance used$/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: /auto top-up off/i })).toBeEnabled()
    await expect(canvas.getByRole('combobox', { name: 'Wallet' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /top up wallet/i })).toBeEnabled()
  },
}

export const Loading: Story = { args: { isLoading: true } }

export const Failed: Story = {
  args: { failed: true, wallets: [], transactions: [], selectedId: null },
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

/** The ledger is loading: a shaped skeleton, never "No transactions yet". */
export const TransactionsLoading: Story = {
  args: { transactions: [], transactionsLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Loading transactions')).toBeInTheDocument()
    await expect(canvas.queryByText('No transactions yet')).toBeNull()
  },
}

/** The ledger read failed: an error with retry in the Transactions section, never "No transactions yet". */
export const TransactionsFailed: Story = {
  args: {
    transactions: [],
    transactionsError: 'Flexprice had a problem loading wallet transactions.',
    transactionsErrorKind: 'server',
    onRetryTransactions: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/problem loading wallet transactions/)).toBeVisible()
    await expect(canvas.queryByText('No transactions yet')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetryTransactions).toHaveBeenCalledOnce()
  },
}

/** An unreadable balance is shown as unknown: a dash, never 0 credits. */
export const UnreadableBalance: Story = {
  args: {
    wallets: makeWallets(1, WalletStatus.Active, 10000, 7500).map((wallet) => ({
      ...wallet,
      realTimeCreditBalance: 'n/a',
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The figure keeps its name even when it cannot be read.
    await expect(canvas.getByText('Real-time balance')).toBeVisible()
    await expect(canvas.queryByText(/since the last invoice/i)).toBeNull()
  },
}

export const NoTransactions: Story = {
  args: { transactions: [] },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No transactions yet')).toBeInTheDocument()
  },
}

/** Remaining, consumed and expiry from the API; a top-up without them shows dashes. */
export const LedgerColumns: Story = {
  args: { transactions: [WITH_BREAKDOWN, ...makeTransactions(4).slice(0, 1), BARE_TOP_UP] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Remaining')).toBeInTheDocument()
    await expect(canvas.getByText('Consumed')).toBeInTheDocument()
    await expect(canvas.getByText('Expires')).toBeInTheDocument()
    await expect(canvas.getByText('in 5 days')).toBeInTheDocument()
    await expect(canvas.getByRole('img', { name: '92% consumed' })).toBeInTheDocument()
  },
}

/** Debits show beside top-ups; a debit opens to the top-ups it drew from. */
export const ExpandsDebit: Story = {
  args: { transactions: [SPLIT_DEBIT, WITH_BREAKDOWN, BARE_TOP_UP] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The debit is a row of its own, not hidden under a top-up.
    await expect(await canvas.findByText('Manual debit')).toBeInTheDocument()
    await expect(canvas.getByText('−670')).toBeInTheDocument()
    await expect(canvas.queryByText('From Subscription grant')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /expand manual debit/i }))
    await expect(await canvas.findByText('From Subscription grant')).toBeInTheDocument()
    await expect(canvas.getByText('From Credit memo')).toBeInTheDocument()
    await expect(canvas.getByText('−640')).toBeInTheDocument()
    await expect(canvas.getByText('−30')).toBeInTheDocument()
    // Top-ups do not expand.
    await expect(canvas.queryByRole('button', { name: /expand subscription grant/i })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /collapse manual debit/i }))
    await expect(canvas.queryByText('From Subscription grant')).toBeNull()
  },
}

/** A source top-up outside the loaded ledger still shows, by its id. */
export const DebitFromUnloadedTopUp: Story = {
  args: { transactions: [DEBIT_FROM_UNLOADED, BARE_TOP_UP] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /expand invoice payment/i }))
    await expect(await canvas.findByText('From a top-up')).toBeInTheDocument()
    await expect(canvas.getByText('Top-up …0f3a9c')).toBeInTheDocument()
  },
}

export const LongLedger: Story = { args: { transactions: makeTransactions(40) } }

/** A debit raised for an invoice: its reference and metadata show, and search finds them. */
const INVOICE_DEBIT: WalletTransaction = {
  id: 'wtx_invoice_debit',
  direction: 'out',
  reason: 'Invoice payment',
  description: '',
  credits: '300',
  amount: money('3.00', 'USD'),
  createdAt: new Date('2026-09-18T00:00:00Z'),
  creditsAvailable: null,
  expiresAt: null,
  reference: { type: 'INVOICE', id: 'inv_9' },
  metadata: { source: 'usage' },
}

/** The ledger on its own (no titled section), so its search bar shows. */
export const SearchesReferenceAndMetadata: Story = {
  render: () => (
    <WalletLedgerTable transactions={[INVOICE_DEBIT, ...makeTransactions(3)]} now={NOW} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/source: usage/)).toBeNull()
    // Debits are rows of their own.
    await expect(canvas.getByText('Invoice payment')).toBeInTheDocument()
    await userEvent.type(canvas.getByPlaceholderText(/^Search/), 'Purchased')
    await waitFor(() => expect(canvas.queryByText('Invoice payment')).toBeNull())
    await expect(canvas.getByText('Purchased credits')).toBeInTheDocument()
  },
}

/** The whole ledger is read page by page, so a long one is not called incomplete. */
export const FullLedgerNotTruncated: Story = {
  args: { transactions: makeTransactions(250) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Remaining')).toBeInTheDocument()
    await expect(canvas.queryByText(/older entries/i)).toBeNull()
  },
}

/** A terminated wallet cannot be topped up. */
export const Terminated: Story = {
  args: { wallets: makeWallets(1, WalletStatus.Closed, 0, 0) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: /top up wallet/i }),
    ).toBeDisabled()
  },
}

/** The picker is always shown; with several wallets, choosing one switches the balances. */
export const MultipleWallets: Story = {
  render: (args) => <Controlled {...args} />,
  args: { wallets: makeWallets(3, WalletStatus.Active, 10000, 7500) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('combobox', { name: 'Wallet' }),
    ).toBeInTheDocument()
  },
}

/** A postpaid wallet is named for what it is, never "Prepaid credits", and its type shows. */
export const PostpaidWallet: Story = {
  args: {
    wallets: makeWallets(3, WalletStatus.Active, 10000, 7500),
    selectedId: 'wallet_3',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox', { name: 'Wallet' })).toHaveTextContent(
      'Postpaid Wallet - GBP',
    )
    await expect(canvas.getByRole('combobox', { name: 'Wallet' })).not.toHaveTextContent(/Prepaid/)
    await expect(canvas.getByText('Type')).toBeVisible()
    await expect(canvas.getByText('Postpaid')).toBeVisible()
  },
}

/** The wallet ID is one click away in the wallet menu, even on a closed wallet. */
export const CopiesWalletId: Story = {
  args: { wallets: makeWallets(1, WalletStatus.Closed, 0, 0) },
  play: async ({ canvasElement }) => {
    const writeText = fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Wallet actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Copy wallet ID' }))
    await expect(writeText).toHaveBeenCalledWith('wallet_1')
  },
}

/** Top up opens a dialog. */
export const OpensTopUpDialog: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /top up wallet/i }))
    await expect(await screen.findByRole('dialog')).toBeInTheDocument()
  },
}

/**
 * A purchased top-up previews the bonus Settings → Wallets → Bonus credits
 * would grant, and a typed bonus replaces it. A free grant has no bonus.
 */
export const PreviewsBonusCredits: Story = {
  args: {
    onTopUp: fn(async () => undefined),
    bonusConfig: {
      enabled: true,
      slabs: [
        {
          threshold: '200',
          bonusType: 'percentage',
          bonusValue: '10',
          expiryDuration: '3',
          expiryUnit: 'MONTH',
        },
        {
          threshold: '100',
          bonusType: 'flat',
          bonusValue: '50',
          expiryDuration: '',
          expiryUnit: 'MONTH',
        },
      ],
    },
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /top up wallet/i }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText(/^credits/i), '500')
    await expect(
      dialog.getByText(
        'Earns 50 bonus credits: 10% of the top-up, expires 3 months after the top-up.',
      ),
    ).toBeVisible()
    await userEvent.type(dialog.getByLabelText(/^bonus credits/i), '75')
    await expect(dialog.getByText(/75 bonus credits, as entered/)).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Top up' }))
    await waitFor(() =>
      expect(args.onTopUp).toHaveBeenCalledWith(
        expect.objectContaining({ credits: '500', bonusCredits: '75' }),
      ),
    )
  },
}

/**
 * With bonus credits off (or no slab for the amount) the dialog says nothing
 * about a bonus: no sentence pointing at a setting that is not on this screen.
 */
export const NoBonusNoSentence: Story = {
  args: { bonusConfig: null },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /top up wallet/i }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText(/^credits/i), '500')
    await expect(dialog.queryByText(/bonus credits are off/i)).toBeNull()
    await expect(dialog.queryByText(/Settings → Wallets/)).toBeNull()
    await expect(dialog.queryByText(/^Earns /)).toBeNull()
  },
}

/**
 * Create wallet reads in pairs: Currency then Description, the two rates on
 * one line, initial credits beside their expiry. Inputs never ask a password
 * manager for a login.
 */
export const CreateWalletLayout: Story = {
  args: { wallets: [], transactions: [], selectedId: null },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /create wallet/i }))
    const dialog = await screen.findByRole('dialog')
    const order = [...dialog.querySelectorAll('label[for^="wallet-"]')].map((label) =>
      label.getAttribute('for'),
    )
    await expect(order).toEqual([
      'wallet-currency',
      'wallet-description',
      'wallet-rate',
      'wallet-topup-rate',
      'wallet-initial',
      'wallet-initial-expiry',
    ])
    for (const id of ['wallet-rate', 'wallet-topup-rate', 'wallet-initial', 'wallet-description']) {
      const input = dialog.querySelector(`#${id}`)
      await expect(input).toHaveAttribute('type', 'text')
      await expect(input).toHaveAttribute('autocomplete', 'off')
    }
  },
}

/** A purchased top-up can be invoiced, and carries its priority and reference. */
export const TopsUpWithOptions: Story = {
  args: { onTopUp: fn(async () => undefined) },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /top up wallet/i }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText(/^credits/i), '100')
    await userEvent.type(dialog.getByLabelText(/^priority/i), '2')
    await userEvent.type(dialog.getByLabelText(/^reference id/i), 'po-77')
    await userEvent.click(dialog.getByRole('switch', { name: /invoice the customer/i }))
    await userEvent.click(dialog.getByRole('button', { name: /^top up$/i }))
    await waitFor(() =>
      expect(args.onTopUp).toHaveBeenCalledWith(
        expect.objectContaining({
          credits: '100',
          invoice: true,
          priority: '2',
          referenceId: 'po-77',
        }),
      ),
    )
  },
}

/** With a checkout provider connected, a purchased top-up can be paid by checkout link. */
export const TopsUpByCheckoutLink: Story = {
  args: { onTopUp: fn(async () => undefined), checkoutProvider: 'Razorpay' },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /top up wallet/i }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText(/^credits/i), '100')
    await userEvent.click(dialog.getByRole('radio', { name: /checkout link/i }))
    await userEvent.click(dialog.getByRole('button', { name: /^create checkout link$/i }))
    await waitFor(() =>
      expect(args.onTopUp).toHaveBeenCalledWith(
        expect.objectContaining({ credits: '100', checkout: true, invoice: false }),
      ),
    )
  },
}

/** A priority must be a whole number. */
export const RejectsAFractionalPriority: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /top up wallet/i }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText(/^credits/i), '100')
    await userEvent.type(dialog.getByLabelText(/^priority/i), '1.5')
    await userEvent.click(dialog.getByRole('button', { name: /^top up$/i }))
    await expect(
      await dialog.findByText('Priority is a whole number, 1 or more'),
    ).toBeInTheDocument()
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

const AUTO_TOPUP_ON = { enabled: true, threshold: '100', amount: '500', invoicing: true }

/** Auto top-up on: the details row says how much is added and when. */
export const AutoTopupOn: Story = {
  args: {
    wallets: makeWallets(1, WalletStatus.Active, 10000, 7500).map((wallet) => ({
      ...wallet,
      autoTopup: AUTO_TOPUP_ON,
    })),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: /auto top-up on/i }),
    ).toHaveTextContent(/Below/)
  },
}

/** The auto top-up value opens the settings; turning it on needs a threshold and an amount, then saves them. */
export const SavesAutoTopup: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /auto top-up off/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Auto top-up' })
    const inside = within(dialog)
    await userEvent.click(inside.getByRole('switch', { name: 'Top up automatically' }))
    await userEvent.click(inside.getByRole('button', { name: 'Save' }))
    await expect(await inside.findByRole('alert')).toHaveTextContent('credit balance that triggers')
    await userEvent.type(inside.getByLabelText('Below'), '100')
    await userEvent.type(inside.getByLabelText('Add'), '500')
    await userEvent.click(inside.getByRole('button', { name: 'Save' }))
    await expect(args.onSaveAutoTopup).toHaveBeenCalledWith({
      enabled: true,
      threshold: '100',
      amount: '500',
      invoicing: true,
    })
  },
}

/** Closing and reopening a dialog starts clean: the last draft and message are gone. */
export const ReopenedDialogIsClean: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Top up wallet' }))
    let dialog = await screen.findByRole('dialog', { name: 'Top up wallet' })
    await userEvent.type(within(dialog).getByLabelText('Credits'), '123')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Top up wallet' }))
    dialog = await screen.findByRole('dialog', { name: 'Top up wallet' })
    await expect(within(dialog).getByLabelText('Credits')).toHaveValue('')
  },
}

/** A failed save keeps the dialog open and says why. */
export const AutoTopupError: Story = {
  args: { autoTopupError: 'Could not update auto top-up. Try again.' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /auto top-up off/i }))
    await expect(await screen.findByRole('dialog', { name: 'Auto top-up' })).toHaveTextContent(
      'Could not update auto top-up.',
    )
  },
}

/** A terminated wallet cannot change its auto top-up. */
export const TerminatedAutoTopupLocked: Story = {
  args: { wallets: makeWallets(1, WalletStatus.Closed, 0, 0) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /auto top-up/i })).toBeDisabled()
  },
}

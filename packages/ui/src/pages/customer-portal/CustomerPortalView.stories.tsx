import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import {
  DEFAULT_PORTAL_CONFIG,
  type PortalParts,
  type PortalRange,
  type PortalView,
  money,
} from '@fp/domain'
import { CustomerPortalView } from './CustomerPortalView'
import { PortalNotice } from './PortalNotice'
import {
  PORTAL_NOW,
  emptyPortalData,
  loadingPortalData,
  noopPortalActions,
  portalCards,
  portalData,
  portalInvoices,
  portalSpend,
  portalWallets,
} from './fixtures'
import type { AddCreditsResult, CustomerPortalData } from './types'

const CHECKOUT = 'https://checkout.stripe.com/c/pay/cs_demo'
const payInvoice = fn(() => Promise.resolve<string | null>(CHECKOUT))
const addCredits = fn((..._args: unknown[]) => Promise.resolve<AddCreditsResult>(null))
const addCard = fn(() => Promise.resolve<string | null>(CHECKOUT))
const saveAutoTopup = fn(() => Promise.resolve())
const retryTotals = fn()

/** The portal with its navigation state held here, as the surface holds it in the URL. */
function Portal({
  data = portalData,
  initialView = 'overview',
  brandColor = null,
  views = ['overview', 'usage', 'credits', 'invoices'],
  labels,
  hidden = [],
  ranges,
  initialRange = '30d',
  allowCustomRange,
  groupKeys,
  propertyValues,
}: {
  data?: CustomerPortalData
  initialView?: PortalView
  brandColor?: string | null
  views?: PortalView[]
  labels?: Record<PortalView, string>
  /** Parts the merchant switched off. */
  hidden?: (keyof PortalParts)[]
  ranges?: PortalRange[]
  initialRange?: PortalRange
  allowCustomRange?: boolean
  groupKeys?: string[]
  propertyValues?: Record<string, string[]>
}) {
  const [view, setView] = useState<PortalView>(initialView)
  const [range, setRange] = useState<PortalRange>(initialRange)
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const parts = { ...DEFAULT_PORTAL_CONFIG.parts }
  for (const part of hidden) parts[part] = false
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const detail = invoiceId ? portalInvoices.find((i) => i.id === invoiceId) : null
  return (
    <CustomerPortalView
      brandName="Massio"
      brandColor={brandColor}
      views={views}
      {...(labels ? { labels } : {})}
      parts={parts}
      {...(ranges ? { ranges } : {})}
      {...(allowCustomRange !== undefined ? { allowCustomRange } : {})}
      {...(groupKeys ? { groupKeys } : {})}
      {...(propertyValues ? { propertyValues } : {})}
      groupBy={groupBy}
      view={view}
      range={range}
      customRange={null}
      walletId={null}
      now={PORTAL_NOW}
      locale="en-US"
      data={{
        ...data,
        invoiceDetail: detail ? { status: 'ready', data: detail } : null,
        groupedSpend: groupBy ? { status: 'ready', data: groupedBy(groupBy) } : null,
      }}
      actions={{
        ...noopPortalActions,
        onViewChange: setView,
        onRangeChange: setRange,
        onGroupByChange: setGroupBy,
        onOpenInvoice: setInvoiceId,
        payInvoice,
        addCredits,
        addCard,
        saveAutoTopup,
      }}
    />
  )
}

/** The fixture's spend as if split by a property: alternate features under two values. */
function groupedBy(key: string) {
  return {
    ...portalSpend,
    items: portalSpend.items.map((item, index) => ({
      ...item,
      group: `${key} ${index % 2 === 0 ? 'eu-west-1' : 'us-east-1'}`,
    })),
  }
}

const meta = {
  title: 'App/Billing/Customer portal/Page',
  component: Portal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Portal>

export default meta
type Story = StoryObj<typeof meta>

/** A failed payment up top, the account summary, saved cards and plans. */
export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Your last payment didn’t go through')).toBeVisible()
    await expect(canvas.getByText('Growth plan · in 7 days')).toBeVisible()
    await expect(canvas.getByText('18,640 credits')).toBeVisible()
    await expect(canvas.getByText('Visa •••• 4242')).toBeVisible()
    await expect(canvas.getByText('American Express •••• 0005')).toBeVisible()
    await expect(canvas.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(canvas.getByRole('button', { name: 'See usage so far' })).toBeVisible()
  },
}

/** Usage and Invoices switched off: the summary links nowhere it can't open; paying stays. */
export const OverviewWithoutUsageOrInvoices: Story = {
  args: { views: ['overview', 'credits'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Growth plan · in 7 days')).toBeVisible()
    await expect(canvas.queryByRole('tab', { name: 'Usage' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'See usage so far' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'See unpaid invoices' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Pay now' })).toBeVisible()
  },
}

/** Paid up with Invoices switched off: no "View invoices" link. */
export const PaidUpWithoutInvoices: Story = {
  args: {
    views: ['overview', 'usage', 'credits'],
    data: {
      ...portalData,
      invoices: {
        status: 'ready',
        data: portalInvoices.map((i) => ({ ...i, status: 'paid' as const })),
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('All paid up')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'View invoices' })).toBeNull()
  },
}

/**
 * Cards saved at two providers are split by provider, each with its own
 * default, and every card names the provider that holds it.
 */
export const CardsAtTwoProviders: Story = {
  args: {
    data: {
      ...portalData,
      paymentMethods: {
        status: 'ready',
        data: [
          ...portalCards,
          {
            id: 'pm_rzp',
            provider: 'razorpay',
            brand: 'Visa',
            network: 'visa',
            last4: '1111',
            expires: '12/34',
            expired: false,
            isDefault: true,
            canAutoCharge: true,
          },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Stripe · 3 cards')).toBeVisible()
    await expect(canvas.getByText('Razorpay · 1 card')).toBeVisible()
    const razorpay = within(canvas.getByRole('list', { name: 'Razorpay cards' }))
    await expect(razorpay.getByText('Visa •••• 1111')).toBeVisible()
    await expect(razorpay.getByText('Default')).toBeVisible()
    await expect(razorpay.getByText('Razorpay · Expires 12/34')).toBeVisible()
  },
}

/** Pay from the alert: the gateway's page opens, and its link stays in the dialog. */
/** One gateway could not list its cards: said so, not shown as "no cards". */
export const CardsProviderFailed: Story = {
  args: {
    data: {
      ...portalData,
      paymentMethods: { status: 'ready', data: [] },
      cardProviderErrors: [
        { provider: 'stripe', label: 'Stripe', message: 'Stripe did not answer.' },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Couldn’t load your Stripe cards')).toBeVisible()
    await expect(canvas.queryByText('No payment methods')).toBeNull()
  },
}

/** No gateway saves cards: the empty state does not invite saving one. */
export const CardsNoGateway: Story = {
  args: {
    data: {
      ...portalData,
      paymentMethods: { status: 'ready', data: [] },
      gateways: { status: 'ready', data: [] },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Payment methods are not available')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Add card' })).toBeNull()
  },
}

export const PayInvoice: Story = {
  play: async ({ canvasElement }) => {
    payInvoice.mockClear()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Pay $512.40' }))
    const dialog = await screen.findByRole('dialog', { name: 'Pay INV-2026-01488' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pay $512.40' }))
    await waitFor(() =>
      expect(payInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'inv_01488' }),
        'stripe',
      ),
    )
    const handoff = await screen.findByRole('dialog', { name: 'Complete your payment' })
    await expect(within(handoff).getByText(CHECKOUT)).toBeVisible()
    await expect(within(handoff).getByRole('link', { name: /Open payment page/ })).toHaveAttribute(
      'href',
      CHECKOUT,
    )
  },
}

/** Add credits: a preset, the saved card, and the price worked out exactly. */
export const AddCredits: Story = {
  play: async ({ canvasElement }) => {
    addCredits.mockClear()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add credits' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add credits' })
    const body = within(dialog)
    await expect(body.getByText('23,640 credits')).toBeVisible()
    await userEvent.click(body.getByRole('radio', { name: /2,500/ }))
    await expect(body.getByText('21,140 credits')).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: 'Pay $250.00' }))
    await waitFor(() =>
      expect(addCredits).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'wal_prepaid' }),
        '2500',
        { kind: 'saved', provider: 'stripe' },
        '',
      ),
    )
  },
}

/**
 * The saved card's bank asks to approve the charge: the dialog says so and offers the page as a
 * link the customer clicks (a tab opened after the request would be blocked).
 */
export const AddCreditsBankConfirms: Story = {
  play: async ({ canvasElement }) => {
    addCredits.mockClear()
    addCredits.mockResolvedValueOnce(CHECKOUT)
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add credits' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add credits' })
    await userEvent.click(within(dialog).getByRole('button', { name: /^Pay / }))
    const handoff = await screen.findByRole('dialog', { name: 'Complete your payment' })
    await expect(within(handoff).getByText(/Your bank asks you to confirm/)).toBeVisible()
    await expect(
      within(handoff).getByRole('link', { name: /Open confirmation page/ }),
    ).toHaveAttribute('href', CHECKOUT)
  },
}

/** No saved card and one checkout gateway: the one way to pay is shown, with no choice to make. */
export const AddCreditsOneWayToPay: Story = {
  args: {
    data: {
      ...portalData,
      paymentMethods: { status: 'ready', data: [] },
      gateways: {
        status: 'ready',
        data: portalData.gateways.status === 'ready' ? portalData.gateways.data.slice(0, 1) : [],
      },
    },
  },
  play: async ({ canvasElement }) => {
    addCredits.mockClear()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add credits' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Add credits' }))
    await expect(dialog.getByText('Stripe checkout')).toBeVisible()
    await expect(dialog.queryByRole('radiogroup', { name: 'Payment method' })).toBeNull()
    await userEvent.click(dialog.getByRole('button', { name: /^Pay / }))
    await waitFor(() =>
      expect(addCredits).toHaveBeenCalledWith(
        expect.anything(),
        '5000',
        { kind: 'checkout', provider: 'stripe' },
        '',
      ),
    )
  },
}

/**
 * The API made no new checkout because a Razorpay one is still open: the
 * customer can finish that one, or cancel it and pay with the gateway picked.
 */
export const AddCreditsCheckoutAlreadyOpen: Story = {
  play: async ({ canvasElement }) => {
    addCredits.mockReset()
    addCredits.mockImplementation((...args: unknown[]) =>
      Promise.resolve<AddCreditsResult>(
        (args[2] as { replace?: boolean }).replace
          ? CHECKOUT
          : {
              alreadyOpen: {
                url: 'https://rzp.io/rzp/FQDMXiuA',
                provider: 'razorpay',
                label: 'Razorpay',
                expiresAt: new Date('2026-11-05T16:08:46Z'),
              },
            },
      ),
    )
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add credits' }))
    let dialog = within(await screen.findByRole('dialog', { name: 'Add credits' }))
    await userEvent.click(dialog.getByRole('radio', { name: /Stripe checkout/ }))
    await userEvent.click(dialog.getByRole('button', { name: /^Pay / }))
    dialog = within(await screen.findByRole('dialog', { name: 'A checkout is already open' }))
    await expect(dialog.getByText('Razorpay checkout')).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Open Razorpay checkout' })).toHaveAttribute(
      'href',
      'https://rzp.io/rzp/FQDMXiuA',
    )
    await userEvent.click(
      dialog.getByRole('button', { name: 'Cancel it and pay $500.00 with Stripe' }),
    )
    await waitFor(() =>
      expect(addCredits).toHaveBeenLastCalledWith(
        expect.anything(),
        '5000',
        { kind: 'checkout', provider: 'stripe', replace: true },
        '',
      ),
    )
    await screen.findByRole('dialog', { name: 'Complete your payment' })
    addCredits.mockReset()
    addCredits.mockImplementation(() => Promise.resolve<AddCreditsResult>(null))
  },
}

/**
 * V1's flow: with one gateway that saves cards, "Add card" opens its secure card form straight
 * away (no picker), then keeps the link on screen in case the tab was blocked.
 */
export const AddCard: Story = {
  play: async ({ canvasElement }) => {
    addCard.mockClear()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add card' }))
    await waitFor(() => expect(addCard).toHaveBeenCalledWith('stripe'))
    const handoff = within(await screen.findByRole('dialog', { name: 'Add your card' }))
    // Saving a card charges nothing: the words are about the card, not a payment.
    await expect(handoff.getByText('Taking you to the secure card form')).toBeVisible()
    await expect(handoff.queryByText(/paying/)).toBeNull()
    await expect(handoff.getByRole('link', { name: /Open card form/ })).toHaveAttribute(
      'href',
      CHECKOUT,
    )
    await expect(handoff.getByRole('button', { name: 'I’ve added it' })).toBeVisible()
  },
}

/** Two gateways save cards: "Add card" lists them, each opening its own card form. */
export const AddCardChoosesGateway: Story = {
  args: {
    data: {
      ...portalData,
      gateways: {
        status: 'ready',
        data:
          portalData.gateways.status === 'ready'
            ? portalData.gateways.data.map((g) => ({ ...g, savesCards: true }))
            : [],
      },
    },
  },
  play: async ({ canvasElement }) => {
    addCard.mockClear()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add card' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Add card (Razorpay)' }))
    await waitFor(() => expect(addCard).toHaveBeenCalledWith('razorpay'))
  },
}

export const Usage: Story = {
  args: { initialView: 'usage' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('vs the 30 days before', { exact: false })).toBeVisible()
    await expect(canvas.getByText('API calls · 43% of spend')).toBeVisible()
    await expect(canvas.getByText('$13.11')).toBeVisible()
    await expect(canvas.getByText('1.4M over · billed as usage')).toBeVisible()
    await expect(canvas.getByText('$0.20 per 1K calls')).toBeVisible()
    // A tiered price has a unit cost too: its effective rate, marked as an average.
    await expect(canvas.getByText('avg. $0.01999 per minute')).toBeVisible()
  },
}

/** By feature, the breakdown is one row per feature, as V1 lists it: no group rows, no "Other". */
export const UsageByFeatureIsFlat: Story = {
  args: { initialView: 'usage' },
  play: async ({ canvasElement }) => {
    const breakdown = within(
      within(canvasElement).getByRole('heading', { name: 'Usage breakdown' }).closest('section')!,
    )
    await expect(breakdown.queryByRole('button', { expanded: true })).toBeNull()
    await expect(breakdown.queryByText('Platform')).toBeNull()
    await expect(breakdown.queryByText('Other')).toBeNull()
  },
}

/** The usage filter offers the features used and each groupable property's values. */
export const UsageFilters: Story = {
  args: {
    initialView: 'usage',
    groupKeys: ['region'],
    propertyValues: { region: ['us-east-1', 'eu-west-1'] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Filter' }))
    await expect(await screen.findByRole('option', { name: /Feature/ })).toBeVisible()
    await expect(await screen.findByRole('option', { name: /region/ })).toBeVisible()
    // Closed again: the open picker is the vendored filter's, checked in its own stories.
    await userEvent.keyboard('{Escape}')
  },
}

const LONG_STEMS = ['Compute memory GB-hours', 'Compute CPU hours', 'API requests']
/** One unique long name per spend item, like the auto-named features in the report. */
const LONG_NAMES = portalSpend.items.map(
  (_, index) => `${LONG_STEMS[index % LONG_STEMS.length]} (pup 1792753${index} eu-west-1)`,
)

/** Long feature names: the list widens to fit them and wraps what is still too long, never clipping. */
export const LongFeatureNames: Story = {
  args: {
    initialView: 'usage',
    data: {
      ...portalData,
      spend: {
        status: 'ready',
        data: {
          ...portalSpend,
          items: portalSpend.items.map((item, index) => ({
            ...item,
            name: LONG_NAMES[index]!,
          })),
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: 'Feature' }))
    for (const name of LONG_NAMES) {
      const option = await screen.findByRole('option', { name })
      // The whole name is inside the option's box, not cut off at its edge.
      await expect(option.scrollWidth).toBeLessThanOrEqual(option.clientWidth + 1)
    }
    await userEvent.click(screen.getByRole('option', { name: LONG_NAMES[1]! }))
    await waitFor(() =>
      expect(canvas.getByRole('combobox', { name: 'Feature' })).toHaveAttribute(
        'title',
        LONG_NAMES[1],
      ),
    )
  },
}

/** Top-ups by default, with what is left of each; then every transaction. */
export const Credits: Story = {
  args: { initialView: 'credits' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Auto top-up, on/ })).toBeVisible()
    await expect(canvas.getByText('Plan credits')).toBeVisible()
    await expect(canvas.getByText('in 7 days')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'All transactions' }))
    await expect(canvas.getByText('Invoice payment')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Added' }))
    await expect(canvas.queryByText('Invoice payment')).toBeNull()
  },
}

const periodTotals = (counted: number, total: number): CustomerPortalData['flows'] => ({
  status: 'ready',
  data: {
    flows: {
      in: { amount: money('1234.5', 'USD'), credits: '12345' },
      out: { amount: money('498', 'USD'), credits: '4980' },
    },
    counted,
    total,
  },
})

/** Added and Used are the period's totals, not a sum of the history's loaded page. */
export const CreditTotals: Story = {
  args: { initialView: 'credits', data: { ...portalData, flows: periodTotals(16, 16) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$1,234.50')).toBeVisible()
    await expect(canvas.getByText('12,345 credits')).toBeVisible()
    await expect(canvas.getByText('$498.00')).toBeVisible()
    await expect(canvas.queryByText(/From the latest/)).toBeNull()
  },
}

/** A window too long to read whole: the totals say how much of it they cover. */
export const CreditTotalsPartial: Story = {
  args: {
    initialView: 'credits',
    data: { ...portalData, flows: periodTotals(50000, 61234) },
  },
  play: async ({ canvasElement }) => {
    const notes = within(canvasElement).getAllByText(
      'From the latest 50,000 of 61,234 transactions',
    )
    await expect(notes).toHaveLength(2)
  },
}

/** The totals failed while the rest loaded: an inline retry, not blank figures. */
export const CreditTotalsFailed: Story = {
  args: {
    initialView: 'credits',
    data: { ...portalData, flows: { status: 'error', retry: retryTotals } },
  },
  play: async ({ canvasElement }) => {
    retryTotals.mockClear()
    const canvas = within(canvasElement)
    await expect(canvas.getByText('We couldn’t load your credits added and used')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /retry|try again/i }))
    await expect(retryTotals).toHaveBeenCalled()
  },
}

/** A wallet below zero reads as credits owed, in the warning tone, as a positive figure. */
export const NegativeBalance: Story = {
  args: {
    data: {
      ...portalData,
      wallets:
        portalData.wallets.status === 'ready'
          ? {
              status: 'ready',
              data: portalData.wallets.data.map((wallet, index) =>
                index === 0
                  ? {
                      ...wallet,
                      credits: '-42',
                      balance: { ...wallet.balance, amount: '-4.20' },
                    }
                  : wallet,
              ),
            }
          : portalData.wallets,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Credits owed')).toBeVisible()
    await expect(canvas.getByText(/credits used beyond the balance/)).toBeVisible()
  },
}

/** The Credits tab of a wallet below zero: "Owed", with the unit before "owed". */
export const NegativeBalanceCredits: Story = {
  args: { ...NegativeBalance.args, initialView: 'credits' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Owed')).toBeVisible()
    await expect(canvas.getByText('42 credits owed')).toBeVisible()
    await expect(canvas.queryByText(/owed credits/)).toBeNull()
  },
}

/** Auto top-up: threshold, amount and a wait between top-ups, saved in one go. */
export const AutoTopup: Story = {
  args: { initialView: 'credits' },
  play: async ({ canvasElement }) => {
    saveAutoTopup.mockClear()
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Auto top-up, on/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Auto top-up' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(saveAutoTopup).toHaveBeenCalledWith(expect.objectContaining({ id: 'wal_prepaid' }), {
        enabled: true,
        threshold: '2000',
        credits: '5000',
        cooldown: null,
      }),
    )
  },
}

/** A saved wait, switched off: the save clears it with zero rather than leave it stored. */
export const AutoTopupClearsWait: Story = {
  render: () => (
    <Portal
      initialView="credits"
      data={{
        ...portalData,
        wallets: {
          status: 'ready',
          data: portalWallets.map((w) =>
            w.autoTopup
              ? { ...w, autoTopup: { ...w.autoTopup, cooldown: { value: 30, unit: 'second' } } }
              : w,
          ),
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    saveAutoTopup.mockClear()
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Auto top-up, on/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Auto top-up' })
    await expect(within(dialog).getByRole('textbox', { name: 'Wait duration' })).toHaveValue('30')
    await userEvent.click(within(dialog).getByRole('switch', { name: /Wait between top-ups/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(saveAutoTopup).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'wal_prepaid' }),
        expect.objectContaining({ cooldown: { value: 0, unit: 'second' } }),
      ),
    )
  },
}

const staleWallets = portalWallets.map((w) => ({
  ...w,
  autoTopup: w.autoTopup && { ...w.autoTopup, enabled: false },
}))

/**
 * The wallets as a refetch delivers them: `first` now, the fixture (auto
 * top-up on) a moment later, as when the list on screen predates a save.
 */
function LateWallets({ first }: { first: CustomerPortalData['wallets'] }) {
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setFresh(true), 400)
    return () => clearTimeout(timer)
  }, [])
  return (
    <Portal
      initialView="credits"
      data={{ ...portalData, wallets: fresh ? portalData.wallets : first }}
    />
  )
}

/** Auto top-up is on when the wallets load: the button and the dialog's switch say so at once. */
export const AutoTopupLoadsOn: Story = {
  render: () => <LateWallets first={{ status: 'loading' }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /Auto top-up, on/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Auto top-up' })
    await expect(within(dialog).getByRole('switch', { name: /Enable auto top-up/ })).toBeChecked()
  },
}

/**
 * Opened on a stale list (off), then the wallets are read again (on): the
 * switch follows the loaded settings instead of the copy it opened with.
 */
export const AutoTopupFollowsLoadedWallet: Story = {
  render: () => <LateWallets first={{ status: 'ready', data: staleWallets }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Auto top-up, off/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Auto top-up' })
    await waitFor(() =>
      expect(within(dialog).getByRole('switch', { name: /Enable auto top-up/ })).toBeChecked(),
    )
    // Behind the modal (hidden from the accessibility tree), the button reads on too.
    await expect(
      canvas.getByRole('button', { name: /Auto top-up, on/, hidden: true }),
    ).toBeInTheDocument()
  },
}

/** The list, one invoice open in the drawer, and its download choice. */
export const Invoices: Story = {
  args: { initialView: 'invoices' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('6 invoices, newest first')).toBeVisible()
    await userEvent.click(canvas.getByText('INV-2026-01488'))
    const body = within(document.body)
    await waitFor(() => expect(body.getByText('Growth plan')).toBeVisible())
    await expect(body.getByText('Last attempt declined')).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: 'Download' }))
    const dialog = await screen.findByRole('dialog', { name: 'Download INV-2026-01488' })
    await expect(within(dialog).getByText('CSV')).toBeVisible()
  },
}

/** A new account: every panel says what will appear and when. */
export const Empty: Story = {
  args: { data: emptyPortalData },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Nothing due')).toBeVisible()
    await expect(canvas.getByText('No payment methods')).toBeVisible()
    await expect(canvas.getByText('No active plan', { selector: 'p' })).toBeVisible()
  },
}

export const Loading: Story = {
  args: { data: loadingPortalData },
}

/**
 * The merchant hid saved cards and plans, and renamed Credits: Overview keeps
 * its account summary, and the tab carries the merchant's name.
 */
export const MerchantHidesParts: Story = {
  args: {
    hidden: ['paymentMethods', 'subscriptions'],
    labels: { ...DEFAULT_PORTAL_CONFIG.labels, credits: 'Wallet' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Growth plan · in 7 days')).toBeVisible()
    await expect(canvas.queryByText('Visa •••• 4242')).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'Subscriptions' })).toBeNull()
    await expect(canvas.getByRole('tab', { name: 'Wallet' })).toBeVisible()
  },
}

/**
 * Usage as the merchant set it up: two presets, no calendar, no trend chart,
 * and customers may group the breakdown by an event property.
 */
export const MerchantUsageSettings: Story = {
  args: {
    initialView: 'usage',
    ranges: ['7d', 'last-month'],
    initialRange: '7d',
    allowCustomRange: false,
    hidden: ['usageTrend'],
    groupKeys: ['region'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab', { name: /7d|Last month/ })).toHaveLength(2)
    await expect(canvas.queryByRole('tab', { name: 'Today' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Pick a date range' })).toBeNull()
    await userEvent.click(canvas.getByRole('combobox', { name: 'Group by' }))
    await userEvent.click(await screen.findByRole('option', { name: 'By region' }))
    await waitFor(() =>
      expect(canvas.getByText('What you used and what it cost, by region')).toBeVisible(),
    )
    await expect(canvas.getByText('region eu-west-1')).toBeVisible()
  },
}

/** The merchant hid the wallet's history and Auto top-up: the panel and Add credits stay. */
export const MerchantCreditsSettings: Story = {
  args: { initialView: 'credits', hidden: ['transactions', 'autoTopup'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Add credits' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /Auto top-up/ })).toBeNull()
    await expect(canvas.queryByRole('tab', { name: 'All transactions' })).toBeNull()
  },
}

/** The merchant's brand colour repaints the mark, the active tab and primary buttons. */
export const Branded: Story = {
  args: { brandColor: '#0d6e66' },
}

/**
 * Back from checkout in a browser with no portal session: the illustration takes
 * the icon tile's place (the console passes its animated success mark), and the
 * copy points back to the portal without claiming how the payment went.
 */
export const CheckoutReturnNoSession: Story = {
  render: () => (
    <PortalNotice
      illustration={<span data-testid="return-illustration" className="size-28" />}
      title="You’re all set!"
      body="Head back to your billing portal to view your latest billing details."
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'You’re all set!' })).toBeVisible()
    await expect(canvas.getByTestId('return-illustration')).toBeInTheDocument()
    await expect(canvas.getByText(/view your latest billing details/)).toBeVisible()
  },
}

/** A notice that is not about the link takes its own icon in the tile. */
export const NoticeWithIcon: Story = {
  render: () => (
    <PortalNotice
      icon={<span data-testid="notice-icon" />}
      title="Billing is unavailable"
      body="Try again in a few minutes."
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('notice-icon')).toBeInTheDocument()
  },
}

/** The link has expired: say so, and who to ask. Never a sign-in page. */
export const LinkExpired: Story = {
  render: () => (
    <PortalNotice
      title="This link has expired"
      body="Billing links last a limited time. Ask the business that sent it for a new one."
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', { name: 'This link has expired' }),
    ).toBeVisible()
  },
}

import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { type PortalRange, type PortalView, money } from '@fp/domain'
import { CustomerPortalView } from './CustomerPortalView'
import { PortalNotice } from './PortalNotice'
import {
  PORTAL_NOW,
  emptyPortalData,
  loadingPortalData,
  noopPortalActions,
  portalData,
  portalInvoices,
} from './fixtures'
import type { CustomerPortalData } from './types'

const CHECKOUT = 'https://checkout.stripe.com/c/pay/cs_demo'
const payInvoice = fn(() => Promise.resolve<string | null>(CHECKOUT))
const addCredits = fn(() => Promise.resolve<string | null>(null))
const addCard = fn(() => Promise.resolve<string | null>(CHECKOUT))
const saveAutoTopup = fn(() => Promise.resolve())
const retryTotals = fn()

/** The portal with its navigation state held here, as the surface holds it in the URL. */
function Portal({
  data = portalData,
  initialView = 'overview',
  brandColor = null,
}: {
  data?: CustomerPortalData
  initialView?: PortalView
  brandColor?: string | null
}) {
  const [view, setView] = useState<PortalView>(initialView)
  const [range, setRange] = useState<PortalRange>('30d')
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const detail = invoiceId ? portalInvoices.find((i) => i.id === invoiceId) : null
  return (
    <CustomerPortalView
      brandName="Massio"
      brandColor={brandColor}
      views={['overview', 'usage', 'credits', 'invoices']}
      view={view}
      range={range}
      customRange={null}
      walletId={null}
      now={PORTAL_NOW}
      locale="en-US"
      data={{ ...data, invoiceDetail: detail ? { status: 'ready', data: detail } : null }}
      actions={{
        ...noopPortalActions,
        onViewChange: setView,
        onRangeChange: setRange,
        onOpenInvoice: setInvoiceId,
        payInvoice,
        addCredits,
        addCard,
        saveAutoTopup,
      }}
    />
  )
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
  },
}

/** Pay from the alert: the gateway's page opens, and its link stays in the dialog. */
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
        { kind: 'saved' },
        '',
      ),
    )
  },
}

/** Adding a card goes to the gateway; only gateways that save cards are offered. */
export const AddCard: Story = {
  play: async ({ canvasElement }) => {
    addCard.mockClear()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add card' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a card' })
    await expect(within(dialog).queryByText('Razorpay')).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(addCard).toHaveBeenCalledWith('stripe'))
    await screen.findByRole('dialog', { name: 'Add your card' })
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
  },
}

/** Top-ups by default, with what is left of each; then every transaction. */
export const Credits: Story = {
  args: { initialView: 'credits' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Auto top-up on/ })).toBeVisible()
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

/** Auto top-up: threshold, amount and a wait between top-ups, saved in one go. */
export const AutoTopup: Story = {
  args: { initialView: 'credits' },
  play: async ({ canvasElement }) => {
    saveAutoTopup.mockClear()
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Auto top-up on/ }))
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
    await expect(canvas.getByText('No saved cards')).toBeVisible()
    await expect(canvas.getByText('No active plan', { selector: 'p' })).toBeVisible()
  },
}

export const Loading: Story = {
  args: { data: loadingPortalData },
}

/** The merchant's brand colour repaints the mark, the active tab and primary buttons. */
export const Branded: Story = {
  args: { brandColor: '#0d6e66' },
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

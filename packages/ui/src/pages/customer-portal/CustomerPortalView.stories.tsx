import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import type { PortalRange, PortalView } from '@fp/domain'
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

const payInvoice = fn(() => Promise.resolve())
const addCredits = fn(() => Promise.resolve())
const addCard = fn(() => Promise.resolve())

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

/** A failed payment up top, the three figures, saved cards and plans. */
export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Your last payment didn’t go through')).toBeVisible()
    await expect(canvas.getByText('Growth plan · in 7 days')).toBeVisible()
    await expect(canvas.getByText('18,640 credits')).toBeVisible()
    await expect(canvas.getByText('Visa •••• 4242')).toBeVisible()
    await expect(canvas.getByText('Growth')).toBeVisible()
  },
}

/** Pay from the banner: one gateway is picked, and Pay hands the invoice to it. */
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
  },
}

export const Usage: Story = {
  args: { initialView: 'usage' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Usage charges, last 30 days')).toBeVisible()
    await expect(canvas.getByText('API calls · 43% of spend')).toBeVisible()
    await expect(canvas.getByText('$13.11')).toBeVisible()
    await expect(canvas.getByText('1.4M over · billed as usage')).toBeVisible()
  },
}

export const Credits: Story = {
  args: { initialView: 'credits' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Auto top-up on')).toBeVisible()
    await expect(canvas.getByText('Invoice payment')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Added' }))
    await expect(canvas.queryByText('Invoice payment')).toBeNull()
  },
}

/** The list, and one invoice open in the drawer. */
export const Invoices: Story = {
  args: { initialView: 'invoices' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('6 invoices, newest first')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'INV-2026-01488' }))
    const body = within(document.body)
    await waitFor(() => expect(body.getByText('Growth plan')).toBeVisible())
    await expect(body.getByText('The last attempt to pay this invoice was declined.')).toBeVisible()
  },
}

/** A new account: every card says what will appear and when. */
export const Empty: Story = {
  args: { data: emptyPortalData },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('You’re all paid up')).toBeVisible()
    await expect(canvas.getByText('No saved cards')).toBeVisible()
    await expect(canvas.getByText('No active plans')).toBeVisible()
  },
}

export const Loading: Story = {
  args: { data: loadingPortalData },
}

/** The merchant's brand colour repaints the mark and primary buttons. */
export const Branded: Story = {
  args: { brandColor: '#0f766e' },
}

/** The link has expired: say so, and who to ask. Never a sign-in page. */
export const LinkExpired: Story = {
  render: () => (
    <PortalNotice
      title="This link has expired"
      body="Billing links last a few hours. Ask the business that sent it for a new one."
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', { name: 'This link has expired' }),
    ).toBeVisible()
  },
}

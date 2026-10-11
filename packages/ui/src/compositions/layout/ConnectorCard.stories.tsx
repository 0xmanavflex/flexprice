import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CreditCardIcon } from '@ui/icons'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { ConnectorCard, type ConnectorCardProps } from './ConnectorCard'

/** Mirrors the real page: connecting, pausing and disconnecting all move the card. */
function ConnectorCardDemo(props: ConnectorCardProps) {
  const [connected, setConnected] = useState(props.connected)
  const [enabled, setEnabled] = useState(props.enabled)
  useEffect(() => {
    setConnected(props.connected)
    setEnabled(props.enabled)
  }, [props.connected, props.enabled])
  return (
    <div className="max-w-sm">
      <ConnectorCard
        {...props}
        connected={connected}
        enabled={enabled}
        onConnect={() => {
          props.onConnect()
          setConnected(true)
          setEnabled(true)
        }}
        onDisconnect={() => {
          props.onDisconnect()
          setConnected(false)
          setEnabled(false)
        }}
        onEnabledChange={(next) => {
          props.onEnabledChange(next)
          setEnabled(next)
        }}
      />
    </div>
  )
}

const meta = {
  title: 'Building blocks/Layout/ConnectorCard',
  component: ConnectorCard,
  parameters: { layout: 'padded' },
  argTypes: {
    name: { control: 'text' },
    description: { control: 'text' },
    docsUrl: { control: 'text' },
    connected: { control: 'boolean' },
    enabled: { control: 'boolean' },
    logo: { control: false },
    onConnect: { control: false },
    onDisconnect: { control: false },
    onConfigure: { control: false },
    onEnabledChange: { control: false },
    testId: { control: false },
    className: { control: 'text' },
  },
  args: {
    name: 'Stripe',
    description: 'Collect card and bank payments and reconcile them against invoices.',
    logo: <CreditCardIcon className="size-full" aria-hidden />,
    docsUrl: 'https://docs.example.com/connectors/stripe',
    connected: false,
    enabled: false,
    onConnect: fn(),
    onDisconnect: fn(),
    onConfigure: fn(),
    onEnabledChange: fn(),
  },
  render: (args) => <ConnectorCardDemo {...args} />,
} satisfies Meta<typeof ConnectorCard>

export default meta
type Story = StoryObj<typeof meta>

/** Flip `connected`, `enabled` and the docs link; the switch and buttons also work in place. */
export const Playground: Story = {}

/** Not connected: only the switch is offered, and turning it on starts the connect flow. */
export const NotConnected: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Not connected')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('switch', { name: 'Stripe enabled' }))
    await expect(args.onConnect).toHaveBeenCalledOnce()
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Disconnect' })).toBeVisible())
  },
}

/** Connected and on: Disconnect and Configure sit beside the switch. */
export const ConnectedEnabled: Story = {
  args: { connected: true, enabled: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('switch', { name: 'Stripe enabled' })).toBeChecked()
    await userEvent.click(canvas.getByRole('button', { name: 'Configure Stripe' }))
    await expect(args.onConfigure).toHaveBeenCalledOnce()
  },
}

/** Connected but paused: the switch is off while the connection stays. */
export const ConnectedPaused: Story = {
  args: { connected: true, enabled: false },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('switch', { name: 'Stripe enabled' })
    await expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    await expect(args.onEnabledChange).toHaveBeenCalledWith(true)
  },
}

/** Disconnecting returns the card to its not-connected footer. */
export const Disconnects: Story = {
  args: { connected: true, enabled: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Disconnect' }))
    await expect(args.onDisconnect).toHaveBeenCalledOnce()
    await waitFor(() => expect(canvas.getByText('Not connected')).toBeVisible())
  },
}

/** No `docsUrl`: the setup-guide arrow is omitted. */
export const WithoutDocsLink: Story = {
  args: { docsUrl: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole('link', { name: 'Setup guide for Stripe' }),
    ).not.toBeInTheDocument()
  },
}

/** A long description wraps inside the card instead of stretching it. */
export const LongDescription: Story = {
  args: {
    description:
      'Collect card, bank-debit and wallet payments, reconcile payouts against invoices automatically, handle disputes and refunds from one place, and keep customers and payment methods in sync in both directions.',
    connected: true,
    enabled: true,
  },
}

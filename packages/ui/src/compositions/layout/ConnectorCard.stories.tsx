import type { Meta, StoryObj } from '@storybook/react-vite'
import { CreditCardIcon } from '@ui/icons'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ConnectorCard } from './ConnectorCard'

const meta = {
  title: 'Building blocks/Layout/ConnectorCard',
  component: ConnectorCard,
  parameters: { layout: 'padded' },
  argTypes: {
    name: { control: 'text' },
    description: { control: 'text' },
    docsUrl: { control: 'text' },
    connected: { control: 'boolean' },
    logo: { control: false },
    onConnect: { control: false },
    onConfigure: { control: false },
    testId: { control: false },
    className: { control: 'text' },
  },
  args: {
    name: 'Stripe',
    description: 'Collect card and bank payments and reconcile them against invoices.',
    logo: <CreditCardIcon className="size-full" aria-hidden />,
    docsUrl: 'https://docs.example.com/connectors/stripe',
    connected: false,
    onConnect: fn(),
    onConfigure: fn(),
  },
  render: (args) => (
    <div className="max-w-sm">
      <ConnectorCard {...args} />
    </div>
  ),
} satisfies Meta<typeof ConnectorCard>

export default meta
type Story = StoryObj<typeof meta>

/** Flip `connected` and the docs link. */
export const Playground: Story = {}

/** Not connected: one Connect button, which starts the connect flow. */
export const NotConnected: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Not connected')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Connect Stripe' }))
    await expect(args.onConnect).toHaveBeenCalledOnce()
  },
}

/** Connected: a Connected marker and Configure, where disconnecting lives. */
export const Connected: Story = {
  args: { connected: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Connected')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Connect Stripe' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Configure Stripe' }))
    await expect(args.onConfigure).toHaveBeenCalledOnce()
  },
}

/** With billing entities: the connected action reads Manage. */
export const WithManageLabel: Story = {
  args: {
    connected: true,
    configureLabel: 'Manage',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Manage Stripe' })).toBeVisible()
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
  },
}

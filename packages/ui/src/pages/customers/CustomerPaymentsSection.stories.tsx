import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { CustomerPaymentsSection } from './CustomerPaymentsSection'

const meta = {
  title: 'App/Customers/Customer payments section',
  component: CustomerPaymentsSection,
  parameters: { layout: 'padded' },
  args: {
    gateways: [
      { id: 'conn_stripe', name: 'Stripe US' },
      { id: 'conn_razorpay', name: 'Razorpay India' },
    ],
    value: null,
    onChange: fn(),
  },
} satisfies Meta<typeof CustomerPaymentsSection>

export default meta
type Story = StoryObj<typeof meta>

export const Automatic: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const select = canvas.getByRole('combobox', { name: 'Preferred payment gateway' })
    await expect(select).toHaveTextContent('Automatic')
    await userEvent.click(select)
    await userEvent.click(await screen.findByRole('option', { name: 'Razorpay India' }))
    await expect(args.onChange).toHaveBeenCalledWith('conn_razorpay')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  },
}

export const Preferred: Story = {
  args: { value: 'conn_stripe' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const select = canvas.getByRole('combobox', { name: 'Preferred payment gateway' })
    await expect(select).toHaveTextContent('Stripe US')
    await userEvent.click(select)
    await userEvent.click(await screen.findByRole('option', { name: 'Automatic' }))
    await expect(args.onChange).toHaveBeenCalledWith(null)
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  },
}

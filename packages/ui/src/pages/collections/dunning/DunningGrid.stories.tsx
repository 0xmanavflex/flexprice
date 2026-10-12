import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { money } from '@fp/domain'
import { DunningGrid, type DunningCustomer } from './DunningGrid'

const customers: DunningCustomer[] = [
  {
    customerId: 'cust_acme',
    customerName: 'Acme Robotics',
    overdueCount: 3,
    overdue: money('12480.00', 'USD'),
    oldestDueDate: new Date('2026-08-14T00:00:00Z'),
    outstanding: money('15230.00', 'USD'),
  },
  {
    customerId: 'cust_globex',
    customerName: 'Globex',
    overdueCount: 1,
    overdue: money('980.50', 'USD'),
    oldestDueDate: new Date('2026-09-30T00:00:00Z'),
    outstanding: money('980.50', 'USD'),
  },
  {
    // Late only because its last payment failed: the invoice carries no due date.
    customerId: 'cust_initech',
    customerName: 'Initech',
    overdueCount: 1,
    overdue: money('310.00', 'USD'),
    oldestDueDate: null,
    outstanding: money('620.00', 'USD'),
  },
]

const meta = {
  title: 'App/Collections/Dunning/Dunning table',
  component: DunningGrid,
  parameters: { layout: 'padded' },
  args: { customers, locale: 'en-US', onCustomerClick: fn() },
} satisfies Meta<typeof DunningGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Acme Robotics')).toBeInTheDocument()

    const headers = Array.from(canvasElement.querySelectorAll('thead th')).map((th) =>
      (th.textContent ?? '').trim().toLowerCase(),
    )
    await expect(headers).toEqual(
      expect.arrayContaining([
        'customer',
        'overdue invoices',
        'overdue amount',
        'oldest due date',
        'outstanding',
      ]),
    )
    await expect(canvas.getByText('$12,480.00')).toBeInTheDocument()
  },
}

/** A failed payment with no due date has no oldest date to show: a dash, not today. */
export const NoDueDate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Initech')
    await expect(canvas.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  },
}

export const OpenCustomer: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByText('Globex'))
    await expect(args.onCustomerClick).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust_globex' }),
    )
  },
}

export const Loading: Story = { args: { customers: [], isLoading: true } }

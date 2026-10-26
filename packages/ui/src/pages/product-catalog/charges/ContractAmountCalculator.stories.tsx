import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { BillingPeriod } from '@fp/domain'
import { ContractAmountCalculator } from './ContractAmountCalculator'

const meta = {
  title: 'Product catalog/Charges/ContractAmountCalculator',
  component: ContractAmountCalculator,
  parameters: { layout: 'padded' },
  args: {
    billingPeriod: BillingPeriod.Monthly,
    amount: '',
    unitLabel: 'USD',
    onApply: fn(),
  },
} satisfies Meta<typeof ContractAmountCalculator>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** 12,000 over a year, billed monthly: 1,000.00 a month, written into the Amount. */
export const AnnualContractBilledMonthly: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Work out the price from a contract value' }),
    )
    await userEvent.type(await screen.findByRole('textbox', { name: /Contract value/ }), '12000')
    await expect(screen.getByRole('status')).toHaveTextContent('1000.00 USD')
    await userEvent.click(screen.getByRole('button', { name: 'Use this price' }))
    await expect(args.onApply).toHaveBeenCalledWith('1000.00')
  },
}

/** Nothing to work out until there is an amount. */
export const NeedsAnAmount: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', {
        name: 'Work out the price from a contract value',
      }),
    )
    await expect(await screen.findByRole('button', { name: 'Use this price' })).toBeDisabled()
  },
}

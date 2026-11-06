import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { emptySpendingAllowance, type SpendingAllowance } from '@fp/domain'
import { SpendingAllowancesSection, SpendingAllowanceForm } from './SpendingAllowancesSection'
const meta = {
  title: 'Pages/Contracts/Spending allowances',
  component: SpendingAllowancesSection,
} satisfies Meta<typeof SpendingAllowancesSection>
export default meta
type Story = StoryObj<typeof meta>
export const Draft: Story = {
  args: { currency: 'USD', value: [], onChange: fn() },
  render: function DraftAllowances(args) {
    const [value, setValue] = useState<SpendingAllowance[]>(args.value)
    return <SpendingAllowancesSection currency={args.currency} value={value} onChange={setValue} />
  },
}
export const WithWindows: Story = {
  args: {
    currency: 'USD',
    value: [
      {
        ...emptySpendingAllowance(),
        quota: '250',
        unit: 'week',
        every: 2,
        startDate: '2026-11-08',
        endDate: '2026-12-08',
      },
    ],
    onChange: fn(),
  },
}
export const InvalidQuota: Story = {
  args: { currency: 'USD', value: [], onChange: fn() },
  render: () => <SpendingAllowanceForm currency="USD" onCancel={fn()} onSubmit={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save allowance' }))
    await expect(canvas.getByText('Enter an amount above zero')).toBeVisible()
    await expect(canvas.getByRole('spinbutton', { name: /Spending allowance/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  },
}

export const ReturnsToBillingPeriod: Story = {
  args: { currency: 'EUR', value: [], onChange: fn() },
  render: (args) => (
    <SpendingAllowanceForm
      currency={args.currency}
      onCancel={() => undefined}
      onSubmit={(draft) => args.onChange([draft])}
    />
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const amount = canvas.getByRole('spinbutton', { name: /Spending allowance/ })
    await expect(amount).toHaveAttribute('type', 'number')
    await expect(canvas.getByText('Spending allowance (EUR)')).toBeVisible()
    await userEvent.type(amount, '250.55')
    await userEvent.click(canvas.getByRole('combobox', { name: 'Usage resets' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Daily' }))
    const every = canvas.getByRole('spinbutton', { name: /Every/ })
    await userEvent.clear(every)
    await userEvent.type(every, '0')
    await userEvent.click(canvas.getByRole('button', { name: 'Save allowance' }))
    await expect(every).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByText('Enter a whole number of at least 1')).toBeVisible()
    await expect(args.onChange).not.toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('combobox', { name: 'Usage resets' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Every billing period' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save allowance' }))
    await expect(args.onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        quota: '250.55',
        unit: 'subscription_period',
        every: 1,
        allocation: 'first_usage',
      }),
    ])
  },
}

export const QuotaOnlyEdit: Story = {
  args: { currency: 'USD', value: [], onChange: fn() },
  render: (args) => (
    <SpendingAllowanceForm
      currency={args.currency}
      quotaOnly
      initial={{ ...emptySpendingAllowance(), quota: '50' }}
      onCancel={() => undefined}
      onSubmit={(draft) => args.onChange([draft])}
    />
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('combobox', { name: 'Usage resets' })).toBeNull()
    const amount = canvas.getByRole('spinbutton', { name: /Spending allowance/ })
    await userEvent.clear(amount)
    await userEvent.type(amount, '75.25')
    await userEvent.click(canvas.getByRole('button', { name: 'Save allowance' }))
    await expect(args.onChange).toHaveBeenCalledWith([expect.objectContaining({ quota: '75.25' })])
  },
}

export const Saving: Story = {
  args: { currency: 'USD', value: [], onChange: fn() },
  render: (args) => (
    <SpendingAllowanceForm
      currency={args.currency}
      pending
      onCancel={() => undefined}
      onSubmit={(draft) => args.onChange([draft])}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('spinbutton', { name: /Spending allowance/ })).toBeDisabled()
    await expect(canvas.getByRole('combobox', { name: 'Usage resets' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Save allowance' })).toBeDisabled()
  },
}

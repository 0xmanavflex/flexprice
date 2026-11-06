import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { emptySpendingAllowance, type SpendingAllowance } from '@fp/domain'
import { SpendingAllowancesSection, SpendingAllowanceForm } from './SpendingAllowancesSection'
const meta = {
  title: 'Pages/Contracts/Spending allowances',
  component: SpendingAllowancesSection,
} satisfies Meta<typeof SpendingAllowancesSection>
export default meta
type Story = StoryObj<typeof meta>
export const Draft: Story = {
  args: { value: [], onChange: fn() },
  render: function DraftAllowances(args) {
    const [value, setValue] = useState<SpendingAllowance[]>(args.value)
    return <SpendingAllowancesSection value={value} onChange={setValue} />
  },
}
export const WithWindows: Story = {
  args: {
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
  args: { value: [], onChange: fn() },
  render: () => <SpendingAllowanceForm onCancel={fn()} onSubmit={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save allowance' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter an amount above zero')
  },
}

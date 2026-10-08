import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { money, formatMoney } from '@fp/domain'
import { CollectionsSummary } from './CollectionsSummary'

const meta = {
  title: 'Surfaces/CollectionsSummary',
  component: CollectionsSummary,
  parameters: { layout: 'padded' },
  args: {
    cells: [
      { label: 'Total outstanding', value: '$18,420.00', hint: '12 unpaid invoices' },
      {
        label: 'Total overdue',
        value: '$4,310.50',
        hint: '3 past their due date or failed',
        tone: 'danger',
      },
    ],
  },
  argTypes: {
    cells: { control: 'object' },
    isLoading: { control: 'boolean' },
    className: { control: false },
  },
} satisfies Meta<typeof CollectionsSummary>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  outstanding: string
  overdue: string
  currency: string
  unpaidCount: number
  overdueCount: number
  showOverdueCell: boolean
  isLoading: boolean
  notCounted: boolean
}

const isDecimal = (value: string) => /^-?\d+(\.\d+)?$/.test(value)

/** Edit the two totals and their counts; flip loading, drop the overdue cell, or show dashes for unknown values. */
export const Playground = {
  args: {
    outstanding: '18420.00',
    overdue: '4310.50',
    currency: 'USD',
    unpaidCount: 12,
    overdueCount: 3,
    showOverdueCell: true,
    isLoading: false,
    notCounted: false,
  },
  argTypes: {
    outstanding: { control: 'text', description: 'Plain decimal string; invalid reads as 0.' },
    overdue: { control: 'text', description: 'Plain decimal string; invalid reads as 0.' },
    currency: { control: 'select', options: ['USD', 'EUR', 'GBP', 'INR', 'JPY'] },
    unpaidCount: { control: { type: 'number', min: 0, max: 999, step: 1 } },
    overdueCount: { control: { type: 'number', min: 0, max: 999, step: 1 } },
    showOverdueCell: { control: 'boolean' },
    isLoading: { control: 'boolean' },
    notCounted: { control: 'boolean', description: 'Values are null, shown as a dash.' },
  },
  parameters: {
    controls: {
      include: [
        'outstanding',
        'overdue',
        'currency',
        'unpaidCount',
        'overdueCount',
        'showOverdueCell',
        'isLoading',
        'notCounted',
      ],
    },
  },
  render: ({
    outstanding,
    overdue,
    currency,
    unpaidCount,
    overdueCount,
    showOverdueCell,
    isLoading,
    notCounted,
  }) => {
    const format = (amount: string) =>
      notCounted ? null : formatMoney(money(isDecimal(amount) ? amount : '0', currency), 'en-US')
    return (
      <CollectionsSummary
        isLoading={isLoading}
        cells={[
          {
            label: 'Total outstanding',
            value: format(outstanding),
            hint: `${unpaidCount} unpaid invoices`,
          },
          ...(showOverdueCell
            ? [
                {
                  label: 'Total overdue',
                  value: format(overdue),
                  hint: `${overdueCount} past their due date or failed`,
                  tone: 'danger' as const,
                },
              ]
            : []),
        ]}
      />
    )
  },
} satisfies StoryObj<PlaygroundArgs>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$18,420.00')).toBeVisible()
    await expect(canvas.getByText('3 past their due date or failed')).toBeVisible()
  },
}

export const Loading: Story = { args: { isLoading: true } }

export const NothingOwed: Story = {
  args: {
    cells: [
      { label: 'Total outstanding', value: '$0.00', hint: '0 unpaid invoices' },
      { label: 'Total overdue', value: '$0.00', hint: '0 past their due date or failed' },
    ],
  },
}

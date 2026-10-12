import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { money, formatMoney } from '@fp/domain'
import { CollectionsSummary } from './CollectionsSummary'

const meta = {
  title: 'App/Collections/Payments/Collections summary',
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
    outstanding: {
      control: 'text',
      description: 'Plain decimal string; anything else shows a dash, never a zero.',
    },
    overdue: {
      control: 'text',
      description: 'Plain decimal string; anything else shows a dash, never a zero.',
    },
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
      notCounted || !isDecimal(amount) ? null : formatMoney(money(amount, currency), 'en-US')
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

export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Announced once, and never a figure: a zero that means "not loaded" is a lie.
    await expect(canvas.getByRole('status')).toHaveTextContent(/loading collections summary/i)
    await expect(canvas.queryByText(/\$0\.00/)).toBeNull()
  },
}

/** No earlier copy and the read failed: the word, not a zero, with a way back. */
export const Unavailable: Story = {
  args: { isUnavailable: true, onRetry: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('Unavailable')).toHaveLength(2)
    await expect(canvas.queryByText(/unpaid invoice/i)).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** The refresh failed; the previous figures stay, dimmed, with when they are from. */
export const StaleKeepsFigures: Story = {
  args: { stale: true, updatedAt: Date.now() - 4 * 60_000, onRetry: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$18,420.00')).toBeVisible()
    await expect(canvas.getByText(/couldn.t refresh/i)).toBeVisible()
  },
}

export const Refreshing: Story = { args: { refreshing: true, updatedAt: Date.now() } }

/** Invoices in other currencies are named, not folded into the lead total. */
export const MultipleCurrencies: Story = {
  args: {
    cells: [
      {
        label: 'Total outstanding',
        value: '$18,420.00',
        hint: '12 unpaid invoices in USD',
      },
      {
        label: 'Total overdue',
        value: '$4,310.50',
        hint: '3 past their due date or failed, in USD',
        tone: 'danger',
      },
    ],
    notes: [
      'Multiple currencies: totals are in USD only. 5 unpaid invoices in other currencies are not included.',
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/multiple currencies/i)).toBeVisible()
  },
}

/** More finalized invoices than were read: a floor, and it says so. */
export const PartialRead: Story = {
  args: {
    cells: [
      { label: 'Total outstanding', value: '$18,420.00', hint: 'at least 12 unpaid invoices' },
      {
        label: 'Total overdue',
        value: '$4,310.50',
        hint: 'at least 3 invoices past their due date or failed',
        tone: 'danger',
      },
    ],
    notes: ['Based on the newest finalized invoices only; older unpaid invoices are not included.'],
  },
}

export const NothingOwed: Story = {
  args: {
    cells: [
      // Genuinely empty: a dash and a plain statement, with no currency invented.
      { label: 'Total outstanding', value: null, hint: 'No unpaid invoices' },
      { label: 'Total overdue', value: null, hint: 'No invoices past their due date' },
    ],
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import type { DetailItem } from './DetailList'
import { DetailList } from './DetailList'

const items: DetailItem[] = [
  { label: 'Code', value: 'WELCOME25' },
  { label: 'Discount', value: '25% off' },
  { label: 'Duration', value: 'Repeating · 3 periods' },
  { label: 'Redemptions', value: '213 / 500' },
  { label: 'Status', value: 'Active' },
  { label: 'Created', value: 'Jan 12, 2026' },
  {
    label: 'Description',
    value: 'Applied automatically at checkout for new customers in their first month.',
    full: true,
  },
]

/**
 * A read-only list of label → value pairs, as a real `<dl>` so assistive tech
 * reads the pairing. `columns` is the only decision.
 */
const meta = {
  title: 'Foundation/Compositions/DetailList',
  component: DetailList,
  parameters: { layout: 'padded' },
  args: { items },
} satisfies Meta<typeof DetailList>

export default meta
type Story = StoryObj<typeof meta>

export const TwoColumns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // A term per item, and each value beside it — the pairing, not loose text.
    await expect(canvas.getAllByRole('term')).toHaveLength(items.length)
    await expect(canvas.getByText('WELCOME25')).toBeVisible()
  },
}

/** One column reads as a form; the pairing is unchanged. */
export const OneColumn: Story = {
  args: { columns: 1 },
}

/** A wide value — a description, metadata — spans both columns. */
export const WithFullWidthRow: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/applied automatically/i)).toBeVisible()
  },
}

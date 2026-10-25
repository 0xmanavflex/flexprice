import type { ComponentProps } from 'react'
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
  title: 'Building blocks/Tables & lists/DetailList',
  component: DetailList,
  parameters: { layout: 'padded' },
  args: { items },
  argTypes: {
    items: { control: 'object', description: 'Label/value pairs; `full` spans both columns.' },
    columns: { control: 'inline-radio', options: [1, 2] },
    className: { control: false },
  },
} satisfies Meta<typeof DetailList>

export default meta
type Story = StoryObj<typeof meta>

/** Repeats a pool of pairs deterministically, so `count` can grow past the hand-written seven. */
const makeItems = (count: number, pool: DetailItem[]): DetailItem[] =>
  pool.length === 0
    ? []
    : Array.from({ length: count }, (_, index): DetailItem => {
        const base = pool[index % pool.length] as DetailItem
        return index < pool.length
          ? base
          : { label: `${base.label} ${Math.floor(index / pool.length) + 1}`, value: base.value }
      })

type PlaygroundArgs = ComponentProps<typeof DetailList> & { count: number; fullWidthLast: boolean }

/** Drag `count` from 0 to 24 (it cycles the `items` pool), switch columns, toggle whether the last value spans the row. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { items, count: 7, columns: 2, fullWidthLast: true },
  argTypes: {
    count: { control: { type: 'range', min: 0, max: 24, step: 1 } },
    fullWidthLast: { control: 'boolean' },
  },
  render: ({ count, fullWidthLast, items: pool, ...args }) => {
    const list = makeItems(count, pool).map((item, index, all) => ({
      ...item,
      full: index === all.length - 1 ? fullWidthLast : false,
    }))
    return <DetailList {...args} items={list} />
  },
}

export const TwoColumns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // A term per item, and each value beside it: the pairing, not loose text.
    await expect(canvas.getAllByRole('term')).toHaveLength(items.length)
    await expect(canvas.getByText('WELCOME25')).toBeVisible()
  },
}

/** One column reads as a form; the pairing is unchanged. */
export const OneColumn: Story = {
  args: { columns: 1 },
}

/** A wide value: a description, metadata: spans both columns. */
export const WithFullWidthRow: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/applied automatically/i)).toBeVisible()
  },
}

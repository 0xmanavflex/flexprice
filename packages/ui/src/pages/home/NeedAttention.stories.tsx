import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { NeedAttention, type AttentionItem } from './NeedAttention'

const ITEMS: AttentionItem[] = [
  {
    id: 'overdue',
    title: '7 overdue invoices',
    detail: 'Acme Corp, Globex, Initech and 4 more',
    tone: 'critical',
    path: '/invoices?status=overdue',
  },
  {
    id: 'draft',
    title: '2 draft invoices',
    detail: 'Hooli, Umbrella',
    tone: 'neutral',
    path: '/invoices?status=draft',
  },
]

const meta = {
  title: 'App/Home/Need attention',
  component: NeedAttention,
  parameters: { layout: 'padded' },
  args: { attention: { status: 'ready', items: ITEMS }, onOpen: fn() },
  argTypes: { onOpen: { control: false } },
} satisfies Meta<typeof NeedAttention>

export default meta
type Story = StoryObj<typeof meta>

/** Each row says how many, who, and opens the filtered list that holds them. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: /needs attention/i })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /7 overdue invoices/i }))
    await expect(args.onOpen).toHaveBeenCalledWith('/invoices?status=overdue')
  },
}

export const SingleTask: Story = {
  args: { attention: { status: 'ready', items: [{ ...ITEMS[1]!, title: '1 draft invoice' }] } },
}

/** The API answered and nothing is waiting. */
export const NothingWaiting: Story = {
  args: { attention: { status: 'ready', items: [] } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Nothing needs attention.',
    )
  },
}

export const Loading: Story = { args: { attention: { status: 'loading', items: [] } } }

/** Not "nothing waiting": the question could not be asked, and it can be asked again. */
export const Unavailable: Story = {
  args: { attention: { status: 'unavailable', items: [], onRetry: fn() } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Tasks could not be loaded.')
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.attention.onRetry).toHaveBeenCalled()
  },
}

/** A failed refresh keeps the last good rows on screen and says they may be old. */
export const StaleKeepsRows: Story = {
  args: { attention: { status: 'ready', items: ITEMS, stale: true, onRetry: fn() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('out of date')
    await expect(canvas.getByRole('button', { name: /7 overdue invoices/i })).toBeInTheDocument()
  },
}

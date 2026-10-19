import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { CustomerUsageSummary } from './CustomerUsageSummary'

const meta = {
  title: 'App/Customers/Usage summary',
  component: CustomerUsageSummary,
  parameters: { layout: 'padded' },
  args: {
    rangeLabel: 'Last 30 days',
    revenue: '$1,240.00',
    eventCount: 18240,
    rows: [
      {
        id: 'feat_1',
        name: 'API calls',
        lookupKey: 'api_calls',
        eventCount: 16000,
        usage: '16,000 calls',
      },
      { id: 'feat_2', name: 'Storage', lookupKey: 'storage_gb', eventCount: 2240, usage: '84 GB' },
    ],
  },
} satisfies Meta<typeof CustomerUsageSummary>

export default meta
type Story = StoryObj<typeof meta>

/** Four tiles, then the features that drove them. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Usage revenue')).toBeVisible()
    await expect(canvas.getByText('$1,240.00')).toBeVisible()
    await expect(canvas.getByText('Features used')).toBeVisible()
    await expect(canvas.getByText('API calls')).toBeVisible()
  },
}

/** Unpriced usage says so, rather than showing $0. */
export const Unpriced: Story = {
  args: { revenue: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Not priced by Flexprice for this window'),
    ).toBeVisible()
  },
}

export const Empty: Story = {
  args: { rows: [], eventCount: 0 },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No usage in this period')).toBeVisible()
  },
}

export const Failed: Story = {
  args: { rows: [], error: 'Usage could not be loaded.', onRetry: fn() },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Usage could not be loaded.')).toBeVisible()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { CustomerEntitlementUsage } from './CustomerEntitlementUsage'

const meta = {
  title: 'App/Customers/Entitlement usage',
  component: CustomerEntitlementUsage,
  parameters: { layout: 'padded' },
  args: {
    locale: 'en-US',
    rows: [
      {
        id: 'feat_1',
        name: 'API calls',
        type: 'metered',
        used: 4200,
        limit: 10000,
        isEnabled: true,
        resetsOn: new Date('2026-11-01T00:00:00Z'),
      },
      {
        id: 'feat_2',
        name: 'Seats',
        type: 'metered',
        used: 12,
        limit: 10,
        isEnabled: true,
        resetsOn: null,
      },
      {
        id: 'feat_3',
        name: 'AI tokens',
        type: 'metered',
        used: 90210,
        limit: null,
        isEnabled: true,
        resetsOn: null,
      },
      {
        id: 'feat_4',
        name: 'SSO',
        type: 'boolean',
        used: undefined,
        limit: null,
        isEnabled: true,
        resetsOn: null,
      },
    ],
  },
} satisfies Meta<typeof CustomerEntitlementUsage>

export default meta
type Story = StoryObj<typeof meta>

/** One row per entitled feature, in a table rather than a grid of cards. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const table = canvas.getByRole('region', { name: 'Entitlements table' })
    const t = within(table)
    for (const header of ['Feature', 'Value', 'Resets', 'Usage']) {
      await expect(t.getByRole('columnheader', { name: new RegExp(header) })).toBeVisible()
    }
    // The row names the feature; its meter repeats the name for screen readers only.
    await expect(t.getByRole('row', { name: /API calls/ })).toBeVisible()
    await expect(t.getByText('4,200 of 10,000')).toBeVisible()
    await expect(t.getByText('Nov 1, 2026')).toBeVisible()
  },
}

/**
 * The same states the overview draws, from the same table: unlimited says so
 * with no bar, over the limit turns red, a boolean is included.
 */
export const States: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('90,210 of unlimited')).toBeVisible()
    await expect(canvas.queryByRole('progressbar', { name: /AI tokens/ })).toBeNull()
    await expect(canvas.getByText('12 of 10')).toHaveClass('text-destructive')
    await expect(canvas.getByText('Included')).toBeVisible()
  },
}

/**
 * Under its section title the table's tools sit in the header, as on the other
 * overview tables: Filter and Sort beside the title, no search row.
 */
export const HeaderTools: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Sort' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Filter' })).toBeVisible()
    await expect(canvas.queryByLabelText('Search features')).toBeNull()
  },
}

export const Loading: Story = {
  args: { rows: [], isLoading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('table')).toBeNull()
  },
}

export const Empty: Story = {
  args: { rows: [] },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No entitlements yet')).toBeVisible()
  },
}

export const Failed: Story = {
  args: { rows: [], error: 'Usage could not be loaded.', onRetry: fn() },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Usage could not be loaded.')).toBeVisible()
  },
}

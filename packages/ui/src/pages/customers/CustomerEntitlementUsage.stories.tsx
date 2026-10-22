import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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
    const table = canvas.getByRole('region', { name: 'Entitlement usage table' })
    const t = within(table)
    for (const header of ['Feature', 'Value', 'Usage', 'Resets on']) {
      await expect(t.getByRole('columnheader', { name: new RegExp(header) })).toBeVisible()
    }
    await expect(t.getByText('API calls')).toBeVisible()
    await expect(t.getByText('4,200 / 10,000')).toBeVisible()
    await expect(t.getByText('Nov 1, 2026')).toBeVisible()
  },
}

/** Unlimited says so; over the limit reads past 100%; a boolean is on or off. */
export const States: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('90,210 / Unlimited')).toBeVisible()
    await expect(canvas.getByText('12 / 10')).toHaveClass('text-destructive')
    await expect(canvas.getByText('Enabled')).toBeVisible()
  },
}

/** The search narrows the rows like every other detail table. */
export const Search: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Search features'), 'Seats')
    await expect(await canvas.findByText('12 / 10')).toBeVisible()
    await expect(canvas.queryByText('API calls')).toBeNull()
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

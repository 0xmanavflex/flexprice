import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { DEFAULT_USAGE_SYNC_QUERY, type UsageSync, money } from '@fp/domain'
import { UsageSyncGrid } from './UsageSyncGrid'

function fixtures(): UsageSync[] {
  const base = {
    planId: 'plan_pro',
    periodStart: new Date('2026-08-01T00:00:00Z'),
    periodEnd: new Date('2026-09-01T00:00:00Z'),
  }
  return [
    {
      ...base,
      id: 'ur_01',
      customerId: 'cust_1',
      customerExternalId: 'acme-corp',
      subscriptionId: 'sub_01',
      amount: money('120.00', 'USD'),
      syncs: [
        {
          provider: 'aws_marketplace',
          skipped: false,
          skipReason: '',
          syncedAt: new Date('2026-09-02T00:00:00Z'),
          reportingId: 'rep_1',
          agreementId: 'agr_1',
          connectionId: 'conn_1',
        },
      ],
    },
    {
      ...base,
      id: 'ur_02',
      customerId: 'cust_2',
      customerExternalId: 'globex',
      subscriptionId: 'sub_02',
      amount: money('45.50', 'USD'),
      syncs: [],
    },
    {
      ...base,
      id: 'ur_03',
      customerId: 'cust_3',
      customerExternalId: 'initech',
      subscriptionId: 'sub_03',
      amount: money('10.00', 'USD'),
      syncs: [
        {
          provider: 'gcp_marketplace',
          skipped: true,
          skipReason: 'no agreement',
          syncedAt: null,
          reportingId: '',
          agreementId: '',
          connectionId: 'conn_2',
        },
      ],
    },
  ]
}

const meta = {
  title: 'Surfaces/UsageSyncGrid',
  component: UsageSyncGrid,
  parameters: { layout: 'padded' },
  args: {
    usageSyncs: fixtures(),
    total: 3,
    query: { ...DEFAULT_USAGE_SYNC_QUERY },
    onQueryChange: fn(),
    onRefresh: fn(),
    onUsageSyncClick: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof UsageSyncGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('acme-corp')).toBeInTheDocument()
    await expect(canvas.getByText('AWS Marketplace')).toBeInTheDocument()
    await expect(canvas.getByText('Not synced')).toBeInTheDocument()
  },
}

export const Empty: Story = { args: { usageSyncs: [], total: 0 } }

export const Searching: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText('Search usage syncs'), 'glo')
    await waitFor(() =>
      expect(args.onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: expect.stringContaining('g') }),
      ),
    )
  },
}

export const OpeningARow: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByText('globex'))
    await expect(args.onUsageSyncClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'ur_02' }))
  },
}

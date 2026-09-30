import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { money } from '@fp/domain'
import { UsageSyncDetailSheet } from './UsageSyncDetailSheet'

const meta = {
  title: 'Surfaces/UsageSyncDetailSheet',
  component: UsageSyncDetailSheet,
  parameters: { layout: 'fullscreen' },
  args: {
    onClose: fn(),
    usageSync: {
      id: 'ur_01',
      customerId: 'cust_1',
      customerExternalId: 'acme-corp',
      subscriptionId: 'sub_01',
      planId: 'plan_pro',
      amount: money('120.00', 'USD'),
      periodStart: null,
      periodEnd: null,
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
  },
} satisfies Meta<typeof UsageSyncDetailSheet>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('AWS Marketplace')).toBeInTheDocument()
    await expect(screen.getByText('Skipped')).toBeInTheDocument()
    await expect(screen.getByText('Synced')).toBeInTheDocument()
  },
}

export const NotSynced: Story = {
  args: {
    usageSync: {
      id: 'ur_02',
      customerId: 'cust_2',
      customerExternalId: 'globex',
      subscriptionId: 'sub_02',
      planId: 'plan_pro',
      amount: money('45.50', 'USD'),
      periodStart: null,
      periodEnd: null,
      syncs: [],
    },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(
      await screen.findByText('This usage has not been reported to any marketplace.'),
    ).toBeInTheDocument()
  },
}

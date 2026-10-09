import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { type UsageSync, money } from '@fp/domain'
import { UsageSyncDetailSheet } from './UsageSyncDetailSheet'

const meta = {
  title: 'App/Developers/Usage sync/Usage sync detail sheet',
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

const PLAYGROUND_PROVIDERS = ['aws_marketplace', 'gcp_marketplace', 'azure_marketplace'] as const

interface PlaygroundArgs {
  /** Closes the sheet when off; toggle it to reopen. */
  open: boolean
  customerExternalId: string
  amount: number
  currency: string
  /** Marketplaces the record reached, 0 to 3; 0 shows the "not reported" copy. */
  syncCount: number
  /** How many of those were deliberately skipped, counted from the last. */
  skippedCount: number
  onClose: () => void
}

function UsageSyncDetailSheetPlayground({
  open,
  customerExternalId,
  amount,
  currency,
  syncCount,
  skippedCount,
  onClose,
}: PlaygroundArgs) {
  const [isOpen, setIsOpen] = useState(open)
  const usageSync: UsageSync = {
    id: 'ur_playground',
    customerId: 'cust_1',
    customerExternalId,
    subscriptionId: 'sub_01',
    planId: 'plan_pro',
    amount: money(Number.isFinite(amount) ? amount.toFixed(2) : '0.00', currency),
    periodStart: null,
    periodEnd: null,
    syncs: PLAYGROUND_PROVIDERS.slice(0, syncCount).map((provider, index) => {
      const skipped = index >= syncCount - skippedCount
      return {
        provider,
        skipped,
        skipReason: skipped ? 'no agreement' : '',
        syncedAt: skipped ? null : new Date('2026-09-02T00:00:00Z'),
        reportingId: skipped ? '' : `rep_${index + 1}`,
        agreementId: skipped ? '' : `agr_${index + 1}`,
        connectionId: `conn_${index + 1}`,
      }
    }),
  }
  return (
    <UsageSyncDetailSheet
      usageSync={isOpen ? usageSync : null}
      onClose={() => {
        setIsOpen(false)
        onClose()
      }}
    />
  )
}

/** Change the record's identity, amount and how many marketplaces synced or skipped it. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^on[A-Z].*$/ } },
  args: {
    open: true,
    customerExternalId: 'acme-corp',
    amount: 120,
    currency: 'USD',
    syncCount: 2,
    skippedCount: 1,
    onClose: fn(),
  },
  argTypes: {
    open: { control: 'boolean' },
    customerExternalId: { control: 'text' },
    amount: { control: { type: 'number', min: 0, max: 100_000, step: 5 } },
    currency: { control: 'select', options: ['USD', 'EUR', 'GBP', 'INR'] },
    syncCount: { control: { type: 'number', min: 0, max: 3, step: 1 } },
    skippedCount: { control: { type: 'number', min: 0, max: 3, step: 1 } },
  },
  render: (args) => (
    <UsageSyncDetailSheetPlayground
      key={`${args.open}|${args.customerExternalId}|${args.syncCount}`}
      {...args}
    />
  ),
}

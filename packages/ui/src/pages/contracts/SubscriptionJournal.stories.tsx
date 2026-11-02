import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { SubscriptionJournal } from './SubscriptionJournal'
import { ACME_JOURNAL, ACME_POB_NAMES } from './subscriptionRevenueFixtures'

const meta = {
  title: 'App/Contracts/Contract journal',
  component: SubscriptionJournal,
  args: {
    journal: ACME_JOURNAL,
    isLoading: false,
    obligationNames: ACME_POB_NAMES,
    invoiceNumbers: { inv_jan: 'INV-202601-00001' },
    onOpenInvoice: fn(),
  },
} satisfies Meta<typeof SubscriptionJournal>

export default meta
type Story = StoryObj<typeof meta>

/** The January invoice and January's revenue, one row per entry with its lines stacked; both sides total 1,500. */
export const January: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('Invoice: INV-202601-00001')[0]).toBeVisible()
    await expect(canvas.getAllByText('Revenue recognized')[0]).toBeVisible()
    await expect(canvas.getByText(/debited \$1,500\.00 · credited \$1,500\.00/)).toBeVisible()
  },
}

export const Empty: Story = { args: { journal: { ...ACME_JOURNAL, entries: [] } } }

export const Loading: Story = { args: { journal: undefined, isLoading: true } }

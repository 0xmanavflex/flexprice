import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { UsageBillingView } from './UsageBillingView'
import { ACCOUNTS, DUE, TODAY } from './fixtures'

const meta = {
  title: 'App/Self-billing/Usage & billing',
  component: UsageBillingView,
  tags: ['!autodocs'],
  args: {
    summary: ACCOUNTS.trial,
    today: TODAY,
    onUpgrade: fn(),
    onOpenPortal: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-4xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UsageBillingView>

export default meta
type Story = StoryObj<typeof meta>

/** The trial: info strip, no invoices, Upgrade in the plan's footer. */
export const Trial: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText(
        'Your trial ends on Nov 4, 2026, in 15 days. Then $199.00 a month + 0.5% of what you bill through Flexprice.',
      ),
    ).toBeVisible()
    await expect(canvas.getByText('Free trial, then Pay as you go')).toBeVisible()
    // The plan's charges, each priced as the API reports it.
    await expect(canvas.getByText('Platform fee')).toBeVisible()
    await expect(canvas.getByText('$199.00 a month')).toBeVisible()
    await expect(canvas.getByText('0.5% of what you bill through Flexprice')).toBeVisible()
    // The zero-priced Events charge only meters the trial's limit: no price row.
    await expect(canvas.queryByText('$0.00 per Events')).toBeNull()
    await expect(canvas.getByText('Nov 4, 2026 · 15 days left')).toBeVisible()
    await expect(canvas.getByText('No fee during the trial')).toBeVisible()
    await expect(canvas.getByText('No invoices yet')).toBeVisible()
    await expect(canvas.getByText('Added when you upgrade')).toBeVisible()
    // Not reported by the API: no Billing email row rather than the wrong address.
    await expect(canvas.queryByText('Billing email')).toBeNull()
    await expect(canvas.queryByRole('alert')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Upgrade' }))
    await expect(args.onUpgrade).toHaveBeenCalled()
  },
}

/** Near the cap: the trial-only warning under the meter. */
export const NearTheEventCap: Story = {
  args: { summary: ACCOUNTS.near },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('At 50,000 your account is locked until you upgrade.'),
    ).toBeVisible()
  },
}

/** Locked at the event cap: the red alert, the limit reached, no invoice yet. */
export const LockedAtTheEventCap: Story = {
  args: { summary: ACCOUNTS.lockedEvents },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Your account is locked and read-only')).toBeVisible()
    await expect(canvas.getByText('Event limit reached')).toBeVisible()
    await expect(canvas.getByText('Sandbox, read-only')).toBeVisible()
    await expect(canvas.getByText('Limit reached')).toBeVisible()
    await expect(canvas.getByText('Your first invoice is raised when you upgrade.')).toBeVisible()
  },
}

/** Locked after the trial: the overdue invoice can be paid. */
export const LockedAfterTheTrial: Story = {
  args: { summary: ACCOUNTS.lockedTrial },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText(
        'Your trial ended on Oct 10, 2026. Events are still being recorded. Upgrade to make changes again and use production.',
      ),
    ).toBeVisible()
    await expect(canvas.getByText('Oct 10, 2026 · $199.00 overdue')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Pay' }))
    await expect(args.onOpenPortal).toHaveBeenCalled()
  },
}

/** Live: the plan's price, no limit, paid invoices to download, Manage billing. */
export const Live: Story = {
  args: { summary: ACCOUNTS.live, billingEmail: 'billing@acme.io' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Pay as you go')).toBeVisible()
    await expect(canvas.getByText('$199.00 a month')).toBeVisible()
    await expect(canvas.getByText('Next invoice on Oct 31, 2026.')).toBeVisible()
    await expect(canvas.getByText('No limit on your plan')).toBeVisible()
    await expect(canvas.getByText('Charged as your plan sets out')).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Download FP-0003' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /Manage billing/ })).toBeEnabled()
    await expect(canvas.getByText('billing@acme.io')).toBeVisible()
    await expect(canvas.getByText('Managed in the billing portal')).toBeVisible()
  },
}

/** Live with an invoice due: Pay in place of the download. */
export const LiveInvoiceDue: Story = {
  args: { summary: DUE, billingEmail: 'billing@acme.io' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Pay' })).toBeVisible()
  },
}

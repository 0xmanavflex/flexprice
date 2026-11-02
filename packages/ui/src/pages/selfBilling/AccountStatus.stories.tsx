import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { AccountLockedDialog, AccountStatusPill, CreatingPausedScreen } from './AccountStatus'
import { ACCOUNTS, TODAY } from './fixtures'

const meta = {
  title: 'App/Self-billing/Account status',
  component: AccountStatusPill,
  tags: ['!autodocs'],
  args: {
    summary: ACCOUNTS.trial,
    today: TODAY,
    onViewDetails: fn(),
    onUpgrade: fn(),
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-80 justify-end p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountStatusPill>

export default meta
type Story = StoryObj<typeof meta>

/** A calm trial: purple, days left; hover opens the card with both meters. */
export const Trial: Story = {
  play: async ({ args, canvasElement }) => {
    const pill = within(canvasElement).getByRole('button', { name: /Trial · 15 days left/ })
    await userEvent.hover(pill)
    await expect(
      await screen.findByText(
        'Ends on Nov 4, 2026, or at 50,000 events. Then $199.00 a month + 0.5% of what you bill through Flexprice.',
      ),
    ).toBeVisible()
    await expect(screen.getByRole('progressbar', { name: 'Trial' })).toBeVisible()
    await expect(screen.getByText('31,240 of 50,000')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Upgrade' }))
    await expect(args.onUpgrade).toHaveBeenCalled()
  },
}

/** The last 7 days: amber. */
export const TrialEnding: Story = {
  args: { summary: ACCOUNTS.ending },
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement).getByRole('button', { name: /Trial · 3 days left/ }),
    )
    await expect(
      await screen.findByText('Ends on Oct 23, 2026. After that your account becomes read-only.'),
    ).toBeVisible()
  },
}

/** Past 80% of the events: the share wins over the days. */
export const NearTheEventCap: Story = {
  args: { summary: ACCOUNTS.near },
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement).getByRole('button', { name: /Trial · 93% of events/ }),
    )
    await expect(
      await screen.findByText(
        '93% of trial events used. At 50,000 your account becomes read-only.',
      ),
    ).toBeVisible()
  },
}

/** Locked at the event cap: red, no meters. */
export const LockedAtTheEventCap: Story = {
  args: { summary: ACCOUNTS.lockedEvents },
  play: async ({ args, canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button', { name: /Account locked/ }))
    await expect(
      await screen.findByText(
        'Your account is locked and read-only. You used all 50,000 trial events.',
      ),
    ).toBeVisible()
    await expect(screen.queryByRole('progressbar')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'View details' }))
    await expect(args.onViewDetails).toHaveBeenCalled()
    // The hint closes with an exit transition, so it leaves the DOM a moment
    // after the click; on a loaded CI runner a synchronous check saw it still there.
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Your account is locked and read-only. You used all 50,000 trial events.',
        ),
      ).toBeNull(),
    )
  },
}

/** Locked after the trial ended unpaid. */
export const LockedAfterTheTrial: Story = {
  args: { summary: ACCOUNTS.lockedTrial },
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button', { name: /Account locked/ }))
    await expect(
      await screen.findByText('Your account is locked and read-only. Your trial ended on Oct 10.'),
    ).toBeVisible()
  },
}

/** Live: no pill at all. */
export const Live: Story = {
  args: { summary: ACCOUNTS.live },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
  },
}

/** A write the API refused: the pill's card, as a dialog. */
export const LockedDialog: Story = {
  args: { summary: ACCOUNTS.lockedTrial },
  render: function Render(args) {
    const [open, setOpen] = useState(true)
    return <AccountLockedDialog {...args} open={open} onOpenChange={setOpen} />
  },
  play: async () => {
    const dialog = within(await screen.findByRole('dialog', { name: 'Account locked' }))
    await expect(dialog.getByRole('button', { name: 'Upgrade' })).toBeVisible()
  },
}

/** A create page opened directly while locked. */
export const CreatingPaused: Story = {
  args: { summary: ACCOUNTS.lockedEvents },
  render: (args) => <CreatingPausedScreen {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Creating is paused' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Upgrade' })).toBeVisible()
  },
}

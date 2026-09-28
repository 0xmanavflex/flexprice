import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent } from 'storybook/test'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * A confirm step for a consequential action. Presentational: the caller owns
 * `open` and what confirming does, so every state here is reached by props.
 */
const meta = {
  title: 'Foundation/Compositions/ConfirmDialog',
  component: ConfirmDialog,
  parameters: {
    layout: 'padded',
    // Base UI renders `aria-hidden` focus guards with `tabindex="0"` around
    // every portalled surface; axe flags them and we cannot fix a vendored
    // library. See AppShell.stories.tsx.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    title: 'Archive coupon?',
    confirmLabel: 'Archive',
    onConfirm: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async () => {
    // Titled, so the dialog announces more than "dialog".
    await expect(await screen.findByRole('dialog', { name: 'Archive coupon?' })).toBeInTheDocument()
  },
}

/** The destructive weight reads before the words do. */
export const Destructive: Story = {
  args: {
    destructive: true,
    description: 'It stops being offered at checkout. Existing redemptions are kept.',
  },
  parameters: {
    // The base-nova `destructive` button variant is a soft fill
    // (bg-destructive/10 + destructive-coloured text) at 3.82:1 against its own
    // tint — a vendored design-token contrast gap, not this dialog's, tracked
    // separately. The `aria-hidden-focus` rule is restated because a story-level
    // `rules` array overwrites the meta's rather than merging.
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'color-contrast', enabled: false },
        ],
      },
    },
  },
}

/** Confirming reports intent; where it goes is the caller's decision. */
export const ReportsConfirmation: Story = {
  play: async ({ args }) => {
    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }))
    await expect(args.onConfirm).toHaveBeenCalledOnce()
  },
}

/**
 * In flight: the button shows progress and both controls lock, so the dialog
 * cannot close underneath a request that has not returned.
 */
export const Pending: Story = {
  args: { isPending: true },
  play: async () => {
    const confirm = await screen.findByRole('button', { name: 'Working…' })
    await expect(confirm).toBeDisabled()
    await expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  },
}

/** A failure is shown inline so the dialog can stay open. */
export const WithError: Story = {
  args: { error: 'The coupon could not be archived. Try again.' },
  play: async () => {
    await expect(await screen.findByRole('alert')).toHaveTextContent(/could not be archived/i)
  },
}

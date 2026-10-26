import { useEffect, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { ConfirmDialog } from './ConfirmDialog'

/** Holds `open` so Cancel and Escape really close it, with a button to reopen; the `open` control still drives it. */
function Controlled(args: ComponentProps<typeof ConfirmDialog>) {
  const [open, setOpen] = useState(args.open)
  useEffect(() => setOpen(args.open), [args.open])
  return (
    <>
      {open ? null : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          Reopen dialog
        </Button>
      )}
      <ConfirmDialog
        {...args}
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          args.onOpenChange(next)
        }}
      />
    </>
  )
}

/**
 * A confirm step for a consequential action. Presentational: the caller owns
 * `open` and what confirming does, so every state here is reached by props.
 */
const meta = {
  title: 'Building blocks/Feedback & states/ConfirmDialog',
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
  argTypes: {
    open: { control: 'boolean' },
    title: { control: 'text' },
    description: { control: 'text' },
    confirmLabel: { control: 'text' },
    cancelLabel: { control: 'text' },
    destructive: { control: 'boolean', description: 'Destructive button weight.' },
    isPending: {
      control: 'boolean',
      description: 'Request in flight: locks both buttons and blocks Escape and overlay dismissal.',
    },
    pendingLabel: { control: 'text', description: 'Confirm button text while pending.' },
    error: { control: 'text', description: 'Inline failure message; empty for none.' },
    onOpenChange: { control: false },
    onConfirm: { control: false },
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop as a control: flip pending/destructive, set an error, close it and reopen. */
export const Playground: Story = {
  args: {
    description: 'It stops being offered at checkout. Existing redemptions are kept.',
    cancelLabel: 'Cancel',
    destructive: false,
    isPending: false,
    error: '',
  },
}

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
    // The `aria-hidden-focus` rule is restated because a story-level `rules`
    // array overwrites the meta's rather than merging.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
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

/** Escape cannot dismiss a dialog with a request in flight; the caller is never told it closed. */
export const PendingBlocksDismissal: Story = {
  args: { isPending: true, pendingLabel: 'Archiving…' },
  play: async ({ args }) => {
    await expect(await screen.findByRole('button', { name: 'Archiving…' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    await expect(args.onOpenChange).not.toHaveBeenCalled()
    await expect(screen.getByRole('dialog', { name: 'Archive coupon?' })).toBeInTheDocument()
    await expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  },
}

/** A fast double click reports one confirmation, even before the caller has rendered `isPending`. */
export const DoubleClickConfirmsOnce: Story = {
  play: async ({ args }) => {
    const confirm = await screen.findByRole('button', { name: 'Archive' })
    await userEvent.dblClick(confirm)
    await expect(args.onConfirm).toHaveBeenCalledOnce()
  },
}

/** A failure is shown inline so the dialog can stay open. */
export const WithError: Story = {
  args: { error: 'The coupon could not be archived. Try again.' },
  play: async () => {
    await expect(await screen.findByRole('alert')).toHaveTextContent(/could not be archived/i)
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { CouponEditorSheet } from './CouponEditorSheet'

/**
 * The coupon editor, as a right-hand drawer — the detail page stays behind it.
 * Editing a coupon is a rename (the discount is immutable), so the form is
 * small and the code and discount show as read-only context. Open by default.
 */
const meta = {
  title: 'Surfaces/CouponEditorSheet',
  component: CouponEditorSheet,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onOpenChange: fn(),
    defaultValue: { name: 'Launch 20% off' },
    onSubmit: fn(),
  },
} satisfies Meta<typeof CouponEditorSheet>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    // The drawer renders in a portal, so query the whole document body.
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('Edit coupon')).toBeInTheDocument()
  },
}

/** The read-only summary tells the person which coupon they are renaming. */
export const WithSummary: Story = {
  args: { summary: { code: 'LAUNCH20', discount: '20% off' } },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('LAUNCH20')).toBeInTheDocument()
  },
}

export const Submitting: Story = { args: { isSubmitting: true } }

export const SubmitError: Story = {
  args: { submitError: 'Could not rename the coupon. Try again.' },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('alert')).toBeInTheDocument()
  },
}

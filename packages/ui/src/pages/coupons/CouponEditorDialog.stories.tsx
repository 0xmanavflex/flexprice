import { emptyCoupon } from '@fp/domain'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CouponEditorDialog } from './CouponEditorDialog'

/**
 * The coupon editor, as a centred dialog — the page stays behind it.
 * Editing a coupon is a rename (the discount is immutable), so the form is
 * small and the code and discount show as read-only context. Open by default.
 */
const meta = {
  title: 'Surfaces/CouponEditorDialog',
  component: CouponEditorDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onOpenChange: fn(),
    defaultValue: { name: 'Launch 20% off' },
    onSubmit: fn(),
  },
} satisfies Meta<typeof CouponEditorDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    // The dialog renders in a portal, so query the whole document body.
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

/** Create mode collects the whole coupon; type and duration reveal only the fields that apply. */
export const Create: Story = {
  args: { mode: 'create', defaultValue: emptyCoupon(), onSubmit: fn() },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'New coupon' })).toBeInTheDocument()
    await expect(screen.getByRole('textbox', { name: /percentage off/i })).toBeInTheDocument()
    await expect(screen.queryByRole('textbox', { name: /amount off/i })).not.toBeInTheDocument()
  },
}

/** Validation runs through the domain schema; a valid coupon submits a parsed draft. */
export const CreateValidatesAndSubmits: Story = {
  args: { mode: 'create', defaultValue: emptyCoupon(), onSubmit: fn() },
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByRole('button', { name: /create coupon/i }))
    await expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    await expect(await screen.findByText('Enter a percentage between 0 and 100')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(screen.getByRole('textbox', { name: /^name/i }), 'Launch 20% off')
    await userEvent.type(screen.getByRole('textbox', { name: /percentage off/i }), '20')
    await userEvent.click(screen.getByRole('button', { name: /create coupon/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Launch 20% off', type: 'percentage', percentageOff: '20', cadence: 'once' }),
    )
  },
}

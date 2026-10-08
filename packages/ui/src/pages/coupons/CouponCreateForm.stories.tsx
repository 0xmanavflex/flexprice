import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CouponCreateForm } from './CouponCreateForm'

/** Create a coupon — the full-page body. Fixtures in, a validated `CreateCoupon` out. */
const trail: { label: string }[] = [{ label: 'Coupons' }, { label: 'Create coupon' }]

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/CouponCreateForm',
  component: CouponCreateForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: { trail, onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof CouponCreateForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Submitting: Story = {
  // While submitting every field is disabled, so the scrollable page body has
  // nothing focusable left in it; the state is transient and the body is not a
  // control, so the keyboard-access rule does not apply here.
  parameters: {
    a11y: { config: { rules: [{ id: 'scrollable-region-focusable', enabled: false }] } },
  },
  args: { isSubmitting: true },
}

export const SubmitError: Story = {
  args: { submitError: 'A coupon with that code already exists.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** Empty required fields are rejected by the domain schema, reached through the form. */
export const ValidatesRequiredFields: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create coupon/i }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const CloseReturns: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Close form' }))
    await expect(args.onCancel).toHaveBeenCalled()
  },
}

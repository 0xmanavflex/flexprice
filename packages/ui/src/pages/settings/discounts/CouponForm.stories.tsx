import type { ComponentProps } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CouponForm } from './CouponForm'

/**
 * Edit a coupon: a rename. The discount, cadence and redemption window are
 * fixed once created, so only the name is a control; the rest is shown as
 * read-only context. Fixtures in, a validated `EditCoupon` out: no network.
 */
const trail: { label: string }[] = [{ label: 'Coupons' }, { label: 'Edit Launch 20% off' }]

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'App/Settings/Discounts/Discount form',
  component: CouponForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    trail,
    defaultValue: { name: 'Launch 20% off' },
    onSubmit: fn(),
    onCancel: fn(),
  },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    defaultValue: { control: false },
    summary: { control: false },
    trail: { control: false },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof CouponForm>

export default meta
type Story = StoryObj<typeof meta>

/** Edit the coupon name; toggle the read-only summary, submitting and a server error. */
export const Playground: StoryObj<
  ComponentProps<typeof CouponForm> & { name: string; showSummary: boolean }
> = {
  args: { name: 'Launch 20% off', showSummary: true, submitError: '' },
  render: ({ name, showSummary, submitError, ...args }) => (
    <CouponForm
      key={name}
      {...args}
      defaultValue={{ name }}
      submitError={submitError || null}
      {...(showSummary ? { summary: { code: 'LAUNCH20', discount: '20% off' } } : {})}
    />
  ),
}

export const Default: Story = {}

/** The read-only summary tells the person which coupon they are renaming. */
export const WithSummary: Story = {
  args: { summary: { code: 'LAUNCH20', discount: '20% off' } },
}

export const Submitting: Story = { args: { isSubmitting: true } }

export const SubmitError: Story = {
  args: { submitError: 'Could not rename the coupon. Try again.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** An empty name is rejected by the domain schema, reached through the form. */
export const ValidatesName: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.clear(canvas.getByRole('textbox', { name: 'Name' }))
    await userEvent.click(canvas.getByRole('button', { name: /save changes/i }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A valid rename submits a parsed domain value. */
export const SubmitsAValidatedName: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /save changes/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Launch 20% off' }),
    )
  },
}

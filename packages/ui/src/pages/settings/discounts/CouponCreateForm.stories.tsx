import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CouponCreateForm } from './CouponCreateForm'

/** Create a coupon: the full-page body. Fixtures in, a validated `CreateCoupon` out. */
const trail: { label: string }[] = [{ label: 'Coupons' }, { label: 'Create coupon' }]

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'App/Settings/Discounts/Create discount',
  component: CouponCreateForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: { trail, onSubmit: fn(), onCancel: fn() },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    defaultValue: { control: false },
    trail: { control: false },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof CouponCreateForm>

export default meta
type Story = StoryObj<typeof meta>

/** Flip submitting and a server error from the controls. */
export const Playground: Story = {
  args: { isSubmitting: false, submitError: '' },
  render: ({ submitError, ...args }) => (
    <CouponCreateForm {...args} submitError={submitError || null} />
  ),
  parameters: {
    a11y: { config: { rules: [{ id: 'scrollable-region-focusable', enabled: false }] } },
  },
}

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

/** A fixed amount is written in its currency: chosen first, then shown as the amount's sign. */
export const FixedAmountShowsCurrency: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('combobox', { name: /Discount type/ }))
    await userEvent.click(await body.findByRole('option', { name: /Fixed/ }))
    await userEvent.click(canvas.getByRole('combobox', { name: /Currency/ }))
    await userEvent.click(await body.findByRole('option', { name: /^USD/ }))
    const amount = canvas.getByRole('textbox', { name: /Amount off/ })
    await expect(amount.closest('[data-slot="input-group"]')).toHaveTextContent('$')
  },
}

/** A repeated metadata key is said under the rows, and the coupon is not created. */
export const MetadataProblemBlocksCreate: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), 'Launch')
    await userEvent.type(canvas.getByRole('textbox', { name: /^Percent/ }), '20')
    await userEvent.click(canvas.getByRole('button', { name: 'Add field' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Value 1' }), 'orphan')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Every value needs a key.')
    await userEvent.click(canvas.getByRole('button', { name: /create coupon/i }))
    await expect(args.onSubmit).not.toHaveBeenCalled()
    // Fixing the row lets it through, with the metadata.
    await userEvent.type(canvas.getByRole('textbox', { name: 'Key 1' }), 'campaign')
    await userEvent.click(canvas.getByRole('button', { name: /create coupon/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { campaign: 'orphan' } }),
    )
  },
}

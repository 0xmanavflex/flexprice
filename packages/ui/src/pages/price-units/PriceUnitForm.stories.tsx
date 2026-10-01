import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { CreatePriceUnit } from '@fp/domain'
import { PriceUnitForm } from './PriceUnitForm'

/**
 * Create a price unit, on a full page. Fixtures in, a validated
 * `CreatePriceUnit` out. Create only: the backend fixes everything but the name
 * once a unit exists, and the name is edited in place on the detail page.
 * No provider, no network.
 */
const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/PriceUnitForm',
  component: PriceUnitForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    trail: [{ label: 'Price Units' }, { label: 'Create price unit' }],
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof PriceUnitForm>

export default meta
type Story = StoryObj<typeof meta>

const credits: CreatePriceUnit = {
  name: 'Credits',
  code: 'CRD',
  symbol: '⛁',
  baseCurrency: 'USD',
  conversionRate: 0.01,
}

export const Create: Story = {}

export const Prefilled: Story = {
  args: { defaultValue: credits },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: /^Name/ })).toHaveValue('Credits')
    await userEvent.click(canvas.getByRole('button', { name: 'Create price unit' }))
    await expect(args.onSubmit).toHaveBeenCalled()
  },
}

export const Submitting: Story = {
  args: { isSubmitting: true, defaultValue: credits },
}

export const SubmitError: Story = {
  args: {
    submitError: 'A price unit with that code already exists.',
    defaultValue: credits,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** Validation is the domain schema's, reached through the form. */
export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create price unit/i }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** The rail follows the draft: unit, code and the conversion line. */
export const PreviewFollowsDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rail = within(canvas.getByRole('complementary', { name: /price unit preview/i }))
    await expect(rail.getByText('Untitled price unit')).toBeInTheDocument()
    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), 'Credits')
    await userEvent.type(canvas.getByRole('textbox', { name: /^Code/ }), 'crd')
    await expect(rail.getByText('Credits')).toBeInTheDocument()
    await expect(rail.getByText('CRD')).toBeInTheDocument()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { CreatePriceUnit } from '@fp/domain'
import { PriceUnitForm } from './PriceUnitForm'

/**
 * Create or edit a price unit's details — the drawer's contents. Fixtures in, a
 * validated `CreatePriceUnit` out. The backend fixes everything but the name
 * once a unit exists, so edit locks the other four. No provider, no network.
 */
const meta = {
  title: 'Surfaces/PriceUnitForm',
  component: PriceUnitForm,
  parameters: { layout: 'padded' },
  args: { mode: 'create', onSubmit: fn(), onCancel: fn() },
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

/** Everything but the name is locked on edit — the values stay visible to check. */
export const Edit: Story = {
  args: { mode: 'edit', defaultValue: credits },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: 'Code' })).toHaveAttribute('readonly')
    await expect(canvas.getByRole('textbox', { name: 'Name' })).not.toHaveAttribute('readonly')
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

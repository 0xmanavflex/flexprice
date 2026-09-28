import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import type { CreatePriceUnit } from '@fp/domain'
import { PriceUnitEditorSheet } from './PriceUnitEditorSheet'

/**
 * The price-unit editor, as a right-hand drawer carrying `PriceUnitForm`. The
 * page owns when it is open, which mode it is in, and what a submit does; a
 * validated `CreatePriceUnit` comes out. Open by default. No provider, no network.
 */
const meta = {
  title: 'Surfaces/PriceUnitEditorSheet',
  component: PriceUnitEditorSheet,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: fn(), mode: 'create', onSubmit: fn() },
} satisfies Meta<typeof PriceUnitEditorSheet>

export default meta
type Story = StoryObj<typeof meta>

const credits: CreatePriceUnit = {
  name: 'Credits',
  code: 'CRD',
  symbol: '⛁',
  baseCurrency: 'USD',
  conversionRate: 0.01,
}

export const Create: Story = {
  play: async ({ canvasElement }) => {
    // The drawer renders in a portal, so query the whole document body.
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'New price unit' })).toBeInTheDocument()
  },
}

/** On edit only the name is editable; code, symbol, currency and rate are shown locked. */
export const Edit: Story = {
  args: { mode: 'edit', defaultValue: credits },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(
      await screen.findByRole('heading', { name: 'Edit price unit' }),
    ).toBeInTheDocument()
    await expect(screen.getByRole('textbox', { name: 'Code' })).toHaveAttribute('readonly')
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
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('alert')).toBeInTheDocument()
  },
}

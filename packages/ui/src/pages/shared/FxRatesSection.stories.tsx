import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import type { FxRate } from '@fp/domain'
import { FxRatesSection } from './FxRatesSection'

const global: FxRate[] = [
  {
    id: 'fx_1',
    scope: 'tenant',
    scopeId: '',
    fromCurrency: 'usd',
    toCurrency: 'inr',
    rate: '83.25',
    startDate: null,
    endDate: null,
    updatedAt: new Date('2026-10-01T09:00:00Z'),
  },
  {
    id: 'fx_2',
    scope: 'tenant',
    scopeId: '',
    fromCurrency: 'eur',
    toCurrency: 'usd',
    rate: '1.08',
    startDate: null,
    endDate: null,
    updatedAt: new Date('2026-09-12T09:00:00Z'),
  },
]

const overrides: FxRate[] = [
  {
    id: 'fx_o1',
    scope: 'customer',
    scopeId: 'cus_1',
    fromCurrency: 'usd',
    toCurrency: 'inr',
    rate: '82',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-07-01T00:00:00.000Z',
    updatedAt: null,
  },
  {
    id: 'fx_o2',
    scope: 'customer',
    scopeId: 'cus_1',
    fromCurrency: 'usd',
    toCurrency: 'inr',
    rate: '83.5',
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: null,
    updatedAt: null,
  },
]

/**
 * Forex rates as V1 has them: the global rate per pair in Settings › Currency,
 * and a customer's or contract's windowed overrides of it.
 */
const meta = {
  title: 'App/Shared/FX rates section',
  component: FxRatesSection,
  parameters: { layout: 'padded' },
  args: {
    kind: 'global',
    rates: global,
    isLoading: false,
    failed: false,
    onRetry: fn(),
    onCreate: fn(async () => undefined),
    onUpdate: fn(async () => undefined),
    onRemove: fn(async () => undefined),
    error: null,
    onResetError: fn(),
  },
} satisfies Meta<typeof FxRatesSection>

export default meta
type Story = StoryObj<typeof meta>

/** The global rates: one per pair, edited in place, never deleted. */
export const GlobalRates: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('1 USD = 83.25 INR')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for USD → INR' }))
    await expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
    await expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  },
}

/** Adding a global rate takes a pair and a rate, and previews it. */
export const AddGlobalRate: Story = {
  args: { rates: [] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Add rate/ }))
    const dialog = within(await screen.findByRole('dialog'))
    await expect(dialog.queryByText('Valid from')).toBeNull()
    await userEvent.click(dialog.getByRole('combobox', { name: 'From currency' }))
    await userEvent.click(await screen.findByRole('option', { name: 'USD' }))
    await userEvent.click(dialog.getByRole('combobox', { name: 'To currency' }))
    await userEvent.click(await screen.findByRole('option', { name: 'INR' }))
    await userEvent.type(dialog.getByRole('textbox', { name: /^Rate/ }), '83')
    await expect(dialog.getByText('1 USD = 83.00 INR')).toBeInTheDocument()
    await userEvent.click(dialog.getByRole('button', { name: 'Add rate' }))
    await expect(args.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ fromCurrency: 'usd', toCurrency: 'inr', rate: '83' }),
    )
  },
}

/** A rate must be above zero; the pair must be two currencies. */
export const RefusesABadRate: Story = {
  args: { rates: [] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Add rate/ }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByRole('textbox', { name: /^Rate/ }), '0')
    await userEvent.click(dialog.getByRole('button', { name: 'Add rate' }))
    await expect(dialog.getByText('Select both currencies.')).toBeInTheDocument()
    await expect(dialog.getByText('Rate must be a number greater than 0.')).toBeInTheDocument()
    await expect(args.onCreate).not.toHaveBeenCalled()
  },
}

/** A customer's overrides, each with its window and where now falls in it. */
export const CustomerOverrides: Story = {
  args: { kind: 'override', rates: overrides },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('FX overrides')).toBeInTheDocument()
    await expect(canvas.getByText('Expired')).toBeInTheDocument()
    await expect(canvas.getByText('No end')).toBeInTheDocument()
  },
}

/** An override whose window meets another for the same pair is refused before it is sent. */
export const RefusesAnOverlap: Story = {
  args: { kind: 'override', rates: overrides, lockedFrom: 'usd' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Add override/ }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('combobox', { name: 'To currency' }))
    await userEvent.click(await screen.findByRole('option', { name: 'INR' }))
    await userEvent.type(dialog.getByRole('textbox', { name: /^Rate/ }), '84')
    await userEvent.click(dialog.getByRole('button', { name: 'Add override' }))
    await expect(dialog.getByText('Overlaps another override for this pair.')).toBeInTheDocument()
    await expect(args.onCreate).not.toHaveBeenCalled()
  },
}

/** Deleting an override asks first. */
export const DeleteOverride: Story = {
  args: { kind: 'override', rates: overrides },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getAllByRole('button', { name: 'Actions for USD → INR' })[0]!)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete override' }))
    await expect(args.onRemove).toHaveBeenCalledWith('fx_o1')
  },
}

export const Empty: Story = { args: { kind: 'override', rates: [] } }
export const Loading: Story = { args: { isLoading: true } }
export const Failed: Story = { args: { failed: true } }
export const ReadOnly: Story = { args: { kind: 'override', rates: overrides, readOnly: true } }

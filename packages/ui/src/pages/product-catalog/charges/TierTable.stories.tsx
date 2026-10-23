import { useState } from 'react'
import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { type Tier } from '@fp/domain'
import { TierTable } from './TierTable'

/**
 * The tier bands editor. Controlled: the story owns the array, the table draws
 * it. The invariants: derived `From`, an always-unbounded last band: are shown
 * by construction rather than validated after the fact.
 */
const meta = {
  title: 'App/Product catalog/Charges/Tier table',
  component: TierTable,
  parameters: { layout: 'padded' },
  // Default args so each story can override with `render`; the controlled
  // wrapper supplies the real state.
  args: { tiers: [], onChange: () => {} },
  argTypes: {
    tiers: { control: false },
    onChange: { control: false },
    currencySymbol: { control: 'select', options: ['$', '€', '£', '₹'] },
    disabled: { control: 'boolean' },
    rowErrors: { control: false },
  },
} satisfies Meta<typeof TierTable>

export default meta
type Story = StoryObj<typeof meta>

function ControlledTierTable({ initial }: { initial: Tier[] }) {
  const [tiers, setTiers] = useState<Tier[]>(initial)
  return <TierTable tiers={tiers} onChange={setTiers} currencySymbol="$" />
}

function makeTiers(bands: number): Tier[] {
  return Array.from({ length: bands }, (_, index) =>
    index === bands - 1
      ? { upTo: null, unitAmount: '0.01' }
      : { upTo: (index + 1) * 1000, unitAmount: (0.1 - index * 0.01).toFixed(2) },
  )
}

function PlaygroundTable({
  bands,
  hasRowError,
  currencySymbol,
  disabled,
}: {
  bands: number
  hasRowError: boolean
  currencySymbol?: string | undefined
  disabled?: boolean | undefined
}) {
  const [tiers, setTiers] = useState<Tier[]>(() => makeTiers(bands))
  return (
    <TierTable
      tiers={tiers}
      onChange={setTiers}
      {...(currencySymbol ? { currencySymbol } : {})}
      {...(disabled ? { disabled } : {})}
      {...(hasRowError ? { rowErrors: { 0: { upTo: 'Must be greater than 0' } } } : {})}
    />
  )
}

/** Pick the number of bands, the currency symbol, disabled and a row error. */
export const Playground: StoryObj<
  ComponentProps<typeof TierTable> & { bands: number; hasRowError: boolean }
> = {
  args: { bands: 3, hasRowError: false, currencySymbol: '$', disabled: false },
  argTypes: { bands: { control: { type: 'range', min: 1, max: 8, step: 1 } } },
  render: ({ bands, hasRowError, currencySymbol, disabled }) => (
    <PlaygroundTable
      key={bands}
      bands={bands}
      hasRowError={hasRowError}
      currencySymbol={currencySymbol}
      disabled={disabled}
    />
  ),
}

export const ThreeBands: Story = {
  render: () => (
    <ControlledTierTable
      initial={[
        { upTo: 1000, unitAmount: '0.10', flatAmount: '0' },
        { upTo: 10_000, unitAmount: '0.08' },
        { upTo: null, unitAmount: '0.05' },
      ]}
    />
  ),
}

/** Adding a band keeps the final one unbounded. */
export const AddingABandKeepsTheLastUnbounded: Story = {
  render: () => <ControlledTierTable initial={[{ upTo: null, unitAmount: '0.10' }]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /add tier/i }))
    // Two rows now, and the last still shows the ∞ placeholder.
    const lastUpTo = canvas.getByRole('textbox', { name: /tier 2 up to/i })
    await expect(lastUpTo).toHaveAttribute('placeholder', '∞')
  },
}

export const WithRowErrors: Story = {
  render: () => (
    <TierTable
      tiers={[
        { upTo: 100, unitAmount: '0.10' },
        { upTo: 50, unitAmount: '0.08' },
        { upTo: null, unitAmount: '0.05' },
      ]}
      onChange={() => {}}
      rowErrors={{ 1: { upTo: 'Must be greater than 100' } }}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Must be greater than 100')).toBeInTheDocument()
  },
}

function SpiedTierTable({
  initial,
  onChange,
}: {
  initial: Tier[]
  onChange: (tiers: Tier[]) => void
}) {
  const [tiers, setTiers] = useState<Tier[]>(initial)
  return (
    <TierTable
      tiers={tiers}
      onChange={(next) => {
        setTiers(next)
        onChange(next)
      }}
    />
  )
}

/** A package size prices the band per package; clearing it goes back to per unit. */
export const PackageSize: Story = {
  args: { onChange: fn() },
  render: (args) => (
    <SpiedTierTable
      initial={[
        { upTo: 1000, unitAmount: '0' },
        { upTo: null, unitAmount: '1000' },
      ]}
      onChange={args.onChange}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const size = canvas.getByRole('textbox', { name: /tier 2 package size/i })
    await userEvent.type(size, '100')
    await expect(args.onChange).toHaveBeenLastCalledWith([
      { upTo: 1000, unitAmount: '0' },
      { upTo: null, unitAmount: '1000', transformQuantity: { divideBy: 100, round: 'up' } },
    ])
    await userEvent.clear(size)
    await expect(args.onChange).toHaveBeenLastCalledWith([
      { upTo: 1000, unitAmount: '0' },
      { upTo: null, unitAmount: '1000' },
    ])
    const hint = canvas.getByRole('button', { name: /more information/i })
    await userEvent.hover(hint)
    const copy = await within(document.body).findByText(
      'Units per package. Leave empty to charge per unit.',
    )
    await expect(copy).toBeInTheDocument()
    await userEvent.unhover(hint)
    await waitFor(() => expect(copy).not.toBeInTheDocument())
  },
}

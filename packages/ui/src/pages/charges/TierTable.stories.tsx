import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { type Tier } from '@fp/domain'
import { TierTable } from './TierTable'

/**
 * The tier bands editor. Controlled: the story owns the array, the table draws
 * it. The invariants — derived `From`, an always-unbounded last band — are shown
 * by construction rather than validated after the fact.
 */
const meta = {
  title: 'Surfaces/TierTable',
  component: TierTable,
  parameters: { layout: 'padded' },
  // Default args so each story can override with `render`; the controlled
  // wrapper supplies the real state.
  args: { tiers: [], onChange: () => {} },
} satisfies Meta<typeof TierTable>

export default meta
type Story = StoryObj<typeof meta>

function ControlledTierTable({ initial }: { initial: Tier[] }) {
  const [tiers, setTiers] = useState<Tier[]>(initial)
  return <TierTable tiers={tiers} onChange={setTiers} currencySymbol="$" />
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

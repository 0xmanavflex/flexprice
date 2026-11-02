import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { type BonusSlab, emptyBonusSlab } from '@fp/domain'
import { BonusSlabTable, type BonusSlabTableProps } from './BonusSlabTable'

const SLABS: BonusSlab[] = [
  { ...emptyBonusSlab(), threshold: '200', bonusValue: '10', expiryDuration: '3' },
  { ...emptyBonusSlab(), threshold: '100', bonusType: 'flat', bonusValue: '50' },
]

function Controlled(props: Partial<BonusSlabTableProps>) {
  const [slabs, setSlabs] = useState<BonusSlab[]>(props.slabs ?? SLABS)
  return (
    <BonusSlabTable
      {...props}
      slabs={slabs}
      onChange={(next) => {
        setSlabs(next)
        props.onChange?.(next)
      }}
    />
  )
}

const meta = {
  title: 'App/Settings/Wallets/Bonus slab table',
  component: BonusSlabTable,
  args: { slabs: SLABS, onChange: fn() },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof BonusSlabTable>

export default meta
type Story = StoryObj<typeof meta>

/** The API's example: 10% from 200 credits for three months, 50 credits from 100. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: 'Slab 1 top-up of at least' })).toHaveValue(
      '200',
    )
    await expect(canvas.getByRole('combobox', { name: 'Slab 2 bonus type' })).toHaveTextContent(
      'Credits',
    )
  },
}

/** Remove a slab. */
export const Removes: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Remove slab 1' }))
    await expect(canvas.getAllByRole('button', { name: /Remove slab/ })).toHaveLength(1)
    await expect(args.onChange).toHaveBeenCalled()
  },
}

/** Messages show against the row that caused them. */
export const WithErrors: Story = {
  args: { rowErrors: { 1: { threshold: 'Two slabs start at the same top-up' } } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('same top-up')
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { SortMenu } from './SortMenu'

const options = [
  { value: 'issuedAt', label: 'Issued' },
  { value: 'dueDate', label: 'Due' },
  { value: 'total', label: 'Total' },
  { value: 'status', label: 'Status' },
]

const meta = {
  title: 'Foundation/Compositions/SortMenu',
  component: SortMenu,
  parameters: {
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: { options, field: 'issuedAt', direction: 'desc', onChange: fn() },
} satisfies Meta<typeof SortMenu<string>>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * The current sort is in the trigger's name.
 *
 * Someone using a screen reader should not have to open a menu to learn how
 * the list they are already reading is ordered.
 */
export const TriggerNamesTheCurrentSort: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: /sort by issued, descending/i }),
    ).toBeInTheDocument()
  },
}

/** Field and direction are independent, so they are two groups, not eight options. */
export const TwoIndependentGroups: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /change sorting/i }))

    const items = await screen.findAllByRole('menuitemradio')
    await expect(items.map((i) => i.textContent)).toEqual([
      'Issued', 'Due', 'Total', 'Status', 'Ascending', 'Descending',
    ])
    await expect(screen.getByRole('menuitemradio', { name: 'Issued' })).toBeChecked()
    await expect(screen.getByRole('menuitemradio', { name: 'Descending' })).toBeChecked()
  },
}

/** Changing the field keeps the direction, and the other way round. */
export const ChangingOneKeepsTheOther: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /change sorting/i }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Total' }))
    await expect(args.onChange).toHaveBeenCalledWith('total', 'desc')
  },
}

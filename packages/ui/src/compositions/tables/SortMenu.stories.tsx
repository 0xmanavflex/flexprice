import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { SortMenu, type SortMenuProps } from './SortMenu'

const options = [
  { value: 'issuedAt', label: 'Issued' },
  { value: 'dueDate', label: 'Due' },
  { value: 'total', label: 'Total' },
  { value: 'status', label: 'Status' },
]

function Controlled(args: SortMenuProps<string>) {
  const [field, setField] = useState(args.field)
  const [direction, setDirection] = useState(args.direction)
  // Follow the controls; picking in the menu still moves the selection in between.
  useEffect(() => setField(args.field), [args.field])
  useEffect(() => setDirection(args.direction), [args.direction])
  return (
    <SortMenu
      {...args}
      field={field}
      direction={direction}
      onChange={(nextField, nextDirection) => {
        setField(nextField)
        setDirection(nextDirection)
        args.onChange(nextField, nextDirection)
      }}
    />
  )
}

const meta = {
  title: 'Building blocks/Tables & lists/SortMenu',
  component: SortMenu,
  parameters: {
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: { options, field: 'issuedAt', direction: 'desc', onChange: fn() },
  argTypes: {
    options: { control: 'object', description: 'Sortable fields: value and label.' },
    field: { control: 'select', options: options.map((o) => o.value) },
    direction: { control: 'inline-radio', options: ['asc', 'desc'] },
    align: {
      control: 'inline-radio',
      options: ['start', 'end'],
      description: 'Menu alignment to the trigger.',
    },
    onChange: { control: false },
    trigger: { control: false },
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof SortMenu<string>>

export default meta
type Story = StoryObj<typeof meta>

/** Pick the field and direction; the menu is live and the trigger name follows the sort. */
export const Playground: Story = {
  args: { field: 'dueDate', direction: 'asc', align: 'start' },
}

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
      'Issued',
      'Due',
      'Total',
      'Status',
      'Ascending',
      'Descending',
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

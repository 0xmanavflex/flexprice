import { useEffect, useState, type ComponentProps } from 'react'
import { expect, within } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckboxRow } from './CheckboxRow'

function Controlled(args: ComponentProps<typeof CheckboxRow>) {
  const [checked, setChecked] = useState(args.checked)
  // Follow the `checked` control; clicking the box still works in between.
  useEffect(() => setChecked(args.checked), [args.checked])
  return <CheckboxRow {...args} checked={checked} onCheckedChange={setChecked} />
}

const meta = {
  title: 'Building blocks/Forms/CheckboxRow',
  component: CheckboxRow,
  parameters: { layout: 'padded' },
  args: { checked: true, onCheckedChange: () => undefined, children: 'Show the date range' },
  argTypes: {
    checked: { control: 'boolean', description: 'Initial and controlled checked state.' },
    disabled: { control: 'boolean' },
    children: { control: 'text', description: 'The label sentence.' },
    onCheckedChange: { control: false },
    className: { control: false },
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof CheckboxRow>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop as a control; the box is live, so clicking it works too. */
export const Playground: Story = {
  args: { checked: false, disabled: false, children: 'Show the date range' },
}

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }

/** A choice that needs a sentence: the description sits under the label and describes the box. */
export const WithDescription: Story = {
  args: {
    checked: false,
    children: 'Billing admin',
    description: 'Manage invoices, payments and contracts.',
  },
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('checkbox', { name: 'Billing admin' })
    await expect(box).toHaveAccessibleDescription('Manage invoices, payments and contracts.')
  },
}

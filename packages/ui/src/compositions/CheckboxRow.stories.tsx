import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckboxRow } from './CheckboxRow'

function Controlled(args: ComponentProps<typeof CheckboxRow>) {
  const [checked, setChecked] = useState(args.checked)
  return <CheckboxRow {...args} checked={checked} onCheckedChange={setChecked} />
}

const meta = {
  title: 'Foundation/Compositions/CheckboxRow',
  component: CheckboxRow,
  parameters: { layout: 'padded' },
  args: { checked: true, onCheckedChange: () => undefined, children: 'Show the date range' },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof CheckboxRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }

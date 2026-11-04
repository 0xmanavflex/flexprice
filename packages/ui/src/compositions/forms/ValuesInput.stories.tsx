import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ValuesInput, type ValuesInputProps } from './ValuesInput'

function Controlled(props: Partial<ValuesInputProps>) {
  const [value, setValue] = useState<string[]>(props.value ? [...props.value] : [])
  return (
    <ValuesInput
      aria-label="Filter values"
      placeholder="Type a value, then Enter"
      {...props}
      value={value}
      onChange={setValue}
    />
  )
}

const meta = {
  title: 'Building blocks/Forms/ValuesInput',
  component: ValuesInput,
  parameters: { layout: 'padded' },
  args: { value: ['us-east', 'eu-west'], onChange: () => undefined },
  argTypes: {
    value: { control: false },
    onChange: { control: false },
    onBlur: { control: false },
    className: { control: false },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ValuesInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = { args: { value: [] } }

export const Invalid: Story = { args: { value: [], 'aria-invalid': true } }

/** Enter and a comma add a chip; Backspace in the empty field removes the last. */
export const AddsAndRemoves: Story = {
  args: { value: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Filter values' })
    await userEvent.type(input, 'rest{Enter}resr,')
    await expect(canvas.getByText('rest')).toBeInTheDocument()
    await expect(canvas.getByText('resr')).toBeInTheDocument()
    await expect(input).toHaveValue('')
    await userEvent.click(canvas.getByRole('button', { name: 'Remove rest' }))
    await expect(canvas.queryByText('rest')).toBeNull()
    await userEvent.type(input, '{Backspace}')
    await expect(canvas.queryByText('resr')).toBeNull()
  },
}

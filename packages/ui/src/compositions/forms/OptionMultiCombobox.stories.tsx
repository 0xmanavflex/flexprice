import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, userEvent, within } from 'storybook/test'
import { Field } from './Field'
import { OptionMultiCombobox } from './OptionMultiCombobox'
const meta = {
  title: 'Building blocks/Forms/OptionMultiCombobox',
  component: OptionMultiCombobox,
} satisfies Meta<typeof OptionMultiCombobox>
export default meta
type Story = StoryObj<typeof meta>
export const Multiple: Story = {
  args: {
    value: [],
    onValueChange: () => undefined,
    options: [
      { value: 'a', label: 'Acme US' },
      { value: 'b', label: 'Acme EU' },
    ],
  },
  render: function Example(args) {
    const [value, setValue] = useState<string[]>([])
    return (
      <Field label="Customers">
        {({ id }) => (
          <OptionMultiCombobox {...args} id={id} value={value} onValueChange={setValue} />
        )}
      </Field>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: 'Customers' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Acme US' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Acme EU' }))
    await userEvent.keyboard('{Escape}')
    await expect(canvas.getByText('Acme US')).toBeVisible()
    await expect(canvas.getByText('Acme EU')).toBeVisible()
  },
}

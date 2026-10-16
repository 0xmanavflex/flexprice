import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { TimezoneCombobox, type TimezoneComboboxProps } from './TimezoneCombobox'

function Controlled({
  value: initial,
  onValueChange,
  ...props
}: TimezoneComboboxProps) {
  const [value, setValue] = useState(initial)
  useEffect(() => setValue(initial), [initial])
  return (
    <div className="flex w-80 flex-col gap-1.5">
      <label htmlFor="timezone" className="text-sm font-medium">
        Timezone
      </label>
      <TimezoneCombobox
        {...props}
        id="timezone"
        value={value}
        onValueChange={(next) => {
          setValue(next)
          onValueChange(next)
        }}
      />
    </div>
  )
}

const meta = {
  title: 'Building blocks/Forms/TimezoneCombobox',
  component: TimezoneCombobox,
  parameters: {
    layout: 'centered',
    a11y: {
      config: {
        rules: [
          { id: 'aria-input-field-name', enabled: false },
          { id: 'scrollable-region-focusable', enabled: false },
        ],
      },
    },
  },
  args: {
    value: '',
    onValueChange: fn(),
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof TimezoneCombobox>

export default meta

type Story = StoryObj<typeof meta>

/** Typing an abbreviation finds the zone and stores the IANA name. */
export const FindsByAbbreviation: Story = {
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('combobox', { name: 'Timezone' })
    await userEvent.click(input)
    await userEvent.type(input, 'IST')
    const option = await screen.findByRole('option', { name: /Asia\/Kolkata/ })
    await userEvent.click(option)
    await expect(args.onValueChange).toHaveBeenCalledWith('Asia/Kolkata')
    await waitFor(() => expect(input).toHaveValue(expect.stringContaining('Asia/Kolkata')))
  },
}

/** A saved zone outside the catalogue still shows, so an edit does not drop it. */
export const KeepsUnknownValue: Story = {
  args: { value: 'Mars/Olympus_Mons' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('combobox', { name: 'Timezone' })).toHaveValue(
      expect.stringContaining('Mars/Olympus_Mons'),
    )
  },
}

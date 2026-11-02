import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { TimezoneCombobox, type TimezoneComboboxProps } from './TimezoneCombobox'

function Controlled({ value: initial, onValueChange, ...props }: TimezoneComboboxProps) {
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
    await waitFor(() => expect((input as HTMLInputElement).value).toContain('Asia/Kolkata'))
  },
}

/** A saved zone outside the catalogue still shows, so an edit does not drop it. */
export const KeepsUnknownValue: Story = {
  args: { value: 'Mars/Olympus_Mons' },
  play: async ({ canvasElement }) => {
    const combobox = within(canvasElement).getByRole('combobox', {
      name: 'Timezone',
    }) as HTMLInputElement
    await expect(combobox.value).toContain('Mars/Olympus_Mons')
  },
}

/** With `offerLocal`, the browser's own zone leads as "Local" and stores its IANA name. */
export const OffersLocal: Story = {
  args: { offerLocal: true },
  play: async ({ canvasElement, args }) => {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone
    const input = within(canvasElement).getByRole('combobox', { name: 'Timezone' })
    await userEvent.click(input)
    const options = await screen.findAllByRole('option')
    await expect(options[0]).toHaveTextContent(/^Local · /)
    // Listed once, as Local, not again further down: no other label starts with the zone.
    const named = (text: string | null) =>
      (text ?? '').replace(/^Local · /, '').split(' ')[0] === local
    await expect(options.filter((option) => named(option.textContent))).toHaveLength(1)
    await userEvent.click(options[0]!)
    await expect(args.onValueChange).toHaveBeenCalledWith(local)
  },
}

import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ThemeProvider } from '@ui/compositions/shell'
import { ThemeChoiceCards, ThemePreferenceCards, type ThemeChoice } from './AppearanceSettings'

const meta = {
  title: 'Pages/Settings/Appearance',
  component: ThemeChoiceCards,
  tags: ['!autodocs'],
  args: { value: 'system', onValueChange: fn(), label: 'Interface theme', disabled: false },
  argTypes: {
    value: { control: 'inline-radio', options: ['system', 'light', 'dark'] },
    label: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  render: function Render({ value: initial, ...rest }) {
    const [value, setValue] = useState<ThemeChoice>(initial)
    return (
      <div className="max-w-3xl p-6">
        <ThemeChoiceCards
          {...rest}
          value={value}
          onValueChange={(next) => {
            setValue(next)
            rest.onValueChange(next)
          }}
        />
      </div>
    )
  },
} satisfies Meta<typeof ThemeChoiceCards>

export default meta
type Story = StoryObj<typeof meta>

/** The three cards with every control live: pick the value, rename the group, disable it. */
export const Playground: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: /Dark/ }))
    await expect(args.onValueChange).toHaveBeenCalledWith('dark')
    await expect(canvas.getByRole('radio', { name: /Dark/ })).toBeChecked()
  },
}

/** Wired to the app's theme provider, as Settings > Appearance renders it. */
export const Connected: Story = {
  render: () => (
    <ThemeProvider>
      <div className="max-w-3xl p-6">
        <ThemePreferenceCards />
      </div>
    </ThemeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: /Dark/ }))
    await expect(document.documentElement).toHaveClass('dark')
    await userEvent.click(canvas.getByRole('radio', { name: /Light/ }))
    await expect(document.documentElement).not.toHaveClass('dark')
  },
}

/** Locked, for a profile that cannot change the theme. */
export const Disabled: Story = {
  args: { value: 'light', disabled: true },
}

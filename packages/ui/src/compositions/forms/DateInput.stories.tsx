import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { DateInput, type DateInputProps } from './DateInput'
import { Field } from './Field'

type PlaygroundArgs = DateInputProps & {
  label: string
  hasError: boolean
}

function DateInputDemo({ label, hasError, value, onValueChange, ...rest }: PlaygroundArgs) {
  const [current, setCurrent] = useState(value)
  useEffect(() => setCurrent(value), [value])
  return (
    <div className="max-w-xs">
      <Field label={label} error={hasError ? 'Pick a start date.' : undefined}>
        {(p) => (
          <DateInput
            {...rest}
            {...p}
            value={current}
            onValueChange={(next) => {
              setCurrent(next)
              onValueChange(next)
            }}
          />
        )}
      </Field>
    </div>
  )
}

const meta = {
  title: 'Building blocks/Forms/DateInput',
  component: DateInput,
  parameters: {
    layout: 'padded',
    // Base UI renders `aria-hidden` focus guards around portalled popovers; axe
    // flags them and the library is vendored. See ConfirmDialog.stories.tsx.
    // The calendar popover (vendored) is a dialog without an accessible name: `aria-dialog-name`.
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'aria-dialog-name', enabled: false },
        ],
      },
    },
  },
  argTypes: {
    value: { control: 'text', description: 'ISO date, YYYY-MM-DD, or empty' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
    hasError: { control: 'boolean' },
    id: { control: false },
    onValueChange: { control: false },
    'aria-describedby': { control: false },
    'aria-invalid': { control: false },
  },
  args: {
    value: '',
    placeholder: 'Pick a date',
    disabled: false,
    label: 'Start date',
    hasError: false,
    onValueChange: fn(),
  },
  render: (args) => <DateInputDemo {...args} />,
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

/** Type an ISO date into `value`, toggle disabled and the error, or pick a day from the calendar. */
export const Playground: Story = {}

/** Nothing chosen: the placeholder reads as a hint, not a value. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    // The field's label names the control; the placeholder is its visible text.
    const button = within(canvasElement).getByRole('button', { name: 'Start date' })
    await expect(button).toHaveTextContent('Pick a date')
  },
}

/** A value from the form shows as a medium-format date. */
export const WithValue: Story = {
  args: { value: '2026-03-15' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Start date' })
    await expect(button).toHaveTextContent(/15.*2026|2026.*15/)
  },
}

/** Locked: the calendar cannot be opened. */
export const Disabled: Story = {
  args: { value: '2026-03-15', disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Start date' })).toBeDisabled()
  },
}

/** The field's error is announced and the control is marked invalid. */
export const Invalid: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Pick a start date.')
    await expect(canvas.getByRole('button', { name: 'Start date' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  },
}

/** Opening the calendar and choosing a day reports an ISO string and shows it on the button. */
export const PicksADate: Story = {
  args: { value: '2026-03-15' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Start date' }))
    const day = await screen.findByRole('button', { name: /March 20/ })
    await userEvent.click(day)
    await expect(args.onValueChange).toHaveBeenCalledWith('2026-03-20')
  },
}

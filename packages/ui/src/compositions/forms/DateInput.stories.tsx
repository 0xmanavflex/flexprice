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

/** Local 09:30 on Oct 21, 2026, as an instant: what the date-and-time stories start on. */
const MORNING = new Date(2026, 9, 21, 9, 30).toISOString()

/** With `withTime`: the trigger reads the day and the time, in local time by default. */
export const WithTime: Story = {
  args: { value: MORNING, withTime: true, label: 'Starts' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Starts' })).toHaveTextContent(
      'Oct 21, 2026, 09:30 AM',
    )
  },
}

/** The Time row under the calendar: hours and minutes are typed, clamped and applied on blur. */
export const SetsTheTime: Story = {
  args: { value: MORNING, withTime: true, label: 'Starts' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Starts' }))
    const hours = await screen.findByRole('textbox', { name: 'Hours' })
    await expect(hours).toHaveValue('09')
    await userEvent.clear(hours)
    await userEvent.type(hours, '14{Enter}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith(
      new Date(2026, 9, 21, 14, 30).toISOString(),
    )
    const minutes = screen.getByRole('textbox', { name: 'Minutes' })
    await userEvent.clear(minutes)
    // Out of range is clamped, not refused.
    await userEvent.type(minutes, '75{Enter}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith(
      new Date(2026, 9, 21, 14, 59).toISOString(),
    )
  },
}

/** Picking a day keeps the time already set. */
export const PickingADayKeepsTheTime: Story = {
  args: { value: MORNING, withTime: true, label: 'Starts' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Starts' }))
    await userEvent.click(await screen.findByRole('button', { name: /October 25/ }))
    await expect(args.onValueChange).toHaveBeenCalledWith(
      new Date(2026, 9, 25, 9, 30).toISOString(),
    )
  },
}

/** UTC: the same instant read and set in UTC; the trigger says so. */
export const InUtc: Story = {
  args: { value: '2026-10-21T04:00:00.000Z', withTime: true, label: 'Starts' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Starts' }))
    await userEvent.click(await screen.findByRole('combobox', { name: 'Time zone' }))
    await userEvent.click(await screen.findByRole('option', { name: 'UTC' }))
    await expect(screen.getByRole('textbox', { name: 'Hours' })).toHaveValue('04')
    await expect(canvas.getByRole('button', { name: 'Starts' })).toHaveTextContent(
      'Oct 21, 2026, 04:00 AM UTC',
    )
    const hours = screen.getByRole('textbox', { name: 'Hours' })
    await userEvent.clear(hours)
    await userEvent.type(hours, '18{Enter}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2026-10-21T18:00:00.000Z')
  },
}

/** An optional date can be cleared from the trigger. */
export const Clearable: Story = {
  args: { value: '2026-03-15', clearable: true, clearLabel: 'Clear end date', label: 'Ends' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Clear end date' }))
    await expect(args.onValueChange).toHaveBeenCalledWith('')
  },
}

/** `min` and `max`: days outside them cannot be picked. */
export const Bounded: Story = {
  args: { value: '2026-03-15', min: '2026-03-10', max: '2026-03-20', label: 'Billing date' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Billing date' }))
    await expect(await screen.findByRole('button', { name: /March 5/ })).toBeDisabled()
    await expect(screen.getByRole('button', { name: /March 12/ })).toBeEnabled()
    await expect(screen.getByRole('button', { name: /March 25/ })).toBeDisabled()
  },
}

/** The background a token paints, read from a throwaway probe element. */
function tokenBackground(className: string) {
  const probe = document.createElement('div')
  probe.className = className
  document.body.append(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}

/**
 * Today is a primary tint: not the muted grey a hovered day gets, and not the
 * solid primary of the selected day. Opens on this month with the 15th picked
 * (or the 16th when today is the 15th).
 */
export const TodayStandsOut: Story = {
  args: (() => {
    const now = new Date()
    const day = now.getDate() === 15 ? 16 : 15
    const pad2 = (n: number) => String(n).padStart(2, '0')
    return { value: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(day)}` }
  })(),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Start date' }))
    const today = await screen.findByRole('button', { name: /^Today/ })
    const todayCell = today.closest('td')!
    const selected = document.querySelector<HTMLElement>('[data-selected-single="true"]')!
    const todayColor = getComputedStyle(todayCell).backgroundColor
    await expect(todayColor).not.toBe(tokenBackground('bg-muted'))
    await expect(todayColor).not.toBe('rgba(0, 0, 0, 0)')
    await expect(todayColor).not.toBe(getComputedStyle(selected).backgroundColor)
    await expect(todayColor).toBe(tokenBackground('bg-primary/15'))
  },
}

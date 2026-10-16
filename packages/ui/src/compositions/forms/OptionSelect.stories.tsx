import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { GaugeIcon } from '@ui/icons'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { OptionSelect, type Option, type OptionSelectProps } from './OptionSelect'

const PERIODS: Option[] = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
]

const WITH_HINTS: Option[] = [
  { value: 'api_calls', label: 'API calls', hint: 'api_calls' },
  { value: 'seats', label: 'Seats', hint: 'seats' },
  { value: 'storage', label: 'Storage', hint: 'storage_gb' },
]

/** `count` deterministic options, optionally with a lookup-key hint and a trailing glyph. */
function makeOptions(count: number, withHints: boolean, withTrailing: boolean): Option[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1
    return {
      value: `feature_${n}`,
      label: `Feature ${n}`,
      ...(withHints ? { hint: `feature_${n}` } : {}),
      ...(withTrailing ? { trailing: <GaugeIcon aria-hidden className="size-3.5" /> } : {}),
    }
  })
}

type DemoProps = OptionSelectProps & { label?: string }

/** Holds the value like a form would, and follows the `value` control. */
function Controlled({
  value: initial,
  onValueChange,
  label = 'Billing period',
  ...props
}: DemoProps) {
  const [value, setValue] = useState(initial)
  useEffect(() => setValue(initial), [initial])
  return (
    <div className="flex w-72 flex-col gap-1.5">
      <label htmlFor="option-select" className="text-sm font-medium">
        {label}
      </label>
      <OptionSelect
        {...props}
        id="option-select"
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
  title: 'Building blocks/Forms/OptionSelect',
  component: OptionSelect,
  parameters: {
    layout: 'centered',
    // Base UI renders aria-hidden focus guards around portalled popups; see ConfirmDialog.stories.tsx.
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'aria-input-field-name', enabled: false },
        ],
      },
    },
  },
  args: {
    value: '',
    options: PERIODS,
    onValueChange: fn(),
  },
  argTypes: {
    value: { control: 'text' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    options: { control: 'object' },
    onValueChange: { control: false },
    id: { control: false },
    'aria-describedby': { control: false },
    'aria-invalid': { control: false },
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof OptionSelect>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  value: string
  placeholder: string
  disabled: boolean
  invalid: boolean
  optionCount: number
  withHints: boolean
  withTrailing: boolean
  onValueChange: (value: string) => void
}

/** Drag the option count from 0 to 12 and toggle hints, trailing marks, disabled and invalid. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    value: '',
    placeholder: 'Select…',
    disabled: false,
    invalid: false,
    optionCount: 5,
    withHints: false,
    withTrailing: false,
    onValueChange: fn(),
  },
  argTypes: {
    value: { control: 'text', description: 'Selected option value, e.g. feature_2.' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    optionCount: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    withHints: { control: 'boolean' },
    withTrailing: { control: 'boolean' },
    onValueChange: { control: false },
  },
  render: ({ optionCount, withHints, withTrailing, invalid, ...rest }) => (
    <Controlled
      {...rest}
      label="Feature"
      options={makeOptions(optionCount, withHints, withTrailing)}
      {...(invalid ? { 'aria-invalid': true as const } : {})}
    />
  ),
}

/** Nothing chosen: the placeholder is shown. */
export const Placeholder: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('combobox', { name: 'Billing period' }),
    ).toHaveTextContent('Select…')
  },
}

/** Picking an option shows its label and reports its value. */
export const PicksAnOption: Story = {
  play: async ({ canvasElement, args }) => {
    const trigger = within(canvasElement).getByRole('combobox', { name: 'Billing period' })
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('option', { name: 'Annual' }))
    await expect(args.onValueChange).toHaveBeenCalledWith('ANNUAL')
    await expect(trigger).toHaveTextContent('Annual')
  },
}

/** A value that is already set is shown by label, not by raw value. */
export const Preselected: Story = {
  args: { value: 'QUARTERLY' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('combobox', { name: 'Billing period' }),
    ).toHaveTextContent('Quarterly')
  },
}

/** Options may carry a quiet lookup key beside the label. */
export const WithHints: Story = {
  args: { options: WITH_HINTS, placeholder: 'Select a feature…' },
  render: (args) => <Controlled {...args} label="Feature" />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox', { name: 'Feature' }))
    await expect(await screen.findByRole('option', { name: /Storage/ })).toHaveTextContent(
      'storage_gb',
    )
    await userEvent.keyboard('{Escape}')
  },
}

/** Disabled: the trigger cannot be opened. */
export const Disabled: Story = {
  args: { value: 'MONTHLY', disabled: true },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('combobox', { name: 'Billing period' })
    await expect(
      trigger.hasAttribute('disabled') || trigger.getAttribute('aria-disabled') === 'true',
    ).toBe(true)
  },
}

/** Invalid: the trigger is marked for assistive tech as well as styled. */
export const Invalid: Story = {
  args: { 'aria-invalid': true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('combobox', { name: 'Billing period' }),
    ).toHaveAttribute('aria-invalid', 'true')
  },
}

/** No options at all: still renders a trigger, with an empty list behind it. */
export const NoOptions: Story = {
  args: { options: [], placeholder: 'No billing periods' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('combobox', { name: 'Billing period' }),
    ).toHaveTextContent('No billing periods')
  },
}

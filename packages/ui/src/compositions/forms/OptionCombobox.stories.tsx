import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { GaugeIcon, PlusIcon } from '@ui/icons'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { OptionCombobox, type OptionComboboxProps } from './OptionCombobox'
import type { Option } from './OptionSelect'

const CURRENCIES: Option[] = [
  { value: 'usd', label: 'USD: US dollar' },
  { value: 'eur', label: 'EUR: Euro' },
  { value: 'inr', label: 'INR: Indian rupee' },
  { value: 'gbp', label: 'GBP: Pound sterling' },
  { value: 'jpy', label: 'JPY: Japanese yen' },
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

type DemoProps = OptionComboboxProps & { label?: string }

/** Holds the value like a form would, and follows the `value` control. */
function Controlled({ value: initial, onValueChange, label = 'Currency', ...props }: DemoProps) {
  const [value, setValue] = useState(initial)
  useEffect(() => setValue(initial), [initial])
  return (
    <div className="flex w-72 flex-col gap-1.5">
      <label htmlFor="option-combobox" className="text-sm font-medium">
        {label}
      </label>
      <OptionCombobox
        {...props}
        id="option-combobox"
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
  title: 'Building blocks/Forms/OptionCombobox',
  component: OptionCombobox,
  parameters: {
    layout: 'centered',
    // The vendored combobox list (role=listbox) is flagged as an unnamed input field, and a long one as an unfocusable scroller.
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
    options: CURRENCIES,
    onValueChange: fn(),
  },
  argTypes: {
    value: { control: 'text' },
    placeholder: { control: 'text' },
    emptyText: { control: 'text' },
    disabled: { control: 'boolean' },
    options: { control: 'object' },
    onValueChange: { control: false },
    id: { control: false },
    'aria-describedby': { control: false },
    'aria-invalid': { control: false },
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof OptionCombobox>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  value: string
  placeholder: string
  emptyText: string
  disabled: boolean
  invalid: boolean
  optionCount: number
  withHints: boolean
  withTrailing: boolean
  onValueChange: (value: string) => void
}

/** Drag the option count from 0 to 80 and type to filter; toggle hints, trailing marks, disabled and invalid. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    value: '',
    placeholder: 'Search…',
    emptyText: 'No matches.',
    disabled: false,
    invalid: false,
    optionCount: 30,
    withHints: true,
    withTrailing: false,
    onValueChange: fn(),
  },
  argTypes: {
    value: { control: 'text', description: 'Selected option value, e.g. feature_2.' },
    placeholder: { control: 'text' },
    emptyText: { control: 'text' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    optionCount: { control: { type: 'range', min: 0, max: 80, step: 1 } },
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

/** Typing narrows the list; choosing writes the label into the input and reports the value. */
export const FiltersAndPicks: Story = {
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('combobox', { name: 'Currency' })
    await userEvent.click(input)
    await userEvent.type(input, 'eur')
    await expect(await screen.findByRole('option', { name: 'EUR: Euro' })).toBeVisible()
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'USD: US dollar' })).not.toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('option', { name: 'EUR: Euro' }))
    await expect(args.onValueChange).toHaveBeenCalledWith('eur')
    await waitFor(() => expect(input).toHaveValue('EUR: Euro'))
  },
}

/**
 * A "Create …" item at the end leaves for the entity's own create form. It
 * survives any search, and choosing it is never a value.
 */
export const WithCreateAction: Story = {
  args: {
    createAction: { label: 'Create currency', icon: <PlusIcon aria-hidden />, onSelect: fn() },
  },
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('combobox', { name: 'Currency' })
    await userEvent.click(input)
    await userEvent.type(input, 'zzz')
    const create = await screen.findByRole('option', { name: 'Create currency' })
    await userEvent.click(create)
    await expect(args.createAction?.onSelect).toHaveBeenCalledOnce()
    await expect(args.onValueChange).not.toHaveBeenCalled()
  },
}

/** A search that matches nothing says so. */
export const NoMatches: Story = {
  args: { emptyText: 'No currencies match.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox', { name: 'Currency' })
    await userEvent.click(input)
    await userEvent.type(input, 'zzz')
    await expect(await screen.findByText('No currencies match.')).toBeVisible()
    await userEvent.keyboard('{Escape}')
  },
}

/** A value that is already set is shown by label, not by raw value. */
export const Preselected: Story = {
  args: { value: 'inr' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('combobox', { name: 'Currency' })).toHaveValue(
      'INR: Indian rupee',
    )
  },
}

/** The clear button empties the selection and reports an empty value. */
export const Clears: Story = {
  args: { value: 'usd' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Clear' }))
    await expect(args.onValueChange).toHaveBeenCalledWith('')
    await waitFor(() =>
      expect(within(canvasElement).getByRole('combobox', { name: 'Currency' })).toHaveValue(''),
    )
  },
}

/** Options may carry a quiet lookup key and a trailing mark. */
export const WithHintsAndTrailing: StoryObj<PlaygroundArgs> = {
  args: { ...Playground.args, optionCount: 6, withHints: true, withTrailing: true },
  render: Playground.render!,
}

/** A long, dynamic list (features, meters, timezones) stays searchable. */
export const LongList: StoryObj<PlaygroundArgs> = {
  args: { ...Playground.args, optionCount: 80 },
  render: Playground.render!,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox', { name: 'Feature' })
    await userEvent.click(input)
    await userEvent.type(input, 'Feature 7')
    await expect(await screen.findByRole('option', { name: /Feature 7\b/ })).toBeVisible()
    await userEvent.keyboard('{Escape}')
  },
}

/** Disabled: the input cannot be used. */
export const Disabled: Story = {
  // The vendored input is only marked data-disabled, so axe still checks its (muted) contrast.
  parameters: { a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } } },
  args: { value: 'usd', disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('combobox', { name: 'Currency' })).toHaveAttribute(
      'data-disabled',
    )
  },
}

/** Invalid: the input is marked for assistive tech as well as styled. */
export const Invalid: Story = {
  args: { 'aria-invalid': true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('combobox', { name: 'Currency' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  },
}

/**
 * A picker over a catalogue says it is a search.
 *
 * The control has always filtered as you type; with the trigger hidden it read
 * as a plain select, so people opened it, saw no search box and scrolled. The
 * magnifier is the whole fix, and typing still filters.
 */
export const Searchable: Story = {
  args: { searchable: true, placeholder: 'Search currencies…' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByPlaceholderText('Search currencies…')
    await userEvent.type(input, 'eur')
    await expect(await within(document.body).findByText(/EUR/)).toBeInTheDocument()
  },
}

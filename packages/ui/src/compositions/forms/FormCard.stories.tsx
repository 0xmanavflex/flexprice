import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Textarea } from '@ui/components/primitives/textarea'
import { DateInput } from './DateInput'
import { DashedRule, FormCard, FormRow, type FormCardProps } from './FormCard'
import { OptionSelect } from './OptionSelect'

type PlaygroundArgs = FormCardProps & {
  /** How many rows (1-6). */
  rows: number
  /** Put an error on the first row. */
  hasError: boolean
  /** Mark every row required. */
  rowsRequired: boolean
  /** Show the hint (i) on every row. */
  showHints: boolean
}

const PERIODS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ANNUAL', label: 'Annual' },
]

function RowsDemo({
  rows,
  hasError,
  rowsRequired,
  showHints,
}: Pick<PlaygroundArgs, 'rows' | 'hasError' | 'rowsRequired' | 'showHints'>) {
  const [period, setPeriod] = useState('MONTHLY')
  const [start, setStart] = useState('')
  const [autoRenew, setAutoRenew] = useState(true)
  const common = (hint: string) => ({
    ...(showHints ? { hint } : {}),
    ...(rowsRequired ? { required: true } : {}),
  })
  const all = [
    <FormRow
      key="name"
      label="Name"
      {...common('Shown on invoices and in the customer portal.')}
      error={hasError ? 'Name is required.' : undefined}
    >
      {(p) => <Input {...p} defaultValue="" />}
    </FormRow>,
    <FormRow key="email" label="Billing email" {...common('Invoices are sent here.')}>
      {(p) => <Input {...p} type="email" />}
    </FormRow>,
    <FormRow
      key="description"
      label="Description"
      align="start"
      {...common('Internal only; customers never see it.')}
    >
      {(p) => <Textarea {...p} rows={3} />}
    </FormRow>,
    <FormRow key="period" label="Billing period" {...common('How often the customer is billed.')}>
      {(p) => <OptionSelect {...p} value={period} onValueChange={setPeriod} options={PERIODS} />}
    </FormRow>,
    <FormRow key="start" label="Start date" {...common('Billing starts on this day.')}>
      {(p) => <DateInput {...p} value={start} onValueChange={setStart} />}
    </FormRow>,
    <FormRow key="renew" label="Auto-renew" {...common('Renews until cancelled.')}>
      <Switch checked={autoRenew} onCheckedChange={setAutoRenew} aria-label="Auto-renew" />
    </FormRow>,
  ]
  return <>{all.slice(0, Math.min(6, Math.max(1, rows)))}</>
}

const meta = {
  title: 'Building blocks/Forms/FormCard',
  component: FormCard,
  parameters: {
    layout: 'padded',
    // Hint popovers and the date picker portal Base UI `aria-hidden` focus
    // guards that axe flags; the library is vendored. See ConfirmDialog.stories.tsx.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  argTypes: {
    title: { control: 'text' },
    status: { control: 'inline-radio', options: ['required', 'optional'] },
    className: { control: 'text' },
    children: { control: false },
    rows: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    hasError: { control: 'boolean' },
    rowsRequired: { control: 'boolean' },
    showHints: { control: 'boolean' },
  },
  args: {
    title: 'Plan details',
    status: 'required',
    rows: 4,
    hasError: false,
    rowsRequired: false,
    showHints: false,
    children: null,
  },
  render: ({ rows, hasError, rowsRequired, showHints, children: _children, ...props }) => (
    <div className="max-w-3xl">
      <FormCard {...props}>
        <RowsDemo
          rows={rows}
          hasError={hasError}
          rowsRequired={rowsRequired}
          showHints={showHints}
        />
      </FormCard>
    </div>
  ),
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

/** One card of title/control rows; change the status badge, row count, hints, required marks and error. */
export const Playground: Story = {}

/** A card of required fields carries the Required badge. */
export const RequiredCard: Story = {
  args: { status: 'required', rowsRequired: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Plan details' })).toBeVisible()
    await expect(canvas.getByText('Required')).toBeVisible()
    await expect(canvas.getByRole('textbox', { name: /Name/ })).toBeRequired()
  },
}

/** Optional fields carry the Optional badge. */
export const OptionalCard: Story = {
  args: { title: 'Advanced', status: 'optional' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Optional')).toBeVisible()
  },
}

/** No title, so no header band and no rule above the first row. */
export const Untitled: Story = {
  args: { title: '' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('heading')).not.toBeInTheDocument()
  },
}

/** A row error is announced and wired to its control. */
export const RowWithError: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByRole('textbox', { name: /Name/ })
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toHaveAccessibleDescription(/Name is required\./)
    await expect(canvas.getByText('Name is required.')).toBeVisible()
  },
}

/** Hints sit behind an (i) but stay in the accessible description. */
export const WithHints: Story = {
  args: { showHints: true, rows: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('button', { name: 'More information' })).toHaveLength(3)
    await expect(canvas.getByRole('textbox', { name: /Name/ })).toHaveAccessibleDescription(
      'Shown on invoices and in the customer portal.',
    )
  },
}

/** Typing reaches the labelled control in its row. */
export const ControlsAreLabelled: Story = {
  args: { rows: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const email = canvas.getByRole('textbox', { name: 'Billing email' })
    await userEvent.type(email, 'billing@acme.example')
    await expect(email).toHaveValue('billing@acme.example')
  },
}

/** All six rows: text, textarea (top-aligned), select, date and a switch. */
export const AllRowKinds: Story = {
  args: { rows: 6, showHints: true },
}

/** A single row; the card shrinks to it. */
export const SingleRow: Story = { args: { rows: 1 } }

/** The card's row rule on its own, for a form that splits into parts the same way (an alert's levels). */
export const DashedRuleAlone: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-4 text-sm">
      <span>Info</span>
      <DashedRule data-testid="rule" />
      <span>Warning</span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const rule = within(canvasElement).getByTestId('rule')
    await expect(getComputedStyle(rule).borderTopStyle).toBe('dashed')
  },
}

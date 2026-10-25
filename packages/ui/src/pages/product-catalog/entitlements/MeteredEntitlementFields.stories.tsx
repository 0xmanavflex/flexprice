import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { UsageResetPeriod } from '@fp/domain'
import { MeteredEntitlementFields } from './MeteredEntitlementFields'

interface HarnessProps {
  limit: number
  unlimited: boolean
  resetPeriod: UsageResetPeriod
  unit: string
  usagePrice: string
  limitError: string
  disabled: boolean
  lockUnlimited: boolean
}

/** Holds the limit and reset period the way the entitlement forms do, so the fields respond. */
function MeteredFieldsHarness({
  limit: initialLimit,
  unlimited: initialUnlimited,
  resetPeriod: initialReset,
  unit,
  usagePrice,
  limitError,
  disabled,
  lockUnlimited,
}: HarnessProps) {
  const [limit, setLimit] = useState<number | null>(initialUnlimited ? null : initialLimit)
  const [reset, setReset] = useState<UsageResetPeriod>(initialReset)
  useEffect(
    () => setLimit(initialUnlimited ? null : initialLimit),
    [initialLimit, initialUnlimited],
  )
  useEffect(() => setReset(initialReset), [initialReset])
  return (
    <MeteredEntitlementFields
      limit={limit}
      unlimited={limit === null}
      onLimitChange={setLimit}
      resetPeriod={reset}
      onResetPeriodChange={setReset}
      unit={unit || undefined}
      usagePrice={usagePrice || undefined}
      limitError={limitError || undefined}
      disabled={disabled}
      lockUnlimited={lockUnlimited}
    />
  )
}

/** The metered half of the entitlement dialog, wired to local state. */
const meta = {
  title: 'App/Product catalog/Entitlements/Metered entitlement fields',
  component: MeteredFieldsHarness,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    limit: { control: { type: 'number', min: 0, max: 10_000_000, step: 1000 } },
    unlimited: { control: 'boolean' },
    resetPeriod: { control: 'select', options: Object.values(UsageResetPeriod) },
    unit: { control: 'text' },
    usagePrice: { control: 'text' },
    limitError: { control: 'text' },
    disabled: { control: 'boolean' },
    lockUnlimited: { control: 'boolean' },
  },
  args: {
    limit: 50_000,
    unlimited: false,
    resetPeriod: UsageResetPeriod.Monthly,
    unit: 'calls',
    usagePrice: '$0.002 / call',
    limitError: '',
    disabled: false,
    lockUnlimited: false,
  },
} satisfies Meta<typeof MeteredFieldsHarness>

export default meta
type Story = StoryObj<typeof meta>

/** Change the limit, unit, reset period, error and lock flags from the controls. */
export const Playground: Story = {}

/** The summary line follows the value and the reset period. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText('Customers get 50,000 calls, resetting every billing period.'),
    ).toBeInTheDocument()
    await expect(canvas.getByText(/\$0\.002 \/ call/)).toBeInTheDocument()
  },
}

/** Switching Unlimited on disables the value and hides Advanced. */
export const ToggleUnlimited: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch'))
    await expect(
      canvas.getByText('Customers get unlimited use of this feature.'),
    ).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Advanced' })).toBeNull()
  },
}

export const Unlimited: Story = {
  args: { unlimited: true },
}

/** Typing a new value updates the summary. */
export const EditsTheValue: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const value = canvas.getByRole('textbox', { name: /^Value/ })
    await userEvent.clear(value)
    await userEvent.type(value, '1200')
    await expect(canvas.getByText(/Customers get 1,200 calls/)).toBeInTheDocument()
  },
}

/** Advanced holds the UI-only window and stacking options. */
export const AdvancedOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Advanced' }))
    await expect(canvas.getByText('Window starts')).toBeInTheDocument()
    await expect(canvas.getByText('Stacking')).toBeInTheDocument()
  },
}

/** Each option's (i) explains both choices, not only the selected one. */
export const ExplainsAdvancedOptions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Advanced' }))
    // Field also states its hint as the control's description.
    await expect(
      canvas.getByRole('combobox', { name: 'Window starts' }),
    ).toHaveAccessibleDescription(/On first use: .* Calendar boundary: /)
    await expect(canvas.getByRole('combobox', { name: 'Stacking' })).toHaveAccessibleDescription(
      /Additive: .* Parallel: /,
    )
  },
}

/** Edit forms cannot remove a limit once set: the switch is locked off. */
export const LockedLimit: Story = {
  args: { lockUnlimited: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('switch')).toHaveAttribute('data-disabled')
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const WithError: Story = {
  args: { limitError: 'Enter a limit of zero or more' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Enter a limit of zero or more'),
    ).toBeInTheDocument()
  },
}

/** A reset period outside the short list is appended so the select can show it. */
export const QuarterlyReset: Story = {
  args: { resetPeriod: UsageResetPeriod.Quarterly },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText(/Quarterly/i).length).toBeGreaterThan(0)
  },
}

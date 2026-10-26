import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { EntitlementGrantDurationUnit, type MeteredGrant, emptyMeteredGrant } from '@fp/domain'
import { GrantAllowanceFields } from './GrantAllowanceFields'

interface HarnessProps {
  quota: string
  unlimited: boolean
  unit: MeteredGrant['unit']
  featureUnit: string
  usagePrice: string
  quotaError: string
  disabled: boolean
}

/** Holds the grant the way the entitlement forms do, so the fields respond. */
function GrantFieldsHarness({
  quota,
  unlimited,
  unit,
  featureUnit,
  usagePrice,
  quotaError,
  disabled,
}: HarnessProps) {
  const seed = (): MeteredGrant => ({
    ...emptyMeteredGrant(),
    quota: unlimited ? null : quota,
    unit,
  })
  const [grant, setGrant] = useState<MeteredGrant>(seed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setGrant(seed()), [quota, unlimited, unit])
  return (
    <GrantAllowanceFields
      value={grant}
      onChange={setGrant}
      unit={featureUnit || undefined}
      usagePrice={usagePrice || undefined}
      quotaError={quotaError || undefined}
      disabled={disabled}
    />
  )
}

/** The metered half of a plan or add-on entitlement, as V1 grants it, wired to local state. */
const meta = {
  title: 'App/Product catalog/Entitlements/Grant allowance fields',
  component: GrantFieldsHarness,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    quota: { control: 'text' },
    unlimited: { control: 'boolean' },
    unit: { control: 'select', options: Object.values(EntitlementGrantDurationUnit) },
    featureUnit: { control: 'text' },
    usagePrice: { control: 'text' },
    quotaError: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: {
    quota: '10000',
    unlimited: false,
    unit: EntitlementGrantDurationUnit.Day,
    featureUnit: 'calls',
    usagePrice: '$0.002 / call',
    quotaError: '',
    disabled: false,
  },
} satisfies Meta<typeof GrantFieldsHarness>

export default meta
type Story = StoryObj<typeof meta>

/** Change the value, window, unit, error and disabled state from the controls. */
export const Playground: Story = {}

/** The summary follows the value and the window. */
export const Daily: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('10000 calls each day.')).toBeInTheDocument()
    await expect(canvas.getByText(/\$0\.002 \/ call/)).toBeInTheDocument()
  },
}

export const BillingPeriod: Story = {
  args: { unit: EntitlementGrantDurationUnit.SubscriptionPeriod },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('10000 calls for the whole billing period.'),
    ).toBeInTheDocument()
  },
}

/** Unlimited clears the value, locks the window and hides Advanced. */
export const ToggleUnlimited: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch'))
    await expect(
      canvas.getByText('No ceiling: usage is tracked, with no allowance to run out.'),
    ).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Advanced' })).toBeNull()
  },
}

export const Unlimited: Story = {
  args: { unlimited: true },
}

/** A windowed allowance offers when the window starts; a billing period does not. */
export const AdvancedOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Advanced' }))
    await expect(
      canvas.getByRole('combobox', { name: 'Window starts' }),
    ).toHaveAccessibleDescription(/On first use: .* Calendar boundary: /)
    await expect(canvas.getByRole('combobox', { name: 'Stacking' })).toHaveAccessibleDescription(
      /Additive: .* Parallel: /,
    )
  },
}

export const AdvancedForBillingPeriod: Story = {
  args: { unit: EntitlementGrantDurationUnit.SubscriptionPeriod },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Advanced' }))
    await expect(canvas.queryByText('Window starts')).toBeNull()
    await expect(canvas.getByText('Stacking')).toBeInTheDocument()
  },
}

export const WithError: Story = {
  args: { quota: '', quotaError: 'Enter a value above zero' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Enter a value above zero')).toBeInTheDocument()
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}

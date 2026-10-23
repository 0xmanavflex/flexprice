import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  EntitlementUsage,
  EntitlementUsageTable,
  type EntitlementUsageRow,
} from './EntitlementUsage'

const RESETS = new Date('2026-11-01T00:00:00Z')

const meta = {
  title: 'Building blocks/Charts & metrics/EntitlementUsage',
  component: EntitlementUsage,
  parameters: { layout: 'padded' },
  args: {
    feature: 'API calls',
    used: 148320,
    limit: 250000,
    unit: 'calls',
    softLimit: false,
    resetsOn: RESETS,
    locale: 'en-US',
  },
  argTypes: {
    feature: { control: 'text' },
    used: { control: { type: 'number', min: 0, step: 100 } },
    limit: { control: { type: 'number', min: 0, step: 100 }, description: 'null is unlimited.' },
    unit: { control: 'text' },
    softLimit: { control: 'boolean' },
    resetsOn: { control: false },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE', 'en-IN'] },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EntitlementUsage>

export default meta
type Story = StoryObj<typeof meta>

/** Used of limit with its unit, the bar, and the reset date. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('148,320 of 250,000 calls')).toBeInTheDocument()
    await expect(canvas.getByRole('progressbar', { name: /API calls/ })).toHaveAttribute(
      'aria-valuenow',
      '59',
    )
    await expect(canvas.getByText('Resets Nov 1, 2026')).toBeInTheDocument()
  },
}

/** A soft limit bills past the cap: the bar is full, the reading keeps counting. */
export const OverSoftLimit: Story = {
  args: { feature: 'Tokens', used: 1243900, limit: 1000000, unit: 'tokens', softLimit: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('1,243,900 of 1,000,000 tokens')).toBeInTheDocument()
    await expect(canvas.getByText(/over the included amount by 243,900/i)).toBeInTheDocument()
    await expect(canvas.getByText(/Soft limit/)).toBeInTheDocument()
  },
}

/** No denominator, so no bar — and no "soft limit" on something with no limit. */
export const Unlimited: Story = {
  args: { feature: 'Active users', used: 3412, limit: null, unit: 'users', softLimit: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Unlimited')).toBeInTheDocument()
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument()
    await expect(canvas.queryByText(/Soft limit/)).not.toBeInTheDocument()
  },
}

/** Usage that was never reported is a dash, not a zero. */
export const NotReported: Story = {
  args: { used: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('—')).toBeInTheDocument()
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument()
  },
}

const openContract = fn()

const customerRows: EntitlementUsageRow[] = [
  {
    id: 'api',
    feature: 'API calls',
    featureType: 'metered',
    enabled: true,
    limit: 250000,
    unit: 'calls',
    resetPeriodLabel: 'Monthly',
    used: 148320,
    resetsOn: RESETS,
    sources: [{ label: 'Growth', onOpen: openContract }],
  },
  {
    id: 'tokens',
    feature: 'Tokens processed',
    featureType: 'metered',
    enabled: true,
    limit: 1000000,
    unit: 'tokens',
    softLimit: true,
    resetPeriodLabel: 'Monthly',
    used: 1243900,
    resetsOn: RESETS,
    sources: [{ label: 'Growth', onOpen: openContract }, { label: 'Token pack' }],
  },
  {
    id: 'users',
    feature: 'Active users',
    featureType: 'metered',
    enabled: true,
    limit: null,
    unit: 'users',
    used: 3412,
    resetsOn: RESETS,
    sources: [{ label: 'Growth', onOpen: openContract }],
  },
  {
    id: 'sso',
    feature: 'Single sign-on',
    featureType: 'boolean',
    enabled: true,
    limit: null,
    sources: [{ label: 'Growth', onOpen: openContract }],
  },
  {
    id: 'tier',
    feature: 'Support tier',
    featureType: 'static',
    enabled: true,
    limit: null,
    staticValue: 'Premium',
    sources: [{ label: 'Growth', onOpen: openContract }],
  },
]

/** The customer overview's table: every grant, where it comes from, and its usage. */
export const CustomerTable: StoryObj<typeof EntitlementUsageTable> = {
  render: () => <EntitlementUsageTable rows={customerRows} locale="en-US" />,
  decorators: [(Story) => <Story />],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('columnheader', { name: /Source/ })).toBeInTheDocument()
    await expect(canvas.getByText('148,320 of 250,000 calls')).toBeInTheDocument()
    await expect(canvas.getByText('1,000,000 (soft) / monthly')).toBeInTheDocument()
    await expect(canvas.getByText('Included')).toBeInTheDocument()
    await expect(canvas.getByText('Premium')).toBeInTheDocument()
    await expect(canvas.getByText('+1')).toBeInTheDocument()
    // One bar per capped metered feature; the unlimited, boolean and static rows draw none.
    await expect(canvas.getAllByRole('progressbar')).toHaveLength(2)
    await userEvent.click(canvas.getAllByRole('button', { name: 'Growth' })[0]!)
    await expect(openContract).toHaveBeenCalled()
  },
}

/** A contract's table: it is the source, so the column is not drawn. */
export const ContractTable: StoryObj<typeof EntitlementUsageTable> = {
  render: () => (
    <EntitlementUsageTable
      locale="en-US"
      rows={customerRows.map(({ sources: _sources, ...row }) => row)}
    />
  ),
  decorators: [(Story) => <Story />],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('columnheader', { name: /Source/ })).not.toBeInTheDocument()
    await expect(canvas.getByRole('columnheader', { name: /Usage/ })).toBeInTheDocument()
  },
}

/** A feature the contract excludes says so, and has no usage to show. */
export const NotIncluded: StoryObj<typeof EntitlementUsageTable> = {
  render: () => (
    <EntitlementUsageTable
      rows={[{ id: 'x', feature: 'Audit log', enabled: false, limit: 0, used: 0 }]}
    />
  ),
  decorators: [(Story) => <Story />],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Not included')).toBeInTheDocument()
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument()
  },
}

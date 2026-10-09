import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FeatureType } from '@fp/domain'
import { PlanEntitlementsView, type PlanEntitlementsViewProps } from './PlanEntitlementsView'
import { makeEntitlements } from './planDetailFixtures'

interface PlaygroundProps extends Pick<PlanEntitlementsViewProps, 'onAdd' | 'onEdit' | 'onDelete'> {
  rows: number
  featureType: FeatureType | 'mixed'
  /** Every n-th metered entitlement is unlimited; 0 for none. */
  unlimitedEvery: number
  /** When off, metered rows read "No usage price on this plan". */
  hasUsagePrice: boolean
  /** Wire `onOpenFeature`, which makes rows clickable. */
  rowsOpenFeature: boolean
  onOpenFeature: (featureId: string) => void
}

/** Fixture entitlements built from the controls. */
function EntitlementsPlayground({
  rows,
  featureType,
  unlimitedEvery,
  hasUsagePrice,
  rowsOpenFeature,
  onOpenFeature,
  ...handlers
}: PlaygroundProps) {
  return (
    <PlanEntitlementsView
      entitlements={makeEntitlements(rows, { featureType, unlimitedEvery })}
      usagePrice={() => (hasUsagePrice ? '$0.002 per unit' : null)}
      {...(rowsOpenFeature ? { onOpenFeature } : {})}
      {...handlers}
    />
  )
}

/** A plan's entitlements table. Drag rows from 0 to 40 to see the empty state, a short table and a long one. */
const meta = {
  title: 'App/Product catalog/Plans/Plan entitlements',
  component: EntitlementsPlayground,
  parameters: { layout: 'padded' },
  args: {
    rows: 5,
    featureType: 'mixed',
    unlimitedEvery: 4,
    hasUsagePrice: true,
    rowsOpenFeature: true,
    onAdd: fn(),
    onEdit: fn(),
    onDelete: fn(),
    onOpenFeature: fn(),
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 40, step: 1 } },
    featureType: { control: 'select', options: ['mixed', ...Object.values(FeatureType)] },
    unlimitedEvery: { control: { type: 'number', min: 0, max: 10, step: 1 } },
    hasUsagePrice: { control: 'boolean' },
    rowsOpenFeature: { control: 'boolean' },
    onAdd: { control: false },
    onEdit: { control: false },
    onDelete: { control: false },
    onOpenFeature: { control: false },
  },
} satisfies Meta<typeof EntitlementsPlayground>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('AI Tokens')[0]).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: 'Add entitlement' })[0]).toBeVisible()
  },
}

/** Nothing included yet: the empty state carries the add action. */
export const Empty: Story = {
  args: { rows: 0 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No entitlements yet')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Add entitlement' }))
    await expect(args.onAdd).toHaveBeenCalledOnce()
  },
}

export const SingleRow: Story = {
  args: { rows: 1, featureType: FeatureType.Metered, unlimitedEvery: 0 },
}

/** Metered rows whose feature has no usage price on the plan. */
export const NoUsagePrice: Story = {
  args: { featureType: FeatureType.Metered, unlimitedEvery: 0, hasUsagePrice: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText('No usage price on this plan')[0]).toBeVisible()
  },
}

/** Unlimited metered allowances show as "Unlimited" with no overage column. */
export const Unlimited: Story = {
  args: { rows: 3, featureType: FeatureType.Metered, unlimitedEvery: 1 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText('Unlimited')[0]).toBeVisible()
  },
}

export const LongList: Story = {
  args: { rows: 40 },
}

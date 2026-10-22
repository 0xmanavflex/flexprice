import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BillingPeriod, FeatureType, type Plan, PlanStatus } from '@fp/domain'
import { makeEntitlements } from '../plans/planDetailFixtures'
import { planFixtures } from '../plans/planFixtures'
import { PricingCatalogBlock, type PricingCatalogBlockProps } from './PricingCatalogBlock'

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹' }
const NAMES = ['Starter', 'Pro', 'Business', 'Scale', 'Enterprise', 'Team']

interface PlaygroundProps extends Pick<
  PricingCatalogBlockProps,
  'loading' | 'onCreatePlan' | 'onEditPlan' | 'tenant'
> {
  planCount: number
  currency: string
  billingPeriod: typeof BillingPeriod.Monthly | typeof BillingPeriod.Annual
  featuresPerPlan: number
  includeArchived: boolean
}

/** Plans priced from the controls: price climbs with the plan's position, the period decides monthly or annual. */
function makePlans(
  count: number,
  currency: string,
  period: string,
  includeArchived: boolean,
): Plan[] {
  return Array.from({ length: count }, (_, index): Plan => {
    const base = planFixtures[index % planFixtures.length]!
    const amount = (index + 1) * (period === BillingPeriod.Annual ? 290 : 29)
    return {
      ...base,
      id: `plan_${index}`,
      name: `${NAMES[index % NAMES.length]}${index >= NAMES.length ? ` ${index}` : ''}`,
      status: includeArchived && index % 4 === 3 ? PlanStatus.Archived : PlanStatus.Published,
      chargeCount: 1,
      headline: { amount: `${SYMBOL[currency] ?? '$'}${amount}`, period },
    }
  })
}

function CatalogPlayground({
  planCount,
  currency,
  billingPeriod,
  featuresPerPlan,
  includeArchived,
  ...rest
}: PlaygroundProps) {
  const plans = makePlans(planCount, currency, billingPeriod, includeArchived)
  const entitlements = plans.flatMap((plan) =>
    makeEntitlements(featuresPerPlan, { featureType: FeatureType.Metered, entityId: plan.id }).map(
      (e) => ({ ...e, id: `${plan.id}_${e.id}` }),
    ),
  )
  return <PricingCatalogBlock plans={plans} entitlements={entitlements} {...rest} />
}

/** The vendored PlanTile wraps list items in separators and renders a footer per tile; these are inherent to it. */
const planTileRules = [
  { id: 'aria-required-children', enabled: false },
  { id: 'landmark-no-duplicate-contentinfo', enabled: false },
  { id: 'landmark-unique', enabled: false },
]

const page: Decorator = (Story) => (
  <div className="bg-background flex min-h-screen flex-col">
    <Story />
  </div>
)

/** The pricing widget: plan tiles from the catalogue and the embed snippet. Drag plan count to 0 for the empty state, or toggle loading. */
const meta = {
  title: 'App/Product catalog/Pricing widgets/Pricing widget',
  component: CatalogPlayground,
  parameters: { layout: 'fullscreen', a11y: { config: { rules: planTileRules } } },
  decorators: [page],
  args: {
    planCount: 3,
    currency: 'USD',
    billingPeriod: BillingPeriod.Monthly,
    featuresPerPlan: 5,
    includeArchived: false,
    loading: false,
    tenant: 'acme',
    onCreatePlan: fn(),
    onEditPlan: fn(),
  },
  argTypes: {
    planCount: { control: { type: 'number', min: 0, max: 12, step: 1 } },
    currency: { control: 'select', options: Object.keys(SYMBOL) },
    billingPeriod: {
      control: 'inline-radio',
      options: [BillingPeriod.Monthly, BillingPeriod.Annual],
    },
    featuresPerPlan: { control: { type: 'number', min: 0, max: 10, step: 1 } },
    includeArchived: { control: 'boolean' },
    loading: { control: 'boolean' },
    tenant: { control: 'text' },
    onCreatePlan: { control: false },
    onEditPlan: { control: false },
  },
} satisfies Meta<typeof CatalogPlayground>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Pricing widget')).toBeVisible()
    await expect(canvas.getByText(/3 published plans are shown/)).toBeVisible()
    await expect(canvas.getByText(/data-tenant="acme"/)).toBeVisible()
  },
}

/** The catalogue is still loading: skeletons, never the empty state. */
export const Loading: Story = {
  args: { loading: true },
  parameters: {
    // The skeleton grid puts aria-label on a role-less div (component issue).
    a11y: { config: { rules: [...planTileRules, { id: 'aria-prohibited-attr', enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Loading plans')).toBeInTheDocument()
    await expect(canvas.queryByText('No plans to show yet')).toBeNull()
  },
}

/** No plans: the empty state offers to create one. */
export const Empty: Story = {
  args: { planCount: 0 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No plans to show yet')).toBeVisible()
    // One create button, in the header row; the empty state does not repeat it.
    await expect(canvas.getAllByRole('button', { name: 'Create plan' })).toHaveLength(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Create plan' }))
    await expect(args.onCreatePlan).toHaveBeenCalledOnce()
  },
}

export const SinglePlan: Story = {
  args: { planCount: 1, featuresPerPlan: 2 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/1 published plan is shown/)).toBeVisible()
  },
}

/** Twelve plans wrap across the grid. */
export const ManyPlans: Story = {
  args: { planCount: 12, featuresPerPlan: 6, includeArchived: true },
  parameters: {
    // Archived tiles are dimmed by the vendored PlanTile (opacity-80), which drops muted text below 4.5:1.
    a11y: { config: { rules: [...planTileRules, { id: 'color-contrast', enabled: false }] } },
  },
}

/** Annual billing prices the tiles per year and the snippet follows the interval toggle. */
export const AnnualInterval: Story = {
  args: { billingPeriod: BillingPeriod.Annual, currency: 'EUR' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Annual' }))
    await expect(canvas.getByRole('button', { name: 'Annual' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(canvas.getByText(/data-interval="annual"/)).toBeVisible()
  },
}

/** Tiles show three features; "Show more" reveals the rest in place. */
export const ExpandsFeatures: Story = {
  args: { planCount: 1, featuresPerPlan: 6 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Show 3 more features' }))
    await expect(canvas.getByRole('button', { name: 'Show fewer features' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { BillingModel, BillingPeriod } from '@fp/domain'
import { PlanChargesView, type PlanChargesViewProps } from './PlanChargesView'
import { makeCharges, meterUnitOf } from './planDetailFixtures'

interface PlaygroundProps extends Pick<
  PlanChargesViewProps,
  'onAdd' | 'onEdit' | 'onTerminate' | 'onRetry'
> {
  fixedCharges: number
  usageCharges: number
  usageModel: BillingModel
  billingPeriod: BillingPeriod
  readOnly: boolean
  loading: boolean
  error: boolean
}

/** Fixture charges built from the counts, so the empty, short and long states are one drag away. */
function ChargesPlayground({
  fixedCharges,
  usageCharges,
  usageModel,
  billingPeriod,
  readOnly,
  loading,
  error,
  ...handlers
}: PlaygroundProps) {
  const charges = makeCharges(fixedCharges, usageCharges, {
    billingModel: usageModel,
    billingPeriod,
  })
  return (
    <PlanChargesView
      charges={charges}
      readOnly={readOnly}
      loading={loading}
      error={error}
      meterUnit={meterUnitOf}
      {...handlers}
    />
  )
}

/** A plan's charges in one table with search and filters. Drag the counts from 0 to 20 to see empty, short and long lists. */
const meta = {
  title: 'App/Product catalog/Plans/Plan charges',
  component: ChargesPlayground,
  parameters: { layout: 'padded' },
  args: {
    fixedCharges: 2,
    usageCharges: 2,
    usageModel: BillingModel.Tiered,
    billingPeriod: BillingPeriod.Monthly,
    readOnly: false,
    loading: false,
    error: false,
    onAdd: fn(),
    onRetry: fn(),
    onEdit: fn(),
    onTerminate: fn(),
  },
  argTypes: {
    fixedCharges: { control: { type: 'number', min: 0, max: 20, step: 1 } },
    usageCharges: { control: { type: 'number', min: 0, max: 20, step: 1 } },
    usageModel: { control: 'select', options: Object.values(BillingModel) },
    billingPeriod: { control: 'select', options: Object.values(BillingPeriod) },
    readOnly: { control: 'boolean' },
    loading: { control: 'boolean' },
    error: { control: 'boolean' },
    onRetry: { control: false },
    onAdd: { control: false },
    onEdit: { control: false },
    onTerminate: { control: false },
  },
} satisfies Meta<typeof ChargesPlayground>

export default meta
type Story = StoryObj<typeof meta>

/** Every fixture knob as a control. */
export const Playground: Story = {}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Charges table' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Add charge' })).toBeVisible()
  },
}

/** Nothing billed yet: the empty state carries the add action. */
export const Empty: Story = {
  args: { fixedCharges: 0, usageCharges: 0 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No charges yet')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Add charge' }))
    await expect(args.onAdd).toHaveBeenCalledOnce()
  },
}

/** The prices are still loading: skeleton rows, no add button. */
/**
 * Loading is the shared table's skeleton, and nothing else.
 *
 * This used to assert a disabled "Add charge" alongside it. Since the plan's
 * charges moved onto the shared `ChargeTable`, the empty and loading states
 * come from `SubTabState`, whose loading branch is a bare skeleton with no
 * action slot — so the button is genuinely absent, not merely disabled.
 *
 * Fixed here rather than by giving `SubTabState` an action during loading:
 * that branch is shared by every sub-tab in the console, and widening it for
 * one caller's story would change all of them. Whether the button ought to
 * stay put and disabled, instead of vanishing and returning, is a real
 * question — but it is one about the shared state, not about this view.
 */
export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading charges')).toBeInTheDocument()
    // The add action keeps its place in the header, disabled until charges load.
    await expect(canvas.getByRole('button', { name: 'Add charge' })).toBeDisabled()
  },
}

/** The fetch failed: an error with a retry, never "No charges yet". */
export const LoadFailed: Story = {
  args: { error: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeVisible()
    await expect(canvas.queryByText('No charges yet')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** Only fixed charges. */
export const FixedOnly: Story = {
  args: { fixedCharges: 3, usageCharges: 0 },
}

/** Only usage charges, priced as package bundles. */
export const UsageOnlyPackages: Story = {
  args: { fixedCharges: 0, usageCharges: 3, usageModel: BillingModel.Package },
}

/** Forty rows: the table pages them. */
export const LongList: Story = {
  args: { fixedCharges: 20, usageCharges: 20 },
}

/** A published plan: no add button, no row menus. */
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Add charge' })).toBeNull()
    await expect(canvas.queryAllByRole('button', { name: /^Actions for/ })).toHaveLength(0)
  },
}

export const AddsACharge: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add charge' }))
    await expect(args.onAdd).toHaveBeenCalledOnce()
  },
}

/** The row menu terminates a charge; the view only reports it. */
export const TerminatesACharge: Story = {
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getAllByRole('button', { name: /^Actions for/ })[0]!)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Terminate' }))
    await expect(args.onTerminate).toHaveBeenCalledOnce()
    await expect(args.onEdit).not.toHaveBeenCalled()
  },
}

/** Tier details move from inline lists into the shared charge sheet. */
export const TieredChargeOpensSheet: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const price = (await canvas.findAllByText(/tiers, from/i))[0] as HTMLElement
    const row = price.closest('tr')!
    await expect(within(row).queryAllByRole('listitem')).toHaveLength(0)
    await userEvent.click(price)
    const sheet = await screen.findByRole('dialog')
    await expect(within(sheet).getByText('Price', { exact: true })).toBeVisible()
  },
}

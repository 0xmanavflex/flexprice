import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { BillingModel, BillingPeriod } from '@fp/domain'
import { PlanChargesView, type PlanChargesViewProps } from './PlanChargesView'
import { makeCharges, meterUnitOf } from './planDetailFixtures'

interface PlaygroundProps extends Pick<PlanChargesViewProps, 'onAdd' | 'onEdit' | 'onTerminate'> {
  fixedCharges: number
  usageCharges: number
  usageModel: BillingModel
  billingPeriod: BillingPeriod
  readOnly: boolean
}

/** Fixture charges built from the counts, so the empty, short and long states are one drag away. */
function ChargesPlayground({
  fixedCharges,
  usageCharges,
  usageModel,
  billingPeriod,
  readOnly,
  ...handlers
}: PlaygroundProps) {
  const charges = makeCharges(fixedCharges, usageCharges, {
    billingModel: usageModel,
    billingPeriod,
  })
  return (
    <PlanChargesView charges={charges} readOnly={readOnly} meterUnit={meterUnitOf} {...handlers} />
  )
}

/** A plan's charges, grouped into fixed and usage bands. Drag the counts from 0 to 20 to see empty, short and long lists. */
const meta = {
  title: 'Surfaces/PlanChargesView',
  component: ChargesPlayground,
  parameters: { layout: 'padded' },
  args: {
    fixedCharges: 2,
    usageCharges: 2,
    usageModel: BillingModel.Tiered,
    billingPeriod: BillingPeriod.Monthly,
    readOnly: false,
    onAdd: fn(),
    onEdit: fn(),
    onTerminate: fn(),
  },
  argTypes: {
    fixedCharges: { control: { type: 'number', min: 0, max: 20, step: 1 } },
    usageCharges: { control: { type: 'number', min: 0, max: 20, step: 1 } },
    usageModel: { control: 'select', options: Object.values(BillingModel) },
    billingPeriod: { control: 'select', options: Object.values(BillingPeriod) },
    readOnly: { control: 'boolean' },
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
    await expect(canvas.getByRole('group', { name: 'Fixed charges' })).toBeVisible()
    await expect(canvas.getByRole('group', { name: 'Usage charges' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Add charge' })).toBeVisible()
  },
}

/** Nothing billed yet: the empty state carries the add action. */
export const Empty: Story = {
  args: { fixedCharges: 0, usageCharges: 0 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No charges yet')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Add the first charge' }))
    await expect(args.onAdd).toHaveBeenCalledOnce()
  },
}

/** Only fixed charges: the usage band is not drawn. */
export const FixedOnly: Story = {
  args: { fixedCharges: 3, usageCharges: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('group', { name: 'Fixed charges' })).toBeVisible()
    await expect(canvas.queryByRole('group', { name: 'Usage charges' })).toBeNull()
  },
}

/** Only usage charges, priced as package bundles. */
export const UsageOnlyPackages: Story = {
  args: { fixedCharges: 0, usageCharges: 3, usageModel: BillingModel.Package },
}

/** Twenty rows in each band. */
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

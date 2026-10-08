import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import {
  type CreditGrant,
  CreditGrantCadence,
  CreditGrantExpiryDurationUnit,
  CreditGrantExpiryType,
  CreditGrantPeriod,
  CreditGrantScope,
} from '@fp/domain'
import { PlanCreditGrantsView } from './PlanCreditGrantsView'

/** The Credit grants tab of a plan: titled card, Add grant, grant table. */
const meta = {
  title: 'Surfaces/PlanCreditGrantsView',
  component: PlanCreditGrantsView,
  parameters: { layout: 'padded' },
  args: { grants: [], onAdd: fn(), onEdit: fn(), onDelete: fn() },
} satisfies Meta<typeof PlanCreditGrantsView>

export default meta
type Story = StoryObj<typeof meta>

const grant = (over: Partial<CreditGrant>): CreditGrant => ({
  id: 'cg_01',
  name: 'Welcome credits',
  scope: CreditGrantScope.Plan,
  credits: '5000',
  cadence: CreditGrantCadence.OneTime,
  period: null,
  periodCount: null,
  expirationType: CreditGrantExpiryType.Never,
  expirationDuration: null,
  expirationDurationUnit: null,
  conversionRate: null,
  priority: 1,
  createdAt: new Date('2026-01-10T00:00:00Z'),
  ...over,
})

export const Default: Story = {
  args: {
    grants: [
      grant({}),
      grant({
        id: 'cg_02',
        name: 'Monthly included credits',
        credits: '2000',
        cadence: CreditGrantCadence.Recurring,
        period: CreditGrantPeriod.Monthly,
        periodCount: 1,
        expirationType: CreditGrantExpiryType.BillingCycle,
        priority: 2,
      }),
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Add grant')).toBeInTheDocument()
  },
}

export const Empty: Story = {}

type PlaygroundArgs = Omit<ComponentProps<typeof PlanCreditGrantsView>, 'grants'> & {
  /** How many grants the plan has; 0 shows the empty state. */
  count: number
  credits: number
  cadence: CreditGrantCadence
  period: CreditGrantPeriod
  expirationType: CreditGrantExpiryType
}

/** Drag the grant count from 0 to 12 and change what each grant is: cadence, period, expiry. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^on[A-Z].*$/ } },
  args: {
    count: 3,
    credits: 2000,
    cadence: CreditGrantCadence.Recurring,
    period: CreditGrantPeriod.Monthly,
    expirationType: CreditGrantExpiryType.BillingCycle,
  },
  argTypes: {
    count: { control: { type: 'number', min: 0, max: 12, step: 1 } },
    credits: { control: { type: 'number', min: 1, max: 1_000_000, step: 500 } },
    cadence: { control: 'inline-radio', options: Object.values(CreditGrantCadence) },
    period: {
      control: 'select',
      options: Object.values(CreditGrantPeriod),
      description: 'Used when the cadence is recurring.',
    },
    expirationType: { control: 'select', options: Object.values(CreditGrantExpiryType) },
  },
  render: ({ count, credits, cadence, period, expirationType, ...rest }) => (
    <PlanCreditGrantsView
      {...rest}
      grants={Array.from({ length: count }, (_, index) =>
        grant({
          id: `cg_${index + 1}`,
          name: `Grant ${index + 1}`,
          credits: String(credits * (index + 1)),
          cadence,
          period: cadence === CreditGrantCadence.Recurring ? period : null,
          periodCount: cadence === CreditGrantCadence.Recurring ? 1 : null,
          expirationType,
          expirationDuration: expirationType === CreditGrantExpiryType.Duration ? 30 : null,
          expirationDurationUnit:
            expirationType === CreditGrantExpiryType.Duration
              ? CreditGrantExpiryDurationUnit.Day
              : null,
          priority: index + 1,
        }),
      )}
    />
  ),
}

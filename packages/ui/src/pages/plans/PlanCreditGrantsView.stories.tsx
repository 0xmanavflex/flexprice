import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import {
  type CreditGrant,
  CreditGrantCadence,
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

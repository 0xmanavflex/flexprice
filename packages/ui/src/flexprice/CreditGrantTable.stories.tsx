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
import { CreditGrantTable } from './CreditGrantTable'

/**
 * A plan's credit grants, as a read table. Cadence carries the period where
 * there is one — "Recurring · Monthly" — because a recurring grant only means
 * something with the period it refreshes on beside it. No network.
 */
const meta = {
  title: 'Surfaces/CreditGrantTable',
  component: CreditGrantTable,
  parameters: { layout: 'padded' },
  args: { grants: [] },
} satisfies Meta<typeof CreditGrantTable>

export default meta
type Story = StoryObj<typeof meta>

const grantFixtures: CreditGrant[] = [
  {
    id: 'cg_01',
    name: 'Welcome credits',
    scope: CreditGrantScope.Plan,
    credits: '100',
    cadence: CreditGrantCadence.OneTime,
    period: null,
    periodCount: null,
    expirationType: CreditGrantExpiryType.Never,
    expirationDuration: null,
    expirationDurationUnit: null,
    conversionRate: null,
    priority: 0,
    createdAt: new Date('2026-01-10T00:00:00Z'),
  },
  {
    id: 'cg_02',
    name: 'Monthly allowance',
    scope: CreditGrantScope.Plan,
    credits: '500',
    cadence: CreditGrantCadence.Recurring,
    period: CreditGrantPeriod.Monthly,
    periodCount: 1,
    expirationType: CreditGrantExpiryType.BillingCycle,
    expirationDuration: null,
    expirationDurationUnit: null,
    conversionRate: '0.01',
    priority: 1,
    createdAt: new Date('2026-01-12T00:00:00Z'),
  },
  {
    id: 'cg_03',
    name: 'Promo top-up',
    scope: CreditGrantScope.Plan,
    credits: '50',
    cadence: CreditGrantCadence.OneTime,
    period: null,
    periodCount: null,
    expirationType: CreditGrantExpiryType.Duration,
    expirationDuration: 90,
    expirationDurationUnit: CreditGrantExpiryDurationUnit.Day,
    conversionRate: null,
    priority: 2,
    createdAt: new Date('2026-01-14T00:00:00Z'),
  },
]

/** The read-only table the Credit Grants tab shows. */
export const Default: Story = {
  args: { grants: grantFixtures },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Welcome credits')).toBeInTheDocument()
    await expect(canvas.getAllByText('One-time').length).toBeGreaterThan(0)
    await expect(canvas.getByText('Recurring · Monthly')).toBeInTheDocument()
    await expect(canvas.getByText('Expires after a set duration')).toBeInTheDocument()
  },
}

/** With add and delete wired, each row carries a remove action. */
export const WithActions: Story = {
  args: { grants: grantFixtures, onAdd: fn(), onDelete: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: /remove welcome credits/i }),
    ).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /add credit grant/i })).toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: { grants: [], onAdd: fn() },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No credit grants yet')).toBeInTheDocument()
  },
}

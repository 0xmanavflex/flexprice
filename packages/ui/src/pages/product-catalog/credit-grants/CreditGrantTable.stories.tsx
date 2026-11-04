import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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
 * there is one: "Recurring · Monthly": because a recurring grant only means
 * something with the period it refreshes on beside it. No network.
 */
const meta = {
  title: 'App/Product catalog/Credit grants/Credit grant table',
  component: CreditGrantTable,
  parameters: { layout: 'padded' },
  args: { grants: [] },
  argTypes: {
    grants: { control: false },
    onAdd: { control: false },
    onEdit: { control: false },
    onDelete: { control: false },
  },
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

function manyGrants(count: number): CreditGrant[] {
  return Array.from({ length: count }, (_, index) => {
    const base = grantFixtures[index % grantFixtures.length] as CreditGrant
    return { ...base, id: `cg_gen_${index}`, name: `${base.name} ${index + 1}`, priority: index }
  })
}

/** Drag `rows` from 0 to 60: empty state, a short list, a long one. Toggle the row actions. */
export const Playground: StoryObj<
  ComponentProps<typeof CreditGrantTable> & { rows: number; showActions: boolean }
> = {
  args: { rows: 5, showActions: true },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    showActions: { control: 'boolean' },
  },
  render: ({ rows, showActions }) => (
    <CreditGrantTable
      grants={manyGrants(rows)}
      {...(showActions ? { onAdd: fn(), onEdit: fn(), onDelete: fn() } : {})}
    />
  ),
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
}

/** The read-only table the Credit Grants tab shows. */
export const Default: Story = {
  args: { grants: grantFixtures },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Welcome credits')).toBeInTheDocument()
    await expect(canvas.getAllByText('One-time').length).toBeGreaterThan(0)
    await expect(canvas.getByText('Recurring · Monthly')).toBeInTheDocument()
    await expect(canvas.getByText('Expires after 90 days')).toBeInTheDocument()
  },
}

/** With add, edit and delete wired, each row carries an actions menu. */
export const WithActions: Story = {
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
  args: { grants: grantFixtures, onAdd: fn(), onEdit: fn(), onDelete: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /add credit grant/i })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Welcome credits' }))
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('menuitem', { name: 'Remove' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    await expect(args.onEdit).toHaveBeenCalled()
  },
}

export const Empty: Story = {
  args: { grants: [], onAdd: fn() },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No credit grants yet')).toBeInTheDocument()
  },
}

/** Loading is a skeleton, never "No credit grants yet". */
export const Loading: Story = {
  args: { grants: [], isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Loading credit grants')).toBeInTheDocument()
    await expect(canvas.queryByText('No credit grants yet')).toBeNull()
  },
}

/** A failed load says so and offers a retry; it never reads as "No credit grants yet". */
export const SubTabError: Story = {
  args: {
    grants: [],
    error: 'Could not load the credit grants.',
    errorKind: 'server',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Could not load the credit grants.')).toBeInTheDocument()
    await expect(canvas.queryByText('No credit grants yet')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

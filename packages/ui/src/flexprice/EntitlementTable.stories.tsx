import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { type Entitlement, EntitlementEntityType, FeatureType, UsageResetPeriod } from '@fp/domain'
import { EntitlementTable } from './EntitlementTable'

/**
 * A plan's entitlements, as a read table. The "Value" column reads per feature
 * type — a metered allowance as a number or "Unlimited", a boolean as Yes/No, a
 * static value as itself, a config one as "Configured". No network.
 */
const meta = {
  title: 'Surfaces/EntitlementTable',
  component: EntitlementTable,
  parameters: { layout: 'padded' },
  args: { entitlements: [] },
} satisfies Meta<typeof EntitlementTable>

export default meta
type Story = StoryObj<typeof meta>

function base(id: string, featureId: string, featureName: string) {
  return {
    id,
    featureId,
    featureName,
    entityType: EntitlementEntityType.Plan,
    entityId: 'plan_01',
    usageLimit: null,
    usageResetPeriod: null,
    isSoftLimit: false,
    staticValue: null,
    isEnabled: null,
    configValue: null,
    createdAt: new Date('2026-01-10T00:00:00Z'),
  }
}

const entitlementFixtures: Entitlement[] = [
  {
    ...base('ent_01', 'feat_api', 'API calls'),
    featureType: FeatureType.Metered,
    usageLimit: 50_000,
    usageResetPeriod: UsageResetPeriod.Monthly,
  },
  {
    ...base('ent_02', 'feat_storage', 'Storage'),
    featureType: FeatureType.Metered,
    usageLimit: null,
    usageResetPeriod: UsageResetPeriod.Never,
  },
  {
    ...base('ent_03', 'feat_sso', 'Single sign-on'),
    featureType: FeatureType.Boolean,
    isEnabled: true,
  },
  {
    ...base('ent_04', 'feat_seats', 'Seats'),
    featureType: FeatureType.Static,
    staticValue: '25',
  },
  {
    ...base('ent_05', 'feat_retention', 'Retention window'),
    featureType: FeatureType.Config,
    configValue: { days: 90 },
  },
]

/** The read-only table the Entitlements tab shows. */
export const Default: Story = {
  args: { entitlements: entitlementFixtures },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('API calls')).toBeInTheDocument()
    await expect(canvas.getByText('Unlimited')).toBeInTheDocument()
    await expect(canvas.getByText('Yes')).toBeInTheDocument()
    await expect(canvas.getByText('Configured')).toBeInTheDocument()
  },
}

/** With add and delete wired, each row carries a remove action. */
export const WithActions: Story = {
  args: { entitlements: entitlementFixtures, onAdd: fn(), onDelete: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /remove api calls/i })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /add entitlement/i })).toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: { entitlements: [], onAdd: fn() },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No entitlements yet')).toBeInTheDocument()
  },
}

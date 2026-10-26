import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { type Entitlement, EntitlementEntityType, FeatureType, UsageResetPeriod } from '@fp/domain'
import { EntitlementTable } from './EntitlementTable'

/**
 * An entitlements section. The "Included" column reads per feature
 * type: a metered allowance as a number or "Unlimited", a boolean as Yes/No, a
 * static value as itself, a config one as "Configured". No network.
 */
const meta = {
  title: 'App/Product catalog/Entitlements/Entitlement table',
  component: EntitlementTable,
  parameters: { layout: 'padded' },
  args: { entitlements: [] },
  argTypes: {
    entitlements: { control: false },
    title: { control: 'text' },
    onAdd: { control: false },
    onEdit: { control: false },
    onDelete: { control: false },
    onOpenFeature: { control: false },
  },
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

function manyEntitlements(count: number): Entitlement[] {
  return Array.from({ length: count }, (_, index) => {
    const source = entitlementFixtures[index % entitlementFixtures.length] as Entitlement
    return {
      ...source,
      id: `ent_gen_${index}`,
      featureId: `${source.featureId}_${index}`,
      featureName: `${source.featureName} ${index + 1}`,
    }
  })
}

/** Drag `rows` from 0 to 60: empty state, a short list, a long one. Toggle the row actions. */
export const Playground: StoryObj<
  ComponentProps<typeof EntitlementTable> & { rows: number; showActions: boolean }
> = {
  args: { rows: 5, showActions: true, title: 'Entitlements' },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    showActions: { control: 'boolean' },
  },
  render: ({ rows, showActions, ...args }) => (
    <EntitlementTable
      {...args}
      entitlements={manyEntitlements(rows)}
      {...(showActions ? { onAdd: fn(), onEdit: fn(), onDelete: fn(), onOpenFeature: fn() } : {})}
    />
  ),
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
}

/** The entitlements section. */
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

/** With add, edit and delete wired, each row carries an actions menu. */
export const WithActions: Story = {
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
  args: { entitlements: entitlementFixtures, onAdd: fn(), onEdit: fn(), onDelete: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /add entitlement/i })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for API calls' }))
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('menuitem', { name: 'Remove' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    await expect(args.onEdit).toHaveBeenCalled()
  },
}

export const Empty: Story = {
  args: { entitlements: [], onAdd: fn() },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No entitlements yet')).toBeInTheDocument()
  },
}

/** Loading is a skeleton, never "No entitlements yet". */
export const Loading: Story = {
  args: { entitlements: [], isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Loading entitlements')).toBeInTheDocument()
    await expect(canvas.queryByText('No entitlements yet')).toBeNull()
  },
}

/** A failed load says so and offers a retry; it never reads as "No entitlements yet". */
export const SubTabError: Story = {
  args: {
    entitlements: [],
    error: 'Could not load the entitlements.',
    errorKind: 'server',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Could not load the entitlements.')).toBeInTheDocument()
    await expect(canvas.queryByText('No entitlements yet')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

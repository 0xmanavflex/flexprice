import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FeatureStatus, FeatureType, type Feature } from '@fp/domain'
import { makeCharges, makeEntitlements } from '../plans/planDetailFixtures'
import { featureFixtures } from './featureFixtures'
import {
  FeatureDetailView,
  type FeatureChargeLink,
  type FeatureEntitlementLink,
  type FeatureTab,
} from './FeatureDetailView'

const PARENTS = ['Starter', 'Growth', 'Scale', 'Enterprise', 'Internal']

interface HarnessProps {
  featureType: FeatureType
  featureStatus: FeatureStatus
  tab: FeatureTab
  chargeCount: number
  entitlementCount: number
  chargesLoading: boolean
  entitlementsLoading: boolean
  chargesError: string
  entitlementsError: string
  canDuplicate: boolean
  canDelete: boolean
  onTabChange: (tab: FeatureTab) => void
  onEditConfiguration: () => void
  onSave: (changes: Record<string, string>) => Promise<unknown>
  onDuplicate: () => void
  onDelete: () => void
}

/** One fixture feature of the requested type, with the status overridden. */
function pickFeature(type: FeatureType, status: FeatureStatus): Feature {
  const base = featureFixtures.find((feature) => feature.type === type) ?? featureFixtures[0]!
  return { ...base, type, status }
}

function chargeLinks(count: number): FeatureChargeLink[] {
  return makeCharges(0, count).map((charge, index) => ({
    charge,
    parentName: PARENTS[index % PARENTS.length]!,
    parentStatus: index % 4 === 3 ? 'archived' : 'published',
  }))
}

function entitlementLinks(count: number): FeatureEntitlementLink[] {
  return makeEntitlements(count, { featureType: FeatureType.Metered }).map(
    (entitlement, index) => ({
      entitlement,
      parentName: PARENTS[index % PARENTS.length]!,
      parentStatus: index % 4 === 3 ? 'archived' : 'published',
    }),
  )
}

/** A controlled wrapper: the tab is local state, seeded and re-seeded from the `tab` control. */
function FeatureDetailHarness({
  featureType,
  featureStatus,
  tab,
  chargeCount,
  entitlementCount,
  chargesError,
  entitlementsError,
  canDuplicate,
  canDelete,
  onTabChange,
  onDuplicate,
  onDelete,
  ...rest
}: HarnessProps) {
  const [current, setCurrent] = useState<FeatureTab>(tab)
  useEffect(() => setCurrent(tab), [tab])

  return (
    <FeatureDetailView
      {...rest}
      feature={pickFeature(featureType, featureStatus)}
      tab={current}
      onTabChange={(next) => {
        setCurrent(next)
        onTabChange(next)
      }}
      {...(canDuplicate ? { onDuplicate } : {})}
      {...(canDelete ? { onDelete } : {})}
      charges={chargeLinks(chargeCount)}
      chargesError={chargesError || null}
      entitlements={entitlementLinks(entitlementCount)}
      entitlementsError={entitlementsError || null}
    />
  )
}

/** A feature's detail page with Overview, Charges, Entitlements and Information tabs. */
const meta = {
  title: 'App/Product catalog/Features/Feature detail view',
  component: FeatureDetailHarness,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      // Base UI's portal focus guards — see AppShell.stories.tsx.
      config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] },
    },
  },
  args: {
    featureType: FeatureType.Metered,
    featureStatus: FeatureStatus.Published,
    tab: 'information',
    chargeCount: 4,
    entitlementCount: 3,
    chargesLoading: false,
    entitlementsLoading: false,
    chargesError: '',
    entitlementsError: '',
    canDuplicate: true,
    canDelete: true,
    onTabChange: fn(),
    onEditConfiguration: fn(),
    onSave: fn(() => Promise.resolve()),
    onDuplicate: fn(),
    onDelete: fn(),
  },
  argTypes: {
    featureType: { control: 'select', options: Object.values(FeatureType) },
    featureStatus: { control: 'inline-radio', options: Object.values(FeatureStatus) },
    tab: {
      control: 'select',
      options: ['overview', 'charges', 'entitlements', 'information'],
    },
    chargeCount: { control: { type: 'number', min: 0, max: 50, step: 1 } },
    entitlementCount: { control: { type: 'number', min: 0, max: 50, step: 1 } },
    chargesLoading: { control: 'boolean' },
    entitlementsLoading: { control: 'boolean' },
    chargesError: { control: 'text' },
    entitlementsError: { control: 'text' },
    canDuplicate: { control: 'boolean' },
    canDelete: { control: 'boolean' },
    onTabChange: { control: false },
    onEditConfiguration: { control: false },
    onSave: { control: false },
    onDuplicate: { control: false },
    onDelete: { control: false },
  },
} satisfies Meta<typeof FeatureDetailHarness>

export default meta
type Story = StoryObj<typeof meta>

/** Every knob: feature type and status, tab, row counts, loading and error. */
export const Playground: Story = {}

export const Information: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'API calls' })).toBeInTheDocument()
    await expect(canvas.getByText('Event and aggregation')).toBeInTheDocument()
  },
}

export const Overview: Story = {
  args: { tab: 'overview' },
}

export const Charges: Story = {
  args: { tab: 'charges', chargeCount: 8 },
}

/** Loading is a skeleton, never "No charges yet". */
export const ChargesLoading: Story = {
  args: { tab: 'charges', chargeCount: 0, chargesLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading charges')).toBeInTheDocument()
    await expect(canvas.queryByText('No charges yet')).toBeNull()
  },
}

export const ChargesEmpty: Story = {
  args: { tab: 'charges', chargeCount: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No charges yet')).toBeInTheDocument()
  },
}

/** A failed load says so; it never reads as "No charges yet". */
export const ChargesError: Story = {
  args: {
    tab: 'charges',
    chargeCount: 0,
    chargesError: 'Could not load the charges for this feature.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText('Could not load the charges for this feature.'),
    ).toBeInTheDocument()
    await expect(canvas.queryByText('No charges yet')).toBeNull()
  },
}

export const Entitlements: Story = {
  args: { tab: 'entitlements', entitlementCount: 8 },
}

export const EntitlementsEmpty: Story = {
  args: { tab: 'entitlements', entitlementCount: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No entitlements yet')).toBeInTheDocument()
  },
}

export const EntitlementsLoading: Story = {
  args: { tab: 'entitlements', entitlementCount: 0, entitlementsLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading entitlements')).toBeInTheDocument()
    await expect(canvas.queryByText('No entitlements yet')).toBeNull()
  },
}

/** A failed entitlements load says so; it never reads as "No entitlements yet". */
export const EntitlementsError: Story = {
  args: {
    tab: 'entitlements',
    entitlementCount: 0,
    entitlementsError: 'Could not load the entitlements for this feature.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText('Could not load the entitlements for this feature.'),
    ).toBeInTheDocument()
    await expect(canvas.queryByText('No entitlements yet')).toBeNull()
  },
}

export const ManyRows: Story = {
  args: { tab: 'charges', chargeCount: 40, entitlementCount: 40 },
}

/** A boolean feature has no Overview or Charges tab, so the page opens on Entitlements. */
export const BooleanFeature: Story = {
  args: { featureType: FeatureType.Boolean, tab: 'overview' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('tab', { name: /Overview/ })).toBeNull()
    await expect(canvas.getByRole('tab', { name: /Entitlements/ })).toBeInTheDocument()
  },
}

export const StaticFeature: Story = {
  args: { featureType: FeatureType.Static, tab: 'information' },
}

export const ConfigFeature: Story = {
  args: { featureType: FeatureType.Config, tab: 'information' },
}

/** An archived feature locks the Feature details card and shows an Archived badge. */
export const Archived: Story = {
  args: { featureStatus: FeatureStatus.Archived, tab: 'information' },
}

/** Clicking a tab moves the page, and the Actions panel logs the change. */
export const SwitchesTabs: Story = {
  args: { tab: 'overview' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Charges/ }))
    await expect(args.onTabChange).toHaveBeenCalledWith('charges')
    await expect(canvas.queryByText('Send a test event')).toBeNull()
  },
}

/** Edit is a More-menu item, not an inline header button. */
export const EditFromMenu: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }))
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('menuitem', {
        name: 'Edit details',
      }),
    )
    await expect(args.onEditConfiguration).toHaveBeenCalled()
  },
}

import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { FeatureStatus, FeatureType, type Feature } from '@fp/domain'
import { AppFailure, LoadingRows, PageBody } from '@ui/compositions'
import {
  FeatureDetailView,
  type FeatureChargeLink,
  type FeatureEntitlementLink,
  type FeatureTab,
} from '@ui/pages/features/FeatureDetailView'
import { featureFixtures } from '@ui/pages/features/featureFixtures'
import { makeCharges, makeEntitlements } from '@ui/pages/plans/planDetailFixtures'
import { PAGE_STORY_PARAMETERS, PageShell } from './shellFixtures'

const PARENTS = ['Starter', 'Growth', 'Scale', 'Enterprise', 'Internal']
const TABS: FeatureTab[] = ['overview', 'charges', 'entitlements', 'information']

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

interface FeatureDetailPageProps {
  /** The tab the page opens on. */
  activeTab: FeatureTab
  featureType: FeatureType
  status: FeatureStatus
  /** Plans and add-ons that price this product. */
  chargeCount: number
  /** Plans and add-ons that grant this product. */
  entitlementCount: number
  /** The product itself is still loading. */
  isLoading: boolean
  /** The product request failed. */
  hasError: boolean
  /** The charges and entitlements reads are still loading. */
  sectionsLoading: boolean
  /** Shows Duplicate and Delete in the header menu. */
  canManage: boolean
}

/** The product route as the console composes it: shell, then the detail view or its load and failure states. */
function FeatureDetailPage({
  activeTab,
  featureType,
  status,
  chargeCount,
  entitlementCount,
  isLoading,
  hasError,
  sectionsLoading,
  canManage,
}: FeatureDetailPageProps) {
  const [tab, setTab] = useState<FeatureTab>(activeTab)
  // The tab strip is the page's own state; the control only re-seeds it.
  useEffect(() => setTab(activeTab), [activeTab])

  const feature = pickFeature(featureType, status)

  return (
    <PageShell activeItemId="features" trail={['Product catalog', 'Products', feature.name]}>
      {isLoading ? (
        <PageBody>
          <div className="pt-4">
            <LoadingRows />
          </div>
        </PageBody>
      ) : hasError ? (
        <PageBody>
          <AppFailure
            title="Flexprice had a problem loading this product"
            detail="The rest of the console still works. Try again, or go back to the list."
            onRetry={fn()}
          />
        </PageBody>
      ) : (
        <FeatureDetailView
          feature={feature}
          tab={tab}
          onTabChange={setTab}
          onBack={fn()}
          onEditConfiguration={fn()}
          onSave={fn(() => Promise.resolve())}
          charges={chargeLinks(chargeCount)}
          chargesLoading={sectionsLoading}
          entitlements={entitlementLinks(entitlementCount)}
          entitlementsLoading={sectionsLoading}
          {...(canManage ? { onDuplicate: fn(), onDelete: fn() } : {})}
        />
      )}
    </PageShell>
  )
}

const meta = {
  title: 'Pages/Catalog/Feature detail',
  component: FeatureDetailPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: {
    activeTab: 'information',
    featureType: FeatureType.Metered,
    status: FeatureStatus.Published,
    chargeCount: 4,
    entitlementCount: 3,
    isLoading: false,
    hasError: false,
    sectionsLoading: false,
    canManage: true,
  },
  argTypes: {
    activeTab: { control: 'select', options: TABS },
    featureType: { control: 'select', options: Object.values(FeatureType) },
    status: { control: 'inline-radio', options: Object.values(FeatureStatus) },
    chargeCount: { control: { type: 'number', min: 0, max: 50, step: 1 } },
    entitlementCount: { control: { type: 'number', min: 0, max: 50, step: 1 } },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
    sectionsLoading: { control: 'boolean' },
    canManage: { control: 'boolean' },
  },
} satisfies Meta<typeof FeatureDetailPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/features/$featureId` with every control live: type, status, tab, row counts, loading and error. */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('heading', { name: 'API calls' }),
    ).toBeInTheDocument()
  },
}

/** `/features/$featureId` on the Overview tab. */
export const Overview: Story = {
  args: { activeTab: 'overview' },
}

/** `/features/$featureId` on the Charges tab, with a long list of plans pricing it. */
export const Charges: Story = {
  args: { activeTab: 'charges', chargeCount: 8 },
}

/** `/features/$featureId` on the Charges tab for a product nothing prices yet. */
export const NoCharges: Story = {
  args: { activeTab: 'charges', chargeCount: 0 },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No charges yet')).toBeInTheDocument()
  },
}

/** `/features/$featureId` while the product is loading. */
export const Loading: Story = {
  args: { isLoading: true },
}

/** `/features/$featureId` when the product request failed. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('alert')).toBeVisible()
  },
}

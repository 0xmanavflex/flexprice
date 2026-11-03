import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { ArchiveIcon, PencilIcon, PuzzleIcon, RefreshCwIcon } from '@ui/icons'
import { EditableCard, MetadataCard } from '@ui/compositions'
import { CatalogStatusBadge, type CatalogStatus } from '../../shared/StatusBadge'
import { Pill } from '../../shared/cells'
import { CatalogDetailFrame } from '../catalog-detail/CatalogDetailFrame'
import { PlanChargesView } from '../plans/PlanChargesView'
import { PlanCreditGrantsView } from '../plans/PlanCreditGrantsView'
import { PlanEntitlementsView } from '../plans/PlanEntitlementsView'
import { makeCharges, makeEntitlements, makeGrants, meterUnitOf } from '../plans/planDetailFixtures'
import { AddonSubscriptionsView } from './AddonSubscriptionsView'
import { PAGE_STORY_PARAMETERS, PageShell } from '../../shared/shellFixtures'

type AddonTab = 'overview' | 'information'

const TABS: AddonTab[] = ['overview', 'information']
const DATE = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

interface AddonDetailPageProps {
  /** The tab the page opens on. The strip then keeps its own state. */
  activeTab: AddonTab
  addonName: string
  status: CatalogStatus
  fixedCount: number
  usageCount: number
  entitlementCount: number
  grantCount: number
}

/**
 * The add-on route as the console composes it: shell, catalogue detail frame,
 * then two tabs. Overview stacks the same sections a plan's Overview does.
 */
function AddonDetailPage({
  activeTab,
  addonName,
  status,
  fixedCount,
  usageCount,
  entitlementCount,
  grantCount,
}: AddonDetailPageProps) {
  const [tab, setTab] = useState<AddonTab>(activeTab)
  // The tab strip is the page's own state; the control only re-seeds it.
  useEffect(() => setTab(activeTab), [activeTab])

  const charges = makeCharges(fixedCount, usageCount)
  const entitlements = makeEntitlements(entitlementCount)
  const grants = makeGrants(grantCount)
  const archived = status === 'archived'
  const lookupKey = addonName.toLowerCase().replace(/\W+/g, '_')
  const chargeCount = charges.length

  return (
    <PageShell activeItemId="addons" trail={['Product catalog', 'Add-ons', 'Add-on details']}>
      <CatalogDetailFrame
        listLabel="Add-ons"
        onBack={fn()}
        icon={<PuzzleIcon />}
        title={addonName}
        id="addon_01HZX3"
        badges={
          <>
            <CatalogStatusBadge status={status} />
            <Pill>
              {chargeCount} {chargeCount === 1 ? 'charge' : 'charges'}
            </Pill>
          </>
        }
        menuLabel="Add-on actions"
        menu={[
          {
            id: 'edit-details',
            label: 'Edit details',
            icon: <PencilIcon aria-hidden />,
            onSelect: () => setTab('information'),
          },
          {
            id: 'sync',
            label: 'Sync to contracts',
            icon: <RefreshCwIcon aria-hidden />,
            disabled: archived,
            onSelect: fn(),
          },
          {
            id: 'archive',
            label: 'Archive',
            icon: <ArchiveIcon aria-hidden />,
            destructive: true,
            disabled: archived,
            onSelect: fn(),
          },
        ]}
        tab={tab}
        onTabChange={(next) => setTab(next as AddonTab)}
        tabs={[
          {
            value: 'overview',
            label: 'Overview',
            content: (
              <div className="flex min-w-0 flex-col gap-5">
                <PlanChargesView
                  charges={charges}
                  readOnly={archived}
                  meterUnit={meterUnitOf}
                  emptyDescription="This add-on bills nothing until it has a charge."
                  onAdd={fn()}
                  onEdit={fn()}
                  onTerminate={fn()}
                />
                <PlanEntitlementsView
                  noun="add-on"
                  entitlements={entitlements}
                  usagePrice={() => null}
                  onAdd={fn()}
                  onEdit={fn()}
                  onDelete={fn()}
                  onOpenFeature={fn()}
                />
                <PlanCreditGrantsView grants={grants} onAdd={fn()} onEdit={fn()} onDelete={fn()} />
                <AddonSubscriptionsView />
              </div>
            ),
          },
          {
            value: 'information',
            label: 'Information',
            content: (
              <div className="grid items-start gap-5 xl:grid-cols-3">
                <EditableCard
                  className="xl:col-span-2"
                  title="Add-on details"
                  locked={archived}
                  fields={[
                    { key: 'name', label: 'Name', value: addonName, required: true },
                    {
                      key: 'lookupKey',
                      label: 'Lookup key',
                      value: lookupKey,
                      display: <span className="font-mono text-[13px]">{lookupKey}</span>,
                      readOnly: true,
                    },
                    {
                      key: 'created',
                      label: 'Created',
                      value: DATE.format(new Date('2026-01-10T00:00:00Z')),
                      readOnly: true,
                    },
                    {
                      key: 'updated',
                      label: 'Updated',
                      value: DATE.format(new Date('2026-03-02T00:00:00Z')),
                      readOnly: true,
                    },
                    {
                      key: 'description',
                      label: 'Description',
                      value: 'Faster response times and a named contact.',
                      multiline: true,
                    },
                  ]}
                  onSave={fn()}
                />
                <MetadataCard metadata={{ tier: 'gold' }} {...(archived ? {} : { onSave: fn() })} />
              </div>
            ),
          },
        ]}
      />
    </PageShell>
  )
}

const meta = {
  title: 'App/Product catalog/Add-ons/Add-on detail',
  component: AddonDetailPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: {
    activeTab: 'overview',
    addonName: 'Priority support',
    status: 'published',
    fixedCount: 1,
    usageCount: 2,
    entitlementCount: 3,
    grantCount: 1,
  },
  argTypes: {
    activeTab: { control: 'inline-radio', options: TABS },
    addonName: { control: 'text' },
    status: { control: 'inline-radio', options: ['published', 'archived'] },
    fixedCount: { control: { type: 'range', min: 0, max: 6, step: 1 } },
    usageCount: { control: { type: 'range', min: 0, max: 6, step: 1 } },
    entitlementCount: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    grantCount: { control: { type: 'range', min: 0, max: 6, step: 1 } },
  },
} satisfies Meta<typeof AddonDetailPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/addons/$addonId` with every control live: switch tab, archive it, resize each list. */
export const Playground: Story = {}

/**
 * Two tabs, and every catalogue table on Overview: the same shape as a plan.
 *
 * Charges, entitlements and credit grants were a tab each. These assertions
 * are what stops them being split up again.
 */
export const OverviewHoldsEveryTable: Story = {
  args: { activeTab: 'overview' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tabs = canvas.getAllByRole('tab').map((tab) => tab.textContent?.trim())
    await expect(tabs).toEqual(['Overview', 'Information'])

    await expect(await canvas.findByRole('region', { name: 'Charges table' })).toBeVisible()
    await expect(canvas.getByRole('region', { name: 'Entitlements table' })).toBeVisible()
    await expect(canvas.getByRole('region', { name: 'Credit grants table' })).toBeVisible()
    await expect(
      canvas.getByText('Contracts using this add-on are not available yet'),
    ).toBeVisible()
  },
}

/** `/addons/$addonId` on the Information tab, with the editable details card. */
export const Information: Story = {
  args: { activeTab: 'information' },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('button', { name: 'Edit add-on details' }),
    ).toBeVisible()
  },
}

/** `/addons/$addonId` for an archived add-on: charges and details are locked. */
export const Archived: Story = {
  args: { status: 'archived' },
}

/** `/addons/$addonId` for an add-on with no charges, entitlements or grants yet. */
export const Blank: Story = {
  args: { fixedCount: 0, usageCount: 0, entitlementCount: 0, grantCount: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No entitlements yet')).toBeVisible()
    await expect(canvas.getByText('Add the features this add-on includes.')).toBeVisible()
    await expect(canvas.getByText('No credit grants yet')).toBeVisible()
  },
}

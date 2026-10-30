import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { LayersIcon, PencilIcon, RefreshCwIcon } from '@ui/icons'
import { PLAN_STATUS_LABEL, PlanStatus } from '@fp/domain'
import {
  AppFailure,
  DetailHeader,
  DetailMoreMenu,
  DetailTabs,
  EditableCard,
  LoadingRows,
  Properties,
  Section,
} from '@ui/compositions'
import { Status, Tag } from '@ui/pages'
import { PlanCustomerPreview } from '@ui/pages/product-catalog/plans/PlanCustomerPreview'
import { PlanChargesView } from '@ui/pages/product-catalog/plans/PlanChargesView'
import { PlanCreditGrantsView } from '@ui/pages/product-catalog/plans/PlanCreditGrantsView'
import { PlanEntitlementsView } from '@ui/pages/product-catalog/plans/PlanEntitlementsView'
import {
  makeCharges,
  makeEntitlements,
  makeGrants,
  meterUnitOf,
} from '@ui/pages/product-catalog/plans/planDetailFixtures'
import { PAGE_STORY_PARAMETERS, PageShell } from '../../shared/shellFixtures'

type PlanTab = 'overview' | 'information'

const TABS: PlanTab[] = ['overview', 'information']
const CREATED = new Date('2026-01-10T00:00:00Z')
const UPDATED = new Date('2026-03-02T00:00:00Z')
const DATE = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

interface PlanDetailPageProps {
  /** The tab the page opens on. The strip then keeps its own state. */
  activeTab: PlanTab
  planName: string
  status: PlanStatus
  fixedCount: number
  usageCount: number
  entitlementCount: number
  grantCount: number
  isLoading: boolean
  hasError: boolean
}

function kindOf(fixed: number, usage: number): string {
  if (fixed + usage === 0) return 'No charges yet'
  if (fixed > 0 && usage > 0) return 'Hybrid plan'
  return usage > 0 ? 'Usage-based plan' : 'Flat-rate plan'
}

/** The plan route as the console composes it: shell, header, tab strip, then the tab's surface. */
function PlanDetailPage({
  activeTab,
  planName,
  status,
  fixedCount,
  usageCount,
  entitlementCount,
  grantCount,
  isLoading,
  hasError,
}: PlanDetailPageProps) {
  const [tab, setTab] = useState<PlanTab>(activeTab)
  // The tab strip is the page's own state; the control only re-seeds it.
  useEffect(() => setTab(activeTab), [activeTab])

  const charges = makeCharges(fixedCount, usageCount)
  const entitlements = makeEntitlements(entitlementCount)
  const grants = makeGrants(grantCount)
  const archived = status === PlanStatus.Archived
  const lookupKey = planName.toLowerCase().replace(/\W+/g, '_')

  let body
  if (isLoading) {
    body = (
      <div className="px-10 pt-8 pb-16 2xl:px-14">
        <LoadingRows />
      </div>
    )
  } else if (hasError) {
    body = (
      <AppFailure
        title="This plan could not be loaded"
        detail="It may have been archived, or the link may be out of date."
        onRetry={fn()}
      />
    )
  } else {
    body = (
      <div className="flex flex-col gap-6 px-10 pt-8 pb-16 2xl:px-14">
        <DetailHeader
          icon={<LayersIcon />}
          title={planName}
          id={lookupKey}
          badges={
            <>
              <Tag>{kindOf(fixedCount, usageCount)}</Tag>
              {fixedCount > 0 ? <Tag>Billed monthly</Tag> : null}
              {archived ? <Status value={PLAN_STATUS_LABEL[status]} /> : null}
            </>
          }
          actions={
            <DetailMoreMenu
              label="Plan actions"
              items={[
                {
                  id: 'edit',
                  label: 'Edit details',
                  icon: <PencilIcon aria-hidden />,
                  onSelect: fn(),
                },
                {
                  id: 'sync',
                  label: 'Sync to contracts',
                  icon: <RefreshCwIcon aria-hidden />,
                  disabled: archived,
                  onSelect: fn(),
                },
              ]}
            />
          }
        />

        <DetailTabs
          value={tab}
          onChange={(next) => setTab(next as PlanTab)}
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'information', label: 'Information' },
          ]}
        />

        {tab === 'overview' ? (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-5">
              <PlanChargesView
                charges={charges}
                readOnly={archived}
                meterUnit={meterUnitOf}
                onAdd={fn()}
                onEdit={fn()}
                onTerminate={fn()}
              />
              <PlanEntitlementsView
                entitlements={entitlements}
                usagePrice={() => null}
                onAdd={fn()}
                onEdit={fn()}
                onDelete={fn()}
                onOpenFeature={fn()}
              />
              <PlanCreditGrantsView grants={grants} onAdd={fn()} onEdit={fn()} onDelete={fn()} />
            </div>
            {/* What a customer would be shown, beside what is being edited. */}
            <PlanCustomerPreview
              className="lg:sticky lg:top-6"
              plan={{ id: 'plan_story', name: planName, description: '' }}
              charges={charges}
              entitlements={entitlements}
              grants={grants}
            />
          </div>
        ) : null}

        {tab === 'information' ? (
          <div className="grid gap-5 xl:grid-cols-3">
            <EditableCard
              className="xl:col-span-2"
              title="Plan details"
              locked={archived}
              fields={[
                { key: 'name', label: 'Name', value: planName, required: true },
                {
                  key: 'lookupKey',
                  label: 'Lookup key',
                  value: lookupKey,
                  display: <span className="font-mono text-[13px]">{lookupKey}</span>,
                },
                {
                  key: 'status',
                  label: 'Status',
                  value: PLAN_STATUS_LABEL[status],
                  readOnly: true,
                },
                { key: 'created', label: 'Created', value: DATE.format(CREATED), readOnly: true },
                { key: 'updated', label: 'Updated', value: DATE.format(UPDATED), readOnly: true },
                {
                  key: 'description',
                  label: 'Description',
                  value: 'Everything a growing team needs, billed monthly.',
                  multiline: true,
                },
              ]}
              onSave={fn()}
            />
            <div className="flex flex-col gap-5">
              <Section title="Metadata">
                <Properties
                  columns={2}
                  items={[
                    {
                      label: 'Plan ID',
                      value: <span className="font-mono text-[13px]">plan_02</span>,
                    },
                  ]}
                />
              </Section>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <PageShell activeItemId="plans" trail={['Product catalog', 'Plans', 'Plan details']}>
      {body}
    </PageShell>
  )
}

const meta = {
  title: 'App/Product catalog/Plans/Plan detail',
  component: PlanDetailPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: {
    activeTab: 'overview',
    planName: 'Growth',
    status: PlanStatus.Published,
    fixedCount: 2,
    usageCount: 2,
    entitlementCount: 5,
    grantCount: 2,
    isLoading: false,
    hasError: false,
  },
  argTypes: {
    activeTab: { control: 'inline-radio', options: TABS },
    planName: { control: 'text' },
    status: { control: 'inline-radio', options: Object.values(PlanStatus) },
    fixedCount: { control: { type: 'range', min: 0, max: 6, step: 1 } },
    usageCount: { control: { type: 'range', min: 0, max: 6, step: 1 } },
    entitlementCount: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    grantCount: { control: { type: 'range', min: 0, max: 6, step: 1 } },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
} satisfies Meta<typeof PlanDetailPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/plans/$planId` with every control live: switch tab, archive the plan, resize each list. */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('region', { name: 'Charges table' }),
    ).toBeVisible()
  },
}

/**
 * All three tables on Overview, which is the whole point of two tabs.
 *
 * Charges, entitlements and credit grants each had a tab holding one table,
 * so "what is in this plan?" cost three clicks and a memory. These
 * assertions are what stops them being split up again.
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
    // And the customer's-eye rail beside them.
    await expect(canvas.getByRole('complementary', { name: 'Plan preview' })).toBeVisible()
  },
}

/** `/plans/$planId` on the Information tab, with the editable details card. */
export const Information: Story = {
  args: { activeTab: 'information' },
}

/** `/plans/$planId` for an archived plan, where editing and syncing are locked. */
export const Archived: Story = {
  args: { status: PlanStatus.Archived },
}

/** `/plans/$planId` for a plan with no charges, entitlements or grants yet. */
export const Blank: Story = {
  args: { fixedCount: 0, usageCount: 0, entitlementCount: 0, grantCount: 0 },
}

/** `/plans/$planId` while the plan is loading. */
export const Loading: Story = {
  args: { isLoading: true },
}

/** `/plans/$planId` when the plan could not be loaded. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('This plan could not be loaded'),
    ).toBeInTheDocument()
  },
}

/**
 * The preview is a pricing card, and its titles go to the tables.
 *
 * It was a left-ruled rail, matching the earlier prototype; the handoff asks
 * for "a live pricing card … its section titles jump to the matching table".
 * The jump is the reason the card can stay short: a block summarises a table
 * and takes you to it rather than repeating it.
 */
export const PreviewIsACardThatJumps: Story = {
  args: { activeTab: 'overview' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const preview = await canvas.findByRole('complementary', { name: 'Plan preview' })

    // The ids come from each table's own Section heading.
    await expect(within(preview).getByRole('link', { name: 'Usage' })).toHaveAttribute(
      'href',
      '#section-charges',
    )
    await expect(within(preview).getByRole('link', { name: 'Included' })).toHaveAttribute(
      'href',
      '#section-entitlements',
    )
    // And the targets exist, so the links are not dead.
    await expect(canvas.getByRole('region', { name: 'Charges table' })).toBeVisible()
  },
}

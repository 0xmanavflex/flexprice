import { useState } from 'react'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { toast } from 'sonner'
import {
  type AggregationType,
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BillingModel,
  type BillingPeriod,
  type Charge,
  type Entitlement,
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  FeatureType,
  InvoiceCadence,
  needsAggregationTarget,
  TierMode,
  USAGE_RESET_PERIOD_LABEL,
  type Feature,
} from '@fp/domain'
import { ArchiveIcon, ChevronRightIcon, CopyIcon, PencilIcon, PlusIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { DetailHeader } from '../../../compositions/detail/DetailHeader'
import { EditableCard } from '../../../compositions/forms/EditableCard'
import { LoadingRows } from '../../../compositions'
import { MetadataCard } from '../../../compositions/detail/MetadataCard'
import { Section } from '../../../compositions/layout/Section'
import {
  DetailMoreMenu,
  DetailTabs,
  Properties,
  type DetailMenuItem,
} from '../../../compositions/detail/DetailKit'
import { MetricChart, type MetricPoint } from '../../shared/charts'
import { FEATURE_TYPE_GLYPH, FeatureTypePill, Pill, Status } from '../../shared/cells'
import { DetailTable } from '../../shared/DetailTable'

export type FeatureTab = 'overview' | 'charges' | 'entitlements' | 'information'

/** A charge that prices this feature, and the plan or add-on it belongs to. */
export interface FeatureChargeLink {
  charge: Charge
  parentName: string
  parentStatus: string
}

/** An entitlement that grants this feature, and the plan or add-on it belongs to. */
export interface FeatureEntitlementLink {
  entitlement: Entitlement
  parentName: string
  parentStatus: string
}

export interface FeatureDetailViewProps {
  feature: Feature
  tab: FeatureTab
  onTabChange: (tab: FeatureTab) => void
  onBack?: () => void
  /** The stepped configuration flow. */
  onEditConfiguration: () => void
  /** Real save of name/description; rejects to show an inline error. */
  onSave: (changes: Record<string, string>) => Promise<unknown>
  /** Header menu: Duplicate. Omitted, the item is not shown. */
  onDuplicate?: () => void
  /** Header menu: delete the feature. Omitted, the item is not shown. */
  onDelete?: () => void
  /** Plans and add-ons that price this feature. */
  charges?: FeatureChargeLink[]
  chargesLoading?: boolean
  chargesError?: string | null
  /** Plans and add-ons that grant this feature. */
  entitlements?: FeatureEntitlementLink[]
  entitlementsLoading?: boolean
  entitlementsError?: string | null
  /** Charges tab CTA: price this feature on a plan. Omitted, no button is shown. */
  onAddPlan?: () => void
  /** Entitlements tab CTA: grant this feature on a plan. Omitted, no button is shown. */
  onAddEntitlement?: () => void
  /** Saves the whole metadata map. Omitted, the Metadata section is read-only. */
  onSaveMetadata?: (metadata: Record<string, string>) => Promise<unknown>
}

/** Thirty days of plausible-looking usage. Demo only: no usage read exists for a feature yet. */
export function demoUsagePoints(): MetricPoint[] {
  return Array.from({ length: 30 }, (_, index) => ({
    label: `Day ${index + 1}`,
    value: Math.round(3200 + index * 90 + Math.sin(index / 2.2) * 900 + ((index * 37) % 7) * 120),
  }))
}

/**
 * The aggregation, named for what it is and nothing more: "Sum", not "Sum of
 * a field" or `SUM(tokens)`. The field and the unit are shown beside it as
 * their own values, so the label does not need to restate them.
 */
const AGGREGATION_TYPE_NAME: Record<AggregationType, string> = {
  COUNT: 'Count',
  COUNT_UNIQUE: 'Count unique',
  SUM: 'Sum',
  SUM_WITH_MULTIPLIER: 'Sum with multiplier',
  AVG: 'Average',
  MAX: 'Max',
  LATEST: 'Latest',
  WEIGHTED_SUM: 'Weighted sum',
}

/** Builds the ingest cURL from the feature's event name and aggregation. */
export function buildIngestCurl(feature: Feature): string {
  const eventName = feature.eventName || 'your_event_name'
  const needsField =
    feature.aggregationType != null && needsAggregationTarget(feature.aggregationType)
  const properties = needsField ? '{ "your_property": "<value>" }' : '{}'
  return [
    `curl --request POST \\`,
    `  --url https://api.cloud.flexprice.io/v1/events \\`,
    `  --header 'Content-Type: application/json' \\`,
    `  --header 'x-api-key: <your_api_key>' \\`,
    `  --data '{`,
    `    "event_name": "${eventName}",`,
    `    "external_customer_id": "<your_customer_id>",`,
    `    "properties": ${properties},`,
    `    "source": "api"`,
    `  }'`,
  ].join('\n')
}

function formatDate(value: Date | null): string {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value) : '—'
}

const mono = (value: string | null | undefined) =>
  value ? <span className="font-mono text-[13px]">{value}</span> : '—'

const muted = (value: string) => <span className="text-muted-foreground">{value}</span>

function statusLabel(status: string): string {
  if (status === 'published') return 'Published'
  if (status === 'archived') return 'Archived'
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'
}

/** "Flat fee", "Volume tiered", "Slab tiered", "Package". */
function modelLabel(charge: Charge): string {
  if (charge.billingModel === BillingModel.Tiered) {
    return charge.tierMode === TierMode.Slab ? 'Slab tiered' : 'Volume tiered'
  }
  return BILLING_MODEL_LABEL[charge.billingModel]
}

/** "Monthly, in arrears". */
function billedLabel(charge: Charge): string {
  const period = BILLING_PERIOD_LABEL[charge.billingPeriod as BillingPeriod] ?? charge.billingPeriod
  return `${period}, ${charge.invoiceCadence === InvoiceCadence.Advance ? 'in advance' : 'in arrears'}`
}

function priceLabel(charge: Charge): string {
  const display = charge.displayAmount || charge.amount
  switch (charge.billingModel) {
    case BillingModel.FlatFee:
      return display || '—'
    case BillingModel.Package:
      return `${display || '0'} per ${charge.transformQuantity?.divideBy?.toLocaleString() ?? '?'}`
    case BillingModel.Tiered: {
      const count = charge.tiers.length
      const first = charge.tiers[0]?.unitAmount
      const from = first ? `, from ${first}` : ''
      return `${count} tier${count === 1 ? '' : 's'}${from}`
    }
  }
}

function allowanceOf(entitlement: Entitlement): string {
  if (entitlement.featureType === FeatureType.Metered) {
    return entitlement.usageLimit == null ? 'Unlimited' : entitlement.usageLimit.toLocaleString()
  }
  if (entitlement.featureType === FeatureType.Boolean) return entitlement.isEnabled ? 'Yes' : 'No'
  if (entitlement.featureType === FeatureType.Static) return entitlement.staticValue ?? '—'
  return 'Configured'
}

function resetsOf(entitlement: Entitlement): string {
  return entitlement.usageResetPeriod ? USAGE_RESET_PERIOD_LABEL[entitlement.usageResetPeriod] : '—'
}

export function FeatureDetailView({
  feature,
  tab,
  onTabChange,
  onEditConfiguration,
  onSave,
  onDuplicate,
  onDelete,
  charges = [],
  chargesLoading = false,
  chargesError = null,
  entitlements = [],
  entitlementsLoading = false,
  entitlementsError = null,
  onAddPlan,
  onAddEntitlement,
  onSaveMetadata,
}: FeatureDetailViewProps) {
  const isMetered = feature.type === FeatureType.Metered
  const Glyph = FEATURE_TYPE_GLYPH[feature.type]
  const archived = feature.status === 'archived'
  // Overview and Charges only exist for metered features; the rest start on Entitlements.
  const active: FeatureTab =
    !isMetered && (tab === 'overview' || tab === 'charges') ? 'entitlements' : tab

  const tabs = [
    ...(isMetered
      ? [
          { value: 'overview', label: 'Overview' },
          {
            value: 'charges',
            label: 'Charges',
            ...(chargesLoading ? {} : { count: charges.length }),
          },
        ]
      : []),
    {
      value: 'entitlements',
      label: 'Entitlements',
      ...(entitlementsLoading ? {} : { count: entitlements.length }),
    },
    { value: 'information', label: 'Information' },
  ]

  const menu: DetailMenuItem[] = [
    {
      id: 'edit',
      label: 'Edit details',
      icon: <PencilIcon className="text-muted-foreground" aria-hidden />,
      onSelect: onEditConfiguration,
    },
    ...(onDuplicate
      ? [
          {
            id: 'duplicate',
            label: 'Duplicate',
            icon: <CopyIcon className="text-muted-foreground" aria-hidden />,
            onSelect: onDuplicate,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            id: 'archive',
            label: 'Archive',
            icon: <ArchiveIcon aria-hidden />,
            destructive: true,
            onSelect: onDelete,
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-6 px-10 pt-8 pb-16 2xl:px-14">
      <DetailHeader
        icon={<Glyph />}
        title={feature.name}
        id={feature.lookupKey || feature.id}
        badges={
          <>
            <Status value={FEATURE_STATUS_LABEL[feature.status]} />
            <FeatureTypePill type={feature.type} label={FEATURE_TYPE_LABEL[feature.type]} />
          </>
        }
        actions={<DetailMoreMenu label="More actions" items={menu} />}
      />

      <DetailTabs tabs={tabs} value={active} onChange={(next) => onTabChange(next as FeatureTab)} />

      {active === 'overview' ? (
        <OverviewTab
          feature={feature}
          charges={charges}
          chargesLoading={chargesLoading}
          onSeeCharges={() => onTabChange('charges')}
        />
      ) : null}

      {active === 'charges' ? (
        <ChargesTab
          rows={charges}
          isLoading={chargesLoading}
          error={chargesError}
          {...(onAddPlan ? { onAdd: onAddPlan } : {})}
        />
      ) : null}

      {active === 'entitlements' ? (
        <EntitlementsTab
          rows={entitlements}
          isLoading={entitlementsLoading}
          error={entitlementsError}
          {...(onAddEntitlement ? { onAdd: onAddEntitlement } : {})}
        />
      ) : null}

      {active === 'information' ? (
        <InformationTab
          feature={feature}
          isMetered={isMetered}
          archived={archived}
          onSave={onSave}
          {...(onSaveMetadata ? { onSaveMetadata } : {})}
        />
      ) : null}
    </div>
  )
}

/** A tab's create button: the same small outline button in the empty state and the toolbar. */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <PlusIcon aria-hidden />
      {label}
    </Button>
  )
}

function ChargesTab({
  rows,
  isLoading,
  error,
  onAdd,
}: {
  rows: FeatureChargeLink[]
  isLoading: boolean
  error: string | null
  onAdd?: () => void
}) {
  const add = onAdd ? <AddButton label="Add plan" onClick={onAdd} /> : undefined
  if (error) return <p className="text-destructive p-6 text-sm">{error}</p>
  if (isLoading) {
    return (
      <Section title="Charges" flush>
        <div className="p-4">
          <LoadingRows />
        </div>
      </Section>
    )
  }
  if (rows.length === 0) {
    return (
      <Section title="Charges" flush>
        <SectionEmpty
          title="No charges yet"
          description="No plan or add-on prices this feature yet."
          action={add}
        />
      </Section>
    )
  }
  return (
    <Section table title="Charges">
      <DetailTable
        compact
        label="Charges"
        noun="charges"
        action={add}
        rows={rows}
        getRowId={(row) => row.charge.id}
        facets={[
          { id: 'model', label: 'Billing model', value: (row) => modelLabel(row.charge) },
          { id: 'status', label: 'Plan status', value: (row) => statusLabel(row.parentStatus) },
        ]}
        searchText={(row) =>
          [
            row.parentName,
            modelLabel(row.charge),
            billedLabel(row.charge),
            priceLabel(row.charge),
            statusLabel(row.parentStatus),
          ].join(' ')
        }
        columns={[
          {
            key: 'plan',
            header: 'Plan / add-on',
            width: 200,
            sortBy: (row) => row.parentName,
            text: (row) => row.parentName,
            cell: (row) => <span className="font-medium">{row.parentName}</span>,
          },
          {
            key: 'model',
            header: 'Billing model',
            width: 130,
            sortBy: (row) => modelLabel(row.charge),
            text: (row) => modelLabel(row.charge),
            cell: (row) => muted(modelLabel(row.charge)),
          },
          {
            key: 'billed',
            header: 'Billed',
            width: 150,
            sortBy: (row) => billedLabel(row.charge),
            text: (row) => billedLabel(row.charge),
            cell: (row) => muted(billedLabel(row.charge)),
          },
          {
            key: 'price',
            header: 'Price',
            width: 130,
            sortBy: (row) => Number(row.charge.amount) || 0,
            text: (row) => priceLabel(row.charge),
            cell: (row) => <span className="tabular-nums">{priceLabel(row.charge)}</span>,
          },
          {
            key: 'status',
            header: 'Plan status',
            width: 110,
            sortBy: (row) => statusLabel(row.parentStatus),
            text: (row) => statusLabel(row.parentStatus),
            cell: (row) => <Status value={statusLabel(row.parentStatus)} />,
          },
        ]}
      />
    </Section>
  )
}

function EntitlementsTab({
  rows,
  isLoading,
  error,
  onAdd,
}: {
  rows: FeatureEntitlementLink[]
  isLoading: boolean
  error: string | null
  onAdd?: () => void
}) {
  const add = onAdd ? <AddButton label="Add entitlement" onClick={onAdd} /> : undefined
  if (error) return <p className="text-destructive p-6 text-sm">{error}</p>
  if (isLoading) {
    return (
      <Section title="Entitlements" flush>
        <div className="p-4">
          <LoadingRows />
        </div>
      </Section>
    )
  }
  if (rows.length === 0) {
    return (
      <Section title="Entitlements" flush>
        <SectionEmpty
          title="No entitlements yet"
          description="No plan includes this feature yet."
          action={add}
        />
      </Section>
    )
  }
  return (
    <Section table title="Entitlements">
      <DetailTable
        compact
        label="Entitlements"
        noun="entitlements"
        action={add}
        rows={rows}
        getRowId={(row) => row.entitlement.id}
        facets={[
          { id: 'status', label: 'Plan status', value: (row) => statusLabel(row.parentStatus) },
        ]}
        searchText={(row) =>
          [
            row.parentName,
            allowanceOf(row.entitlement),
            resetsOf(row.entitlement),
            statusLabel(row.parentStatus),
          ].join(' ')
        }
        columns={[
          {
            key: 'plan',
            header: 'Plan',
            width: 200,
            sortBy: (row) => row.parentName,
            text: (row) => row.parentName,
            cell: (row) => <span className="font-medium">{row.parentName}</span>,
          },
          {
            key: 'allowance',
            header: 'Allowance',
            width: 130,
            sortBy: (row) => allowanceOf(row.entitlement),
            text: (row) => allowanceOf(row.entitlement),
            cell: (row) => <span className="tabular-nums">{allowanceOf(row.entitlement)}</span>,
          },
          {
            key: 'resets',
            header: 'Usage resets',
            width: 130,
            sortBy: (row) => resetsOf(row.entitlement),
            text: (row) => resetsOf(row.entitlement),
            cell: (row) => muted(resetsOf(row.entitlement)),
          },
          {
            key: 'status',
            header: 'Plan status',
            width: 110,
            sortBy: (row) => statusLabel(row.parentStatus),
            text: (row) => statusLabel(row.parentStatus),
            cell: (row) => <Status value={statusLabel(row.parentStatus)} />,
          },
        ]}
      />
    </Section>
  )
}

function OverviewTab({
  feature,
  charges,
  chargesLoading,
  onSeeCharges,
}: {
  feature: Feature
  charges: FeatureChargeLink[]
  chargesLoading: boolean
  onSeeCharges: () => void
}) {
  const [metric, setMetric] = useState('usage')
  const usage = demoUsagePoints()
  const total = usage.reduce((sum, point) => sum + point.value, 0)
  const unit = feature.unitPlural || 'units'
  const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  const chartTabs = [
    {
      id: 'usage',
      label: 'Usage, last 30 days',
      value: (
        <>
          {compact.format(total)}
          <span className="text-muted-foreground ms-1.5 text-sm font-normal">{unit}</span>
        </>
      ),
      points: usage,
    },
    {
      id: 'customers',
      label: 'Customers reporting',
      value: '212',
      points: usage.map((point, index) => ({
        ...point,
        value: 150 + Math.round(point.value / 160) + (index % 5),
      })),
    },
    {
      id: 'billed',
      label: 'Billed from this feature',
      value: '$18,420',
      points: usage.map((point) => ({ ...point, value: Math.round(point.value / 6) })),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <MetricChart
        tabs={chartTabs}
        activeTab={metric}
        onTabChange={setMetric}
        caption="Demo data: real usage is not wired yet"
      />
      <div className="grid gap-5 xl:grid-cols-5">
        <Section
          className="xl:col-span-3"
          title="Plans attached"
          flush
          bodyClassName="flex flex-col"
          action={
            <Button variant="outline" size="sm" className="h-8 px-3" onClick={onSeeCharges}>
              All charges
            </Button>
          }
        >
          {/* Rows share the height of the panel so both overview panels line up. */}
          {chargesLoading ? (
            <div className="p-4">
              <LoadingRows />
            </div>
          ) : charges.length === 0 ? (
            <SectionEmpty
              title="No plans attached yet"
              description="No plan prices this feature yet."
            />
          ) : (
            <ul className="divide-border/50 flex flex-1 flex-col divide-y">
              {charges.slice(0, 4).map((row) => (
                <li key={row.charge.id} className="flex min-h-12 flex-1 items-center gap-4 px-6">
                  <span className="flex-1 text-sm">{row.parentName}</span>
                  <span className="text-muted-foreground w-28 text-[13px]">
                    {modelLabel(row.charge)}
                  </span>
                  <span className="w-56 text-[13px] tabular-nums">{priceLabel(row.charge)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <TestEventPanel feature={feature} />
      </div>
    </div>
  )
}

function TestEventPanel({ feature }: { feature: Feature }) {
  const command = buildIngestCurl(feature)
  const copy = () => {
    const done = navigator.clipboard?.writeText(command)
    if (done) void done.then(() => toast.success('cURL copied'))
  }
  return (
    <Section
      className="xl:col-span-2"
      title="Send a test event"
      bodyClassName="flex flex-col"
      action={
        <Button variant="outline" size="sm" className="h-8 px-3" onClick={copy}>
          <CopyIcon aria-hidden />
          Copy cURL
        </Button>
      }
    >
      <pre className="border-border bg-invert text-invert-foreground flex-1 overflow-x-auto rounded-lg border p-4 font-mono text-[12px]/relaxed">
        <code>{command}</code>
      </pre>
    </Section>
  )
}

/**
 * The meter's event filters, one row per event property.
 *
 * Collapsed, a row is the property name and how many values it lets through;
 * expanded, it lists those values. A native `<details>` does the disclosure, so
 * keyboard and screen-reader behaviour come for free.
 */
function EventProperties({ filters }: { filters: { key: string; values: string[] }[] }) {
  if (filters.length === 0) {
    return (
      <p className="text-muted-foreground text-[13px]">No event filters: every event counts.</p>
    )
  }
  return (
    <ul className="divide-border/60 flex flex-col divide-y rounded-lg border">
      {filters.map((filter) => (
        <li key={filter.key}>
          <details className="group">
            <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
              <ChevronRightIcon
                aria-hidden
                className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90"
              />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{filter.key}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {filter.values.length} {filter.values.length === 1 ? 'value' : 'values'}
              </span>
            </summary>
            <div className="flex flex-wrap gap-1.5 px-4 ps-10 pt-1 pb-3">
              {filter.values.map((value) => (
                <span
                  key={value}
                  className="bg-muted/70 text-muted-foreground rounded-md px-2 py-0.5 font-mono text-xs"
                >
                  {value}
                </span>
              ))}
            </div>
          </details>
        </li>
      ))}
    </ul>
  )
}

/** The user-defined unit: "call / calls", or the one name when only one is set. */
function unitLabel(feature: Feature): string {
  const { unitSingular: one, unitPlural: many } = feature
  if (!one && !many) return '—'
  if (!one || !many || one === many) return many || one
  return `${one} / ${many}`
}

function InformationTab({
  feature,
  isMetered,
  archived,
  onSave,
  onSaveMetadata,
}: {
  feature: Feature
  isMetered: boolean
  archived: boolean
  onSave: (changes: Record<string, string>) => Promise<unknown>
  onSaveMetadata?: (metadata: Record<string, string>) => Promise<unknown>
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
        <EditableCard
          title="Feature details"
          locked={archived}
          fields={[
            { key: 'name', label: 'Name', value: feature.name, required: true },
            {
              key: 'lookupKey',
              label: 'Lookup key',
              value: feature.lookupKey,
              display: mono(feature.lookupKey),
              readOnly: true,
            },
            {
              key: 'type',
              label: 'Type',
              value: FEATURE_TYPE_LABEL[feature.type],
              display: (
                <FeatureTypePill type={feature.type} label={FEATURE_TYPE_LABEL[feature.type]} />
              ),
              readOnly: true,
            },
            {
              key: 'created',
              label: 'Created',
              value: formatDate(feature.createdAt),
              readOnly: true,
            },
            {
              key: 'updated',
              label: 'Updated',
              value: formatDate(feature.updatedAt),
              readOnly: true,
            },
            {
              key: 'description',
              label: 'Description',
              value: feature.description,
              placeholder: 'No description',
              multiline: true,
            },
          ]}
          onSave={onSave}
        />

        {isMetered ? (
          <Section title="Event and aggregation">
            <Properties
              items={[
                { label: 'Event name', value: mono(feature.eventName) },
                {
                  label: 'Aggregation',
                  value: feature.aggregationType ? (
                    <Pill size="sm">{AGGREGATION_TYPE_NAME[feature.aggregationType]}</Pill>
                  ) : (
                    '—'
                  ),
                },
                ...(feature.aggregationField
                  ? [{ label: 'Field', value: mono(feature.aggregationField) }]
                  : []),
                { label: 'Unit', value: unitLabel(feature) },
              ]}
            />
            <div className="mt-6 space-y-2 border-t pt-5">
              <p className="text-muted-foreground text-xs">Event properties</p>
              <EventProperties filters={feature.meterFilters ?? []} />
            </div>
          </Section>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        {/* The ids people copy into API calls stay in view above the free-form fields. */}
        <Section title="Identifiers">
          <Properties
            columns={2}
            items={[
              { label: 'Feature ID', value: mono(feature.id) },
              { label: 'Meter ID', value: mono(feature.meterId) },
            ]}
          />
        </Section>
        <MetadataCard
          metadata={feature.metadata ?? {}}
          {...(onSaveMetadata && !archived ? { onSave: onSaveMetadata } : {})}
        />
      </div>
    </div>
  )
}

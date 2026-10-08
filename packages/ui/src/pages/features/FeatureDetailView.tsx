import { useState } from 'react'
import { SectionEmpty } from '@ui/compositions/SectionEmpty'
import { toast } from 'sonner'
import {
  AGGREGATION_LABEL,
  aggregationFormula,
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
import { ArchiveIcon, BellIcon, CopyIcon, MoreHorizontalIcon, PencilIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Switch } from '@ui/components/primitives/switch'
import { DetailHeader } from '../../compositions/DetailHeader'
import { EditableCard } from '../../compositions/EditableCard'
import { LoadingRows } from '../../compositions'
import { Section } from '../../compositions/Section'
import { DetailTabs, Dot, Properties } from '../../compositions/DetailKit'
import { MetricChart, type MetricPoint } from '../shared/charts'
import { FEATURE_TYPE_GLYPH, FeatureTypePill, Formula, Status } from '../shared/cells'
import { DetailTable } from '../shared/DetailTable'

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
}

/** Thirty days of plausible-looking usage. Demo only: no usage read exists for a feature yet. */
export function demoUsagePoints(): MetricPoint[] {
  return Array.from({ length: 30 }, (_, index) => ({
    label: `Day ${index + 1}`,
    value: Math.round(3200 + index * 90 + Math.sin(index / 2.2) * 900 + ((index * 37) % 7) * 120),
  }))
}

const ALERTS = [
  { id: 'critical', label: 'Critical', hint: 'Above 100% of allowance', dot: 'bg-destructive' },
  { id: 'warning', label: 'Warning', hint: 'Above 80% of allowance', dot: 'bg-warning' },
  { id: 'info', label: 'Info', hint: 'Above 50% of allowance', dot: 'bg-info' },
] as const

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
  return entitlement.usageResetPeriod
    ? USAGE_RESET_PERIOD_LABEL[entitlement.usageResetPeriod]
    : '—'
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

  return (
    <div className="flex flex-col gap-6 px-10 pt-8 pb-16 2xl:px-14">
      <DetailHeader
        icon={<Glyph />}
        title={feature.name}
        id={feature.lookupKey || feature.id}
        subtitle={
          <>
            <span>{FEATURE_TYPE_LABEL[feature.type]}</span>
            {archived ? (
              <>
                <Dot />
                <Status value="archived" />
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" className="h-8 px-3" onClick={onEditConfiguration}>
              <PencilIcon aria-hidden />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="More actions"
                  />
                }
              >
                <MoreHorizontalIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => onTabChange('information')}>
                  <BellIcon className="text-muted-foreground" aria-hidden />
                  Usage alerts
                </DropdownMenuItem>
                {onDuplicate ? (
                  <DropdownMenuItem onClick={onDuplicate}>
                    <CopyIcon className="text-muted-foreground" aria-hidden />
                    Duplicate
                  </DropdownMenuItem>
                ) : null}
                {onDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={onDelete}>
                      <ArchiveIcon aria-hidden />
                      Delete feature
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
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
        <ChargesTab rows={charges} isLoading={chargesLoading} error={chargesError} />
      ) : null}

      {active === 'entitlements' ? (
        <EntitlementsTab
          rows={entitlements}
          isLoading={entitlementsLoading}
          error={entitlementsError}
        />
      ) : null}

      {active === 'information' ? (
        <InformationTab
          feature={feature}
          isMetered={isMetered}
          archived={archived}
          onSave={onSave}
        />
      ) : null}
    </div>
  )
}

function ChargesTab({
  rows,
  isLoading,
  error,
}: {
  rows: FeatureChargeLink[]
  isLoading: boolean
  error: string | null
}) {
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
        />
      </Section>
    )
  }
  return (
    <Section title="Charges" flush bare>
      <DetailTable
        label="Charges"
        noun="charges"
        rows={rows}
        getRowId={(row) => row.charge.id}
        facets={[
          { id: 'model', label: 'Billing model', value: (row) => modelLabel(row.charge) },
          { id: 'status', label: 'Plan status', value: (row) => statusLabel(row.parentStatus) },
        ]}
        searchText={(row) =>
          [row.parentName, modelLabel(row.charge), billedLabel(row.charge), priceLabel(row.charge), statusLabel(row.parentStatus)].join(' ')
        }
        columns={[
          {
            key: 'plan',
            header: 'Plan / add-on',
            sortBy: (row) => row.parentName,
            text: (row) => row.parentName,
            cell: (row) => <span className="font-medium">{row.parentName}</span>,
          },
          {
            key: 'model',
            header: 'Billing model',
            sortBy: (row) => modelLabel(row.charge),
            text: (row) => modelLabel(row.charge),
            cell: (row) => muted(modelLabel(row.charge)),
          },
          {
            key: 'billed',
            header: 'Billed',
            sortBy: (row) => billedLabel(row.charge),
            text: (row) => billedLabel(row.charge),
            cell: (row) => muted(billedLabel(row.charge)),
          },
          {
            key: 'price',
            header: 'Price',
            sortBy: (row) => Number(row.charge.amount) || 0,
            text: (row) => priceLabel(row.charge),
            cell: (row) => <span className="tabular-nums">{priceLabel(row.charge)}</span>,
          },
          {
            key: 'status',
            header: 'Plan status',
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
}: {
  rows: FeatureEntitlementLink[]
  isLoading: boolean
  error: string | null
}) {
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
        <SectionEmpty title="No entitlements yet" description="No plan includes this feature yet." />
      </Section>
    )
  }
  return (
    <Section title="Entitlements" flush bare>
      <DetailTable
        label="Entitlements"
        noun="entitlements"
        rows={rows}
        getRowId={(row) => row.entitlement.id}
        facets={[
          { id: 'status', label: 'Plan status', value: (row) => statusLabel(row.parentStatus) },
        ]}
        searchText={(row) =>
          [row.parentName, allowanceOf(row.entitlement), resetsOf(row.entitlement), statusLabel(row.parentStatus)].join(' ')
        }
        columns={[
          {
            key: 'plan',
            header: 'Plan',
            sortBy: (row) => row.parentName,
            text: (row) => row.parentName,
            cell: (row) => <span className="font-medium">{row.parentName}</span>,
          },
          {
            key: 'allowance',
            header: 'Allowance',
            sortBy: (row) => allowanceOf(row.entitlement),
            text: (row) => allowanceOf(row.entitlement),
            cell: (row) => allowanceOf(row.entitlement),
          },
          {
            key: 'resets',
            header: 'Usage resets',
            sortBy: (row) => resetsOf(row.entitlement),
            text: (row) => resetsOf(row.entitlement),
            cell: (row) => muted(resetsOf(row.entitlement)),
          },
          {
            key: 'status',
            header: 'Plan status',
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
            <p className="text-muted-foreground px-6 py-10 text-center text-[13px]">
              No plan prices this feature yet.
            </p>
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

function InformationTab({
  feature,
  isMetered,
  archived,
  onSave,
}: {
  feature: Feature
  isMetered: boolean
  archived: boolean
  onSave: (changes: Record<string, string>) => Promise<unknown>
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    critical: true,
    warning: true,
    info: false,
  })

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
        <EditableCard
          title="General"
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
              key: 'status',
              label: 'Status',
              value: FEATURE_STATUS_LABEL[feature.status],
              display: <Status value={feature.status} />,
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
                    <span className="flex flex-wrap items-center gap-2">
                      <Formula value={aggregationFormula(feature)} />
                      <span className="text-muted-foreground">
                        {AGGREGATION_LABEL[feature.aggregationType]}
                      </span>
                    </span>
                  ) : (
                    '—'
                  ),
                },
                ...(feature.aggregationField
                  ? [{ label: 'Value property', value: mono(feature.aggregationField) }]
                  : []),
                {
                  label: 'Unit',
                  value:
                    feature.unitSingular || feature.unitPlural
                      ? `${feature.unitSingular || '—'} / ${feature.unitPlural || '—'}`
                      : '—',
                },
              ]}
            />
            {feature.meterFilters && feature.meterFilters.length > 0 ? (
              <div className="mt-6 space-y-2 border-t pt-5">
                <p className="text-muted-foreground text-xs">Event filters</p>
                <div className="flex flex-wrap gap-1.5">
                  {feature.meterFilters.flatMap((filter) =>
                    filter.values.map((value) => (
                      <span
                        key={`${filter.key}-${value}`}
                        className="bg-muted/70 text-muted-foreground rounded-md px-2 py-0.5 font-mono text-xs"
                      >
                        {filter.key} = {value}
                      </span>
                    )),
                  )}
                </div>
              </div>
            ) : null}
          </Section>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        {isMetered ? (
          <Section title="Usage alerts" flush>
            <ul className="divide-border/50 divide-y">
              {ALERTS.map((alert) => (
                <li key={alert.id} className="flex items-center gap-3 px-6 py-3.5">
                  <span aria-hidden className={`size-2 rounded-full ${alert.dot}`} />
                  <span className="flex-1">
                    <span className="block text-sm">{alert.label}</span>
                    <span className="text-muted-foreground block text-xs">{alert.hint}</span>
                  </span>
                  <Switch
                    checked={enabled[alert.id] ?? false}
                    onCheckedChange={(next) =>
                      setEnabled((current) => ({ ...current, [alert.id]: next }))
                    }
                    aria-label={`${alert.label} alert`}
                  />
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Metadata">
          <Properties
            columns={2}
            items={[
              { label: 'Feature ID', value: mono(feature.id) },
              { label: 'Meter ID', value: mono(feature.meterId) },
            ]}
          />
        </Section>
      </div>
    </div>
  )
}

import { useState } from 'react'
import {
  AGGREGATION_LABEL,
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  FeatureType,
  needsAggregationTarget,
  type Feature,
} from '@fp/domain'
import { CheckIcon, CopyIcon, MoreHorizontalIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Badge } from '@ui/components/reui/badge'
import { Switch } from '@ui/components/primitives/switch'
import { EditableCard } from '../../compositions/EditableCard'
import { Section } from '../../compositions/Section'
import { DetailTabs, Properties, SimpleTable } from '../../compositions/DetailKit'
import { BlurredEmpty, MetricChart, type MetricPoint } from '../shared/charts'
import { EntityHeader } from '../shared/EntityHeader'
import { FEATURE_TYPE_GLYPH } from '../shared/cells'

export type FeatureTab = 'overview' | 'charges' | 'entitlements' | 'information'

export interface FeatureDetailViewProps {
  feature: Feature
  tab: FeatureTab
  onTabChange: (tab: FeatureTab) => void
  onBack?: () => void
  /** The stepped configuration flow. */
  onEditConfiguration: () => void
  /** Real save of name/description; rejects to show an inline error. */
  onSave: (changes: Record<string, string>) => Promise<unknown>
}

/** Thirty days of plausible-looking usage. Demo only: no usage read exists for a feature yet. */
export function demoUsagePoints(): MetricPoint[] {
  return Array.from({ length: 30 }, (_, index) => ({
    label: `Day ${index + 1}`,
    value: Math.round(3200 + index * 90 + Math.sin(index / 2.2) * 900 + ((index * 37) % 7) * 120),
  }))
}

interface DemoCharge {
  id: string
  plan: string
  model: string
  billed: string
  price: string
  allowance: string
  resets: string
  active: boolean
}

/** Demo only: no read exists yet for the charges and entitlements that reference a feature. */
const DEMO_CHARGES: DemoCharge[] = [
  {
    id: 'starter',
    plan: 'Starter',
    model: 'Volume tiered',
    billed: 'Monthly, in arrears',
    price: '2 tiers, from $0.01 per unit',
    allowance: '1,000 units',
    resets: 'Every billing period',
    active: true,
  },
  {
    id: 'studio',
    plan: 'Studio',
    model: 'Package',
    billed: 'Monthly, in arrears',
    price: '$250 per 1,000 units',
    allowance: '25,000 units',
    resets: 'Every billing period',
    active: true,
  },
  {
    id: 'pro',
    plan: 'Pro',
    model: 'Volume tiered',
    billed: 'Monthly, in arrears',
    price: '3 tiers, from $0.0008 per unit',
    allowance: '1M units',
    resets: 'Every billing period',
    active: true,
  },
  {
    id: 'platform',
    plan: 'Platform',
    model: 'Package',
    billed: 'Monthly, in arrears',
    price: '$2 per 1,000 units',
    allowance: '10K units',
    resets: 'Every billing period',
    active: false,
  },
]

const PlanStatus = ({ active }: { active: boolean }) => (
  <Badge variant="outline">{active ? 'Active' : 'Archived'}</Badge>
)

const ALERTS = [
  { id: 'critical', label: 'Critical', hint: 'Above 100% of allowance', dot: 'bg-destructive' },
  { id: 'warning', label: 'Warning', hint: 'Above 80% of allowance', dot: 'bg-warning' },
  { id: 'info', label: 'Info', hint: 'Above 50% of allowance', dot: 'bg-sky-500' },
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
  value ? <span className="font-mono text-xs">{value}</span> : '—'

export function FeatureDetailView({
  feature,
  tab,
  onTabChange,
  onBack,
  onEditConfiguration,
  onSave,
}: FeatureDetailViewProps) {
  const isMetered = feature.type === FeatureType.Metered
  const Glyph = FEATURE_TYPE_GLYPH[feature.type]
  const archived = feature.status === 'archived'
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EntityHeader
        trail={[
          { label: 'Features', ...(onBack ? { onClick: onBack } : {}) },
          { label: feature.name },
        ]}
        icon={<Glyph className="size-5" />}
        title={feature.name}
        subtitle={FEATURE_TYPE_LABEL[feature.type]}
        id={feature.lookupKey || feature.id}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" aria-label="More actions" />}
              >
                <MoreHorizontalIcon aria-hidden className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={onEditConfiguration}>
                    Edit configuration
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      void navigator.clipboard?.writeText(feature.id)
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 1500)
                    }}
                  >
                    {copied ? 'Copied' : 'Copy feature ID'}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <div className="px-6 pb-10">
        <DetailTabs
          value={tab}
          onValueChange={(next) => onTabChange(next as FeatureTab)}
          tabs={[
            {
              value: 'overview',
              label: 'Overview',
              content: (
                <OverviewTab
                  feature={feature}
                  isMetered={isMetered}
                  onSeeCharges={() => onTabChange('charges')}
                />
              ),
            },
            {
              value: 'charges',
              label: 'Charges',
              count: DEMO_CHARGES.length,
              content: (
                <Section
                  title="Charges"
                  description="Every plan and add-on that bills for this feature. Demo data until the linked-price view is wired."
                  className="gap-0 p-0 [&>header]:p-5"
                >
                  <SimpleTable
                    rows={DEMO_CHARGES}
                    getRowId={(row) => row.id}
                    columns={[
                      {
                        key: 'plan',
                        header: 'Plan / add-on',
                        cell: (row) => row.plan,
                      },
                      { key: 'model', header: 'Billing model', cell: (row) => row.model },
                      { key: 'billed', header: 'Billed', cell: (row) => row.billed },
                      { key: 'price', header: 'Price', cell: (row) => row.price },
                      {
                        key: 'status',
                        header: 'Plan status',
                        cell: (row) => <PlanStatus active={row.active} />,
                      },
                    ]}
                  />
                </Section>
              ),
            },
            {
              value: 'entitlements',
              label: 'Entitlements',
              count: 2,
              content: (
                <Section
                  title="Entitlements"
                  description="What each plan includes before charges apply. Demo data until the entitlement view is wired."
                  className="gap-0 p-0 [&>header]:p-5"
                >
                  <SimpleTable
                    rows={[DEMO_CHARGES[2]!, DEMO_CHARGES[3]!]}
                    getRowId={(row) => row.id}
                    columns={[
                      {
                        key: 'plan',
                        header: 'Plan',
                        cell: (row) => row.plan,
                      },
                      { key: 'allowance', header: 'Allowance', cell: (row) => row.allowance },
                      { key: 'resets', header: 'Usage resets', cell: (row) => row.resets },
                      {
                        key: 'status',
                        header: 'Plan status',
                        cell: (row) => <PlanStatus active={row.active} />,
                      },
                    ]}
                  />
                </Section>
              ),
            },
            {
              value: 'information',
              label: 'Information',
              content: (
                <InformationTab
                  feature={feature}
                  isMetered={isMetered}
                  archived={archived}
                  onSave={onSave}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

function OverviewTab({
  feature,
  isMetered,
  onSeeCharges,
}: {
  feature: Feature
  isMetered: boolean
  onSeeCharges: () => void
}) {
  const [metric, setMetric] = useState('usage')
  const usage = isMetered ? demoUsagePoints() : []
  const total = usage.reduce((sum, point) => sum + point.value, 0)
  const unit = feature.unitPlural || 'units'
  const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  const chartTabs = [
    {
      id: 'usage',
      label: 'Usage, last 30 days',
      value: isMetered ? (
        <>
          {compact.format(total)}
          <span className="text-muted-foreground ms-1.5 text-sm font-normal">{unit}</span>
        </>
      ) : (
        '—'
      ),
      points: usage,
    },
    {
      id: 'customers',
      label: 'Customers reporting',
      value: isMetered ? '212' : '—',
      points: usage.map((point, index) => ({
        ...point,
        value: 150 + Math.round(point.value / 160) + (index % 5),
      })),
    },
    {
      id: 'billed',
      label: 'Billed from this feature',
      value: isMetered ? '$18,420' : '—',
      points: usage.map((point) => ({ ...point, value: Math.round(point.value / 6) })),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {isMetered ? (
        <MetricChart
          tabs={chartTabs}
          activeTab={metric}
          onTabChange={setMetric}
          caption="Demo data: real usage is not wired yet"
        />
      ) : (
        <BlurredEmpty
          title="Nothing to chart"
          description="This feature is not metered, so it records no usage."
        >
          <MetricChart
            tabs={[{ id: 'usage', label: 'Usage', value: '—', points: demoUsagePoints() }]}
            activeTab="usage"
            onTabChange={() => undefined}
          />
        </BlurredEmpty>
      )}

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <Section
          title="Plans attached"
          description="Demo data: the plans-using-a-feature view is not wired yet."
          className="h-full gap-0 p-0 [&>header]:p-5"
          actions={
            <Button variant="outline" onClick={onSeeCharges}>
              All charges
            </Button>
          }
        >
          <SimpleTable
            rows={DEMO_CHARGES.slice(0, 3)}
            getRowId={(row) => row.id}
            columns={[
              {
                key: 'plan',
                header: 'Plan',
                cell: (row) => row.plan,
              },
              {
                key: 'model',
                header: 'Model',
                cell: (row) => <span className="text-muted-foreground">{row.model}</span>,
              },
              { key: 'price', header: 'Price', cell: (row) => row.price },
            ]}
          />
        </Section>

        <TestEventPanel feature={feature} isMetered={isMetered} />
      </div>
    </div>
  )
}

function TestEventPanel({ feature, isMetered }: { feature: Feature; isMetered: boolean }) {
  const [copied, setCopied] = useState(false)
  const command = buildIngestCurl(feature)
  return (
    <Section
      title="Send a test event"
      description={
        isMetered
          ? 'Fill in the placeholders, then run it from your terminal or backend.'
          : 'Boolean features do not ingest events; this shows the shape for a metered one.'
      }
      className="h-full"
      actions={
        <Button
          variant="outline"
          onClick={() => {
            const done = navigator.clipboard?.writeText(command)
            if (done) {
              void done.then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              })
            }
          }}
        >
          {copied ? (
            <CheckIcon aria-hidden className="size-4" />
          ) : (
            <CopyIcon aria-hidden className="size-4" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      }
    >
      <pre className="min-h-40 flex-1 overflow-x-auto rounded-lg bg-neutral-950 p-4 font-mono text-xs leading-relaxed text-neutral-100">
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
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        <EditableCard
          title="General"
          locked={archived}
          fields={[
            { key: 'name', label: 'Name', value: feature.name, required: true },
            { key: 'type', label: 'Type', value: FEATURE_TYPE_LABEL[feature.type], readOnly: true },
            {
              key: 'lookupKey',
              label: 'Lookup key',
              value: feature.lookupKey,
              display: mono(feature.lookupKey),
              readOnly: true,
            },
            {
              key: 'status',
              label: 'Status',
              value: FEATURE_STATUS_LABEL[feature.status],
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

        <Section
          title="Event and aggregation"
          description="What this feature meters, and how usage is measured."
        >
          {isMetered ? (
            <div className="flex flex-col gap-5">
              <Properties
                columns={3}
                items={[
                  { label: 'Event name', value: mono(feature.eventName) },
                  {
                    label: 'Aggregation',
                    value: feature.aggregationType
                      ? AGGREGATION_LABEL[feature.aggregationType]
                      : '—',
                  },
                  ...(feature.aggregationField
                    ? [{ label: 'Aggregated field', value: mono(feature.aggregationField) }]
                    : []),
                  { label: 'Unit (singular)', value: feature.unitSingular || '—' },
                  { label: 'Unit (plural)', value: feature.unitPlural || '—' },
                  { label: 'Meter ID', value: mono(feature.meterId) },
                ]}
              />
              {feature.meterFilters && feature.meterFilters.length > 0 ? (
                <div className="flex flex-col gap-2 border-t pt-4">
                  <span className="text-muted-foreground text-xs">Event filters</span>
                  <div className="flex flex-wrap gap-2">
                    {feature.meterFilters.flatMap((filter) =>
                      filter.values.map((value) => (
                        <code
                          key={`${filter.key}-${value}`}
                          className="bg-muted rounded-md px-2 py-1 font-mono text-xs"
                        >
                          {filter.key} = {value}
                        </code>
                      )),
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              This feature is not metered, so it has no event name or aggregation.
            </p>
          )}
        </Section>
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <Section
          title="Usage alerts"
          description="Demo: alert thresholds are not saved yet. Toggles only change this view."
        >
          <ul className="flex flex-col divide-y">
            {ALERTS.map((alert) => (
              <li key={alert.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span aria-hidden className={`size-2 rounded-full ${alert.dot}`} />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{alert.label}</span>
                    <span className="text-muted-foreground text-xs">{alert.hint}</span>
                  </div>
                </div>
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

        <Section title="Metadata">
          <Properties
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

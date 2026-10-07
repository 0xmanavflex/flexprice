import { useState } from 'react'
import { SectionEmpty } from '@ui/compositions/SectionEmpty'
import { toast } from 'sonner'
import {
  AGGREGATION_LABEL,
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  FeatureType,
  needsAggregationTarget,
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
import { Section } from '../../compositions/Section'
import { DetailTabs, Dot, Properties } from '../../compositions/DetailKit'
import { MetricChart, type MetricPoint } from '../shared/charts'
import { FEATURE_TYPE_GLYPH, Status } from '../shared/cells'
import { DetailTable } from '../shared/DetailTable'

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
  /** Header menu: Duplicate. Omitted, the item is not shown. */
  onDuplicate?: () => void
  /** Header menu: delete the feature. Omitted, the item is not shown. */
  onDelete?: () => void
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

const ENTITLEMENT_ROWS = [DEMO_CHARGES[2]!, DEMO_CHARGES[3]!]

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

export function FeatureDetailView({
  feature,
  tab,
  onTabChange,
  onEditConfiguration,
  onSave,
  onDuplicate,
  onDelete,
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
          { value: 'charges', label: 'Charges', count: DEMO_CHARGES.length },
        ]
      : []),
    { value: 'entitlements', label: 'Entitlements', count: ENTITLEMENT_ROWS.length },
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
        <OverviewTab feature={feature} onSeeCharges={() => onTabChange('charges')} />
      ) : null}

      {active === 'charges' ? (
        <Section title="Charges" flush bare>
          <DetailTable
            label="Charges"
            noun="charges"
            rows={DEMO_CHARGES}
            getRowId={(row) => row.id}
            columns={[
              {
                key: 'plan',
                header: 'Plan / add-on',
                cell: (row) => <span className="font-medium">{row.plan}</span>,
              },
              { key: 'model', header: 'Billing model', cell: (row) => muted(row.model) },
              { key: 'billed', header: 'Billed', cell: (row) => muted(row.billed) },
              {
                key: 'price',
                header: 'Price',
                cell: (row) => <span className="tabular-nums">{row.price}</span>,
              },
              {
                key: 'status',
                header: 'Plan status',
                cell: (row) => <Status value={row.active ? 'active' : 'archived'} />,
              },
            ]}
          />
        </Section>
      ) : null}

      {active === 'entitlements' ? (
        <Section title="Entitlements" flush bare={isMetered}>
          {isMetered ? (
            <DetailTable
              label="Entitlements"
              noun="entitlements"
              rows={ENTITLEMENT_ROWS}
              getRowId={(row) => row.id}
              columns={[
                {
                  key: 'plan',
                  header: 'Plan',
                  cell: (row) => <span className="font-medium">{row.plan}</span>,
                },
                { key: 'allowance', header: 'Allowance', cell: (row) => row.allowance },
                { key: 'resets', header: 'Usage resets', cell: (row) => muted(row.resets) },
                {
                  key: 'status',
                  header: 'Plan status',
                  cell: (row) => <Status value={row.active ? 'active' : 'archived'} />,
                },
              ]}
            />
          ) : (
            <SectionEmpty title="No plans yet" description="No plan includes this feature yet." />
          )}
        </Section>
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

function OverviewTab({ feature, onSeeCharges }: { feature: Feature; onSeeCharges: () => void }) {
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
          <ul className="divide-border/50 flex flex-1 flex-col divide-y">
            {DEMO_CHARGES.slice(0, 4).map((row) => (
              <li key={row.id} className="flex min-h-12 flex-1 items-center gap-4 px-6">
                <span className="flex-1 text-sm">{row.plan}</span>
                <span className="text-muted-foreground w-28 text-[13px]">{row.model}</span>
                <span className="w-56 text-[13px] tabular-nums">{row.price}</span>
              </li>
            ))}
          </ul>
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
    <Section className="xl:col-span-2" title="Send a test event" bodyClassName="flex flex-col">
      <pre className="border-border bg-invert text-invert-foreground flex-1 overflow-x-auto rounded-lg border p-4 font-mono text-[12px]/relaxed">
        <code>{command}</code>
      </pre>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" className="h-8 px-3" onClick={copy}>
          <CopyIcon aria-hidden />
          Copy cURL
        </Button>
      </div>
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
            { key: 'type', label: 'Type', value: FEATURE_TYPE_LABEL[feature.type], readOnly: true },
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
                  value: feature.aggregationType ? AGGREGATION_LABEL[feature.aggregationType] : '—',
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

import { useState } from 'react'
import {
  AGGREGATION_LABEL,
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  FeatureType,
  needsAggregationTarget,
  type Feature,
} from '@fp/domain'
import { CheckIcon, CopyIcon, GaugeIcon, MoreHorizontalIcon, ReceiptIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Switch } from '@ui/components/primitives/switch'
import { EditableFields } from '../../compositions/EditableFields'
import { EmptyState } from '../../compositions/EmptyState'
import { Section } from '../../compositions/Section'
import { DetailTabs, Properties } from '../../compositions/DetailKit'
import { BlurredEmpty, MetricChart, type MetricPoint } from '../shared/charts'
import { EntityHeader } from '../shared/EntityHeader'
import { FEATURE_TYPE_GLYPH } from '../shared/cells'

export type FeatureTab = 'overview' | 'charges' | 'entitlements' | 'information'

export interface FeatureDetailViewProps {
  feature: Feature
  tab: FeatureTab
  onTabChange: (tab: FeatureTab) => void
  onBack?: () => void
  /** Header primary: switches to Information and opens in-place editing. */
  onEdit: () => void
  /** The stepped configuration flow. */
  onEditConfiguration: () => void
  editing: boolean
  onEditingChange: (editing: boolean) => void
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

const DEMO_PLANS = [
  { id: 'starter', name: 'Starter', included: '1,000 included', beyond: '$0.002 / unit beyond' },
  { id: 'growth', name: 'Growth', included: '50,000 included', beyond: '$0.001 / unit beyond' },
  { id: 'scale', name: 'Scale', included: 'Unlimited', beyond: 'No usage price' },
]

const ALERTS = [
  { id: 'critical', label: 'Critical', hint: 'Notify when usage reaches 100% of the entitlement.' },
  { id: 'warning', label: 'Warning', hint: 'Notify when usage reaches 80% of the entitlement.' },
  { id: 'info', label: 'Info', hint: 'Notify when usage reaches 50% of the entitlement.' },
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
  onEdit,
  onEditConfiguration,
  editing,
  onEditingChange,
  onSave,
}: FeatureDetailViewProps) {
  const isMetered = feature.type === FeatureType.Metered
  const Glyph = FEATURE_TYPE_GLYPH[feature.type]
  const archived = feature.status === 'archived'
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex flex-col">
      <EntityHeader
        trail={[{ label: 'Features', ...(onBack ? { onClick: onBack } : {}) }, { label: feature.name }]}
        icon={<Glyph className="size-5" />}
        title={feature.name}
        subtitle={FEATURE_TYPE_LABEL[feature.type]}
        id={feature.lookupKey || feature.id}
        actions={
          <>
            <Button disabled={editing || archived} onClick={onEdit}>
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" aria-label="More actions" />}
              >
                <MoreHorizontalIcon aria-hidden className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={onEditConfiguration}>Edit configuration</DropdownMenuItem>
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
              content: <OverviewTab feature={feature} isMetered={isMetered} />,
            },
            {
              value: 'charges',
              label: 'Charges',
              content: (
                <Section title="Charges" description="Prices across the catalogue that meter this feature.">
                  <EmptyState
                    size="inline"
                    icon={<ReceiptIcon aria-hidden />}
                    title="No linked charges to show yet"
                    description="Plans and add-ons that price this feature will appear here once the linked-price view is wired up."
                  />
                </Section>
              ),
            },
            {
              value: 'entitlements',
              label: 'Entitlements',
              content: (
                <Section title="Entitlements" description="Plans and add-ons that grant this feature.">
                  <EmptyState
                    size="inline"
                    icon={<GaugeIcon aria-hidden />}
                    title="No entitlements to show yet"
                    description="Plans and add-ons that grant this feature will appear here once the entitlement view is wired up."
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
                  editing={editing}
                  onEditingChange={onEditingChange}
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

function OverviewTab({ feature, isMetered }: { feature: Feature; isMetered: boolean }) {
  const [metric, setMetric] = useState('usage')
  const points = isMetered ? demoUsagePoints() : []
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const chartTabs = [
    {
      id: 'usage',
      label: feature.unitPlural ? `Usage (${feature.unitPlural})` : 'Usage',
      value: isMetered ? total.toLocaleString('en-US') : '—',
      points,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {isMetered ? (
        <MetricChart
          tabs={chartTabs}
          activeTab={metric}
          onTabChange={setMetric}
          caption="Last 30 days · demo data, real usage is not wired yet"
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
          className="h-full"
        >
          <ul className="flex flex-1 flex-col divide-y">
            {DEMO_PLANS.map((plan) => (
              <li key={plan.id} className="flex flex-1 items-center justify-between gap-4 py-3 text-sm">
                <span className="font-medium">{plan.name}</span>
                <span className="text-right text-muted-foreground tabular-nums">
                  {plan.included} · {plan.beyond}
                </span>
              </li>
            ))}
          </ul>
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
          {copied ? <CheckIcon aria-hidden className="size-4" /> : <CopyIcon aria-hidden className="size-4" />}
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
  editing,
  onEditingChange,
  onSave,
}: {
  feature: Feature
  isMetered: boolean
  archived: boolean
  editing: boolean
  onEditingChange: (editing: boolean) => void
  onSave: (changes: Record<string, string>) => Promise<unknown>
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ critical: true, warning: true, info: false })

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Section title="General" description="Use the pencil on a value, or Edit above to change them together.">
        <div className="flex flex-col gap-5">
          <EditableFields
            editing={editing}
            onEditingChange={onEditingChange}
            fields={[
              { key: 'name', label: 'Name', value: feature.name, required: true, readOnly: archived },
              {
                key: 'description',
                label: 'Description',
                value: feature.description,
                placeholder: 'No description',
                multiline: true,
                readOnly: archived,
              },
            ]}
            onSave={onSave}
          />
          <Properties
            items={[
              { label: 'Type', value: FEATURE_TYPE_LABEL[feature.type] },
              { label: 'Lookup key', value: mono(feature.lookupKey) },
            ]}
          />
        </div>
      </Section>

      <Section title="Event and aggregation" description="What this feature meters, and how usage is measured.">
        {isMetered ? (
          <Properties
            items={[
              { label: 'Event name', value: mono(feature.eventName) },
              {
                label: 'Aggregation',
                value: feature.aggregationType ? AGGREGATION_LABEL[feature.aggregationType] : '—',
              },
              ...(feature.aggregationField
                ? [{ label: 'Aggregated field', value: mono(feature.aggregationField) }]
                : []),
              { label: 'Unit (singular)', value: feature.unitSingular || '—' },
              { label: 'Unit (plural)', value: feature.unitPlural || '—' },
              { label: 'Meter ID', value: mono(feature.meterId) },
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            This feature is not metered, so it has no event name or aggregation.
          </p>
        )}
      </Section>

      <Section
        title="Usage alerts"
        description="Demo: alert thresholds are not saved yet. Toggles only change this view."
      >
        <ul className="flex flex-col divide-y">
          {ALERTS.map((alert) => (
            <li key={alert.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{alert.label}</span>
                <span className="text-xs text-muted-foreground">{alert.hint}</span>
              </div>
              <Switch
                checked={enabled[alert.id] ?? false}
                onCheckedChange={(next) => setEnabled((current) => ({ ...current, [alert.id]: next }))}
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
            { label: 'Status', value: FEATURE_STATUS_LABEL[feature.status] },
            { label: 'Created', value: formatDate(feature.createdAt) },
            { label: 'Updated', value: formatDate(feature.updatedAt) },
          ]}
        />
      </Section>
    </div>
  )
}

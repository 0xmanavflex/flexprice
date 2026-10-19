import { toast } from 'sonner'
import {
  type AggregationType,
  type Charge,
  type Entitlement,
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  FeatureType,
  needsAggregationTarget,
  USAGE_RESET_PERIOD_LABEL,
  type Feature,
} from '@fp/domain'
import { ArchiveIcon, ChevronRightIcon, CopyIcon, PencilIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { DetailHeader } from '../../../compositions/detail/DetailHeader'
import { DetailBreadcrumb } from '../../../compositions/detail/DetailShell'
import { EditableCard } from '../../../compositions/forms/EditableCard'
import { SubTabState } from '../../../compositions/detail/SubTabState'
import type { ErrorKind } from '../../../compositions/feedback/States'
import { MetadataCard } from '../../../compositions/detail/MetadataCard'
import { Section } from '../../../compositions/layout/Section'
import {
  DetailMoreMenu,
  DetailTabs,
  Properties,
  type DetailMenuItem,
} from '../../../compositions/detail/DetailKit'
import { FEATURE_TYPE_GLYPH, FeatureTypePill, Pill, Status } from '../../shared/cells'
import { ChargeTable } from '../charges/ChargeTable'
import { DetailTable } from '../../shared/DetailTable'

/**
 * Two tabs, not four.
 *
 * Charges and Entitlements were tabs of their own, each holding one table, and
 * Overview held a truncated copy of the charges plus a Usage panel that was
 * always empty — Flexprice reports no usage, customers or billed amount per
 * feature, so there was never anything to draw. The redesign puts both tables
 * on Overview beside the test-event and metadata rail, which is the whole of
 * what this page can actually say, and leaves Information for the fields.
 */
export type FeatureTab = 'overview' | 'information'

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
  /** Header menu: Duplicate. Omitted, the item is not shown. */
  onDuplicate?: () => void
  /** Header menu: delete the feature. Omitted, the item is not shown. */
  onDelete?: () => void
  /** Plans and add-ons that price this feature. */
  charges?: FeatureChargeLink[]
  chargesLoading?: boolean
  chargesError?: string | null
  chargesErrorKind?: ErrorKind | undefined
  onRetryCharges?: (() => void) | undefined
  /** Plans and add-ons that grant this feature. */
  entitlements?: FeatureEntitlementLink[]
  entitlementsLoading?: boolean
  entitlementsError?: string | null
  entitlementsErrorKind?: ErrorKind | undefined
  onRetryEntitlements?: (() => void) | undefined
  /** Charges tab CTA: price this feature on a plan. Omitted, no button is shown. */
  onAddPlan?: () => void
  onOpenChargeParent?: (charge: Charge) => void
  /** Saves the whole metadata map. Omitted, the Metadata section is read-only. */
  onSaveMetadata?: (metadata: Record<string, string>) => Promise<unknown>
  /**
   * The API base URL this environment talks to, e.g. `https://api-dev.cloud.flexprice.io/v1`.
   * The test-event snippet calls it, so staging never prints a production URL.
   */
  apiBaseUrl?: string
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

export const DEFAULT_API_BASE_URL = 'https://api.cloud.flexprice.io/v1'

/**
 * Builds the ingest cURL from the feature's event name and aggregation, against
 * the environment's own API host. The property is the one the feature
 * aggregates, so the event it sends is one the meter will count.
 */
export function buildIngestCurl(feature: Feature, apiBaseUrl = DEFAULT_API_BASE_URL): string {
  const eventName = feature.eventName || 'your_event_name'
  const needsField =
    feature.aggregationType != null && needsAggregationTarget(feature.aggregationType)
  const field = feature.aggregationField?.trim() || 'your_property'
  const properties = needsField ? `{ "${field}": "<value>" }` : '{}'
  const base = (apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
  return [
    `curl --request POST \\`,
    `  --url ${base}/events \\`,
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
  onBack,
  onEditConfiguration,
  onDuplicate,
  onDelete,
  charges = [],
  chargesLoading = false,
  chargesError = null,
  chargesErrorKind,
  onRetryCharges,
  entitlements = [],
  entitlementsLoading = false,
  entitlementsError = null,
  entitlementsErrorKind,
  onRetryEntitlements,
  onAddPlan,
  onOpenChargeParent,
  onSaveMetadata,
  apiBaseUrl,
}: FeatureDetailViewProps) {
  const isMetered = feature.type === FeatureType.Metered
  const Glyph = FEATURE_TYPE_GLYPH[feature.type]
  const archived = feature.status === 'archived'

  const tabs = [
    { value: 'overview', label: 'Overview' },
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
        breadcrumb={
          <DetailBreadcrumb
            trail={[
              { label: 'Features', ...(onBack ? { onClick: onBack } : {}) },
              { label: 'Feature details' },
            ]}
          />
        }
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

      <DetailTabs tabs={tabs} value={tab} onChange={(next) => onTabChange(next as FeatureTab)} />

      {tab === 'overview' ? (
        <OverviewTab
          feature={feature}
          isMetered={isMetered}
          archived={archived}
          {...(apiBaseUrl ? { apiBaseUrl } : {})}
          charges={charges}
          chargesLoading={chargesLoading}
          chargesError={chargesError}
          chargesErrorKind={chargesErrorKind}
          onRetryCharges={onRetryCharges}
          {...(onAddPlan ? { onAddPlan } : {})}
          {...(onOpenChargeParent ? { onOpenChargeParent } : {})}
          entitlements={entitlements}
          entitlementsLoading={entitlementsLoading}
          entitlementsError={entitlementsError}
          entitlementsErrorKind={entitlementsErrorKind}
          onRetryEntitlements={onRetryEntitlements}
          {...(onSaveMetadata ? { onSaveMetadata } : {})}
        />
      ) : (
        <InformationTab feature={feature} isMetered={isMetered} />
      )}
    </div>
  )
}

function EntitlementsSection({
  rows,
  isLoading,
  error,
  errorKind,
  onRetry,
}: {
  rows: FeatureEntitlementLink[]
  isLoading: boolean
  error: string | null
  errorKind?: ErrorKind | undefined
  onRetry?: (() => void) | undefined
}) {
  if (rows.length === 0) {
    return (
      <Section
        title="Entitlements"
        description="What each plan includes before charges apply"
        flush
      >
        <SubTabState
          hasData={false}
          isLoading={isLoading}
          error={error}
          errorKind={errorKind}
          onRetry={onRetry}
          columns={4}
          loadingLabel="Loading entitlements"
          empty={{
            scene: 'catalog',
            title: 'No entitlements yet',
            description: 'No plan includes this feature yet.',
          }}
        >
          {null}
        </SubTabState>
      </Section>
    )
  }
  return (
    <Section
      table
      showTitle
      title="Entitlements"
      description="What each plan includes before charges apply"
    >
      <DetailTable
        compact
        label="Entitlements"
        noun="entitlements"
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

/**
 * Everything the page can actually say about a feature, on one screen.
 *
 * Left: who bills for it (Charges) and who includes it (Entitlements) — the
 * full tables, not a four-row preview of one of them. Right: how to send it an
 * event, and the metadata carried with the record.
 *
 * A non-metered feature has no event and nothing prices it, so it gets the
 * entitlements table and the metadata card, and neither of the other two.
 */
function OverviewTab({
  feature,
  isMetered,
  archived,
  charges,
  chargesLoading,
  chargesError,
  chargesErrorKind,
  onRetryCharges,
  onAddPlan,
  onOpenChargeParent,
  entitlements,
  entitlementsLoading,
  entitlementsError,
  entitlementsErrorKind,
  onRetryEntitlements,
  onSaveMetadata,
  apiBaseUrl,
}: {
  feature: Feature
  isMetered: boolean
  archived: boolean
  apiBaseUrl?: string
  charges: FeatureChargeLink[]
  chargesLoading: boolean
  chargesError: string | null
  chargesErrorKind?: ErrorKind | undefined
  onRetryCharges?: (() => void) | undefined
  onAddPlan?: (() => void) | undefined
  onOpenChargeParent?: ((charge: Charge) => void) | undefined
  entitlements: FeatureEntitlementLink[]
  entitlementsLoading: boolean
  entitlementsError: string | null
  entitlementsErrorKind?: ErrorKind | undefined
  onRetryEntitlements?: (() => void) | undefined
  onSaveMetadata?: ((metadata: Record<string, string>) => Promise<unknown>) | undefined
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
        {isMetered ? (
          <ChargeTable
            charges={
              chargesLoading || chargesError
                ? []
                : charges.map(({ charge, parentName }) => ({ ...charge, displayName: parentName }))
            }
            chargeColumnLabel="Plan / add-on"
            description="Every plan and add-on that bills for this feature"
            emptyDescription="No plan or add-on prices this feature yet."
            layout="narrow"
            hideRowActions
            addLabel="Add plan"
            facets={[
              {
                id: 'parent-status',
                label: 'Plan status',
                value: (charge) =>
                  statusLabel(
                    charges.find((row) => row.charge.id === charge.id)?.parentStatus ?? '',
                  ),
              },
            ]}
            {...(onOpenChargeParent ? { onRowClick: onOpenChargeParent } : {})}
            isLoading={chargesLoading}
            error={chargesError}
            errorKind={chargesErrorKind}
            onRetry={onRetryCharges}
            {...(onAddPlan ? { onAdd: onAddPlan } : {})}
          />
        ) : null}
        <EntitlementsSection
          rows={entitlements}
          isLoading={entitlementsLoading}
          error={entitlementsError}
          errorKind={entitlementsErrorKind}
          onRetry={onRetryEntitlements}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        {isMetered ? (
          <TestEventPanel feature={feature} {...(apiBaseUrl ? { apiBaseUrl } : {})} />
        ) : null}
        <MetadataCard
          metadata={feature.metadata ?? {}}
          {...(onSaveMetadata && !archived ? { onSave: onSaveMetadata } : {})}
        />
      </div>
    </div>
  )
}

function TestEventPanel({ feature, apiBaseUrl }: { feature: Feature; apiBaseUrl?: string }) {
  const command = buildIngestCurl(feature, apiBaseUrl)
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

/**
 * The create form, shown read-only.
 *
 * It used to be a mix: an editable card holding a few fields, an "Event and
 * aggregation" panel built out of `Properties`, and identifiers in a third
 * box — three idioms for one thing, in an order that matched nothing. Someone
 * who had just filled the create form could not find the field they had
 * filled.
 *
 * So this is the form's own shape: **Details** then **Metering**, the same
 * cards with the same labels in the same order, locked. Editing is the one
 * place it was always meant to be — "Edit details" in the header's ⋯ menu
 * opens the real form — so nothing here becomes unreachable, and there is no
 * longer a second, smaller editor that knows about four of the fields.
 */
function InformationTab({ feature, isMetered }: { feature: Feature; isMetered: boolean }) {
  const unit =
    feature.unitSingular || feature.unitPlural
      ? [feature.unitSingular, feature.unitPlural].filter(Boolean).join(' / ')
      : ''

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
        <EditableCard
          title="Details"
          locked
          fields={[
            {
              key: 'type',
              label: 'Type',
              value: FEATURE_TYPE_LABEL[feature.type],
              display: (
                <FeatureTypePill type={feature.type} label={FEATURE_TYPE_LABEL[feature.type]} />
              ),
              readOnly: true,
            },
            { key: 'name', label: 'Name', value: feature.name, readOnly: true },
            {
              key: 'lookupKey',
              label: 'Lookup key',
              value: feature.lookupKey,
              display: mono(feature.lookupKey),
              readOnly: true,
            },
            {
              key: 'description',
              label: 'Description',
              value: feature.description,
              placeholder: 'No description',
              multiline: true,
              readOnly: true,
            },
          ]}
          onSave={noSave}
        />

        {isMetered ? (
          <Section title="Metering">
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
                // Only when the aggregation has one — the form hides it too.
                ...(feature.aggregationField
                  ? [{ label: 'Event field', value: mono(feature.aggregationField) }]
                  : []),
                ...(unit ? [{ label: 'Unit', value: unit }] : []),
              ]}
            />
            <div className="mt-6 space-y-2 border-t pt-5">
              <p className="text-muted-foreground text-xs">Event filters</p>
              <EventProperties filters={feature.meterFilters ?? []} />
            </div>
          </Section>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        {/* Not create-form fields: the ids people paste into API calls, and
            when the record changed. Metadata is on Overview, beside the event
            it annotates. */}
        <Section title="Identifiers">
          <Properties
            columns={2}
            items={[
              { label: 'Feature ID', value: mono(feature.id) },
              { label: 'Meter ID', value: mono(feature.meterId) },
            ]}
          />
        </Section>
        <Section title="History">
          <Properties
            columns={2}
            items={[
              { label: 'Created', value: formatDate(feature.createdAt) },
              { label: 'Updated', value: formatDate(feature.updatedAt) },
            ]}
          />
        </Section>
      </div>
    </div>
  )
}

/** A locked card never saves; `EditableCard` wants the prop regardless. */
const noSave = async () => undefined

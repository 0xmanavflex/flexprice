import { toast } from 'sonner'
import {
  AGGREGATION_LABEL,
  type Charge,
  type Entitlement,
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  FeatureType,
  needsAggregationTarget,
  type Feature,
  meteredAllowanceLabel,
  meteredResetLabel,
} from '@fp/domain'
import { ArchiveIcon, BellIcon, CopyIcon, PencilIcon } from '@ui/icons'
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
 * always empty: Flexprice reports no usage, customers or billed amount per
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
  /** Header menu: the feature's usage alert thresholds. Omitted, the item is not shown. */
  onAlertSettings?: () => void
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
  onAddCharge?: () => void
  onOpenChargeParent?: (charge: Charge) => void
  /** Saves the whole metadata map. Omitted, the Metadata section is read-only. */
  onSaveMetadata?: (metadata: Record<string, string>) => Promise<unknown>
  /**
   * The API base URL this environment talks to, e.g. `https://api-dev.cloud.flexprice.io/v1`.
   * The test-event snippet calls it, so staging never prints a production URL.
   */
  apiBaseUrl?: string
  /** The label (group) the feature is filed under, by name. */
  groupName?: string
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
    return meteredAllowanceLabel(entitlement)
  }
  if (entitlement.featureType === FeatureType.Boolean) return entitlement.isEnabled ? 'Yes' : 'No'
  if (entitlement.featureType === FeatureType.Static) return entitlement.staticValue ?? '—'
  return 'Configured'
}

function resetsOf(entitlement: Entitlement): string {
  return meteredResetLabel(entitlement) ?? '—'
}

export function FeatureDetailView({
  feature,
  tab,
  onTabChange,
  onBack,
  onEditConfiguration,
  onDuplicate,
  onAlertSettings,
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
  onAddCharge,
  onOpenChargeParent,
  onSaveMetadata,
  apiBaseUrl,
  groupName,
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
    ...(onAlertSettings
      ? [
          {
            id: 'alerts',
            label: 'Alert settings',
            icon: <BellIcon className="text-muted-foreground" aria-hidden />,
            onSelect: onAlertSettings,
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
            {groupName ? <Pill size="sm">{groupName}</Pill> : null}
          </>
        }
        actions={<DetailMoreMenu label="More actions" items={menu} />}
      />

      <DetailTabs tabs={tabs} value={tab} onChange={(next) => onTabChange(next as FeatureTab)} />

      {/* One page: only the left column changes between tabs. The test event and
          metadata stay put on the right in both. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {tab === 'overview' ? (
          <OverviewTab
            isMetered={isMetered}
            charges={charges}
            chargesLoading={chargesLoading}
            chargesError={chargesError}
            chargesErrorKind={chargesErrorKind}
            onRetryCharges={onRetryCharges}
            {...(onAddCharge ? { onAddCharge } : {})}
            {...(onOpenChargeParent ? { onOpenChargeParent } : {})}
            entitlements={entitlements}
            entitlementsLoading={entitlementsLoading}
            entitlementsError={entitlementsError}
            entitlementsErrorKind={entitlementsErrorKind}
            onRetryEntitlements={onRetryEntitlements}
          />
        ) : (
          <InformationTab feature={feature} isMetered={isMetered} groupName={groupName} />
        )}
        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6">
          {isMetered ? (
            <TestEventPanel feature={feature} {...(apiBaseUrl ? { apiBaseUrl } : {})} />
          ) : null}
          <MetadataCard
            metadata={feature.metadata ?? {}}
            {...(onSaveMetadata && !archived ? { onSave: onSaveMetadata } : {})}
          />
        </div>
      </div>
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
 * Left: who bills for it (Charges) and who includes it (Entitlements): the
 * full tables, not a four-row preview of one of them. Right: how to send it an
 * event, and the metadata carried with the record.
 *
 * A non-metered feature has no event and nothing prices it, so it gets the
 * entitlements table and the metadata card, and neither of the other two.
 */
function OverviewTab({
  isMetered,
  charges,
  chargesLoading,
  chargesError,
  chargesErrorKind,
  onRetryCharges,
  onAddCharge,
  onOpenChargeParent,
  entitlements,
  entitlementsLoading,
  entitlementsError,
  entitlementsErrorKind,
  onRetryEntitlements,
}: {
  isMetered: boolean
  charges: FeatureChargeLink[]
  chargesLoading: boolean
  chargesError: string | null
  chargesErrorKind?: ErrorKind | undefined
  onRetryCharges?: (() => void) | undefined
  onAddCharge?: (() => void) | undefined
  onOpenChargeParent?: ((charge: Charge) => void) | undefined
  entitlements: FeatureEntitlementLink[]
  entitlementsLoading: boolean
  entitlementsError: string | null
  entitlementsErrorKind?: ErrorKind | undefined
  onRetryEntitlements?: (() => void) | undefined
}) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
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
          addLabel="Add charge"
          facets={[
            {
              id: 'parent-status',
              label: 'Plan status',
              value: (charge) =>
                statusLabel(charges.find((row) => row.charge.id === charge.id)?.parentStatus ?? ''),
            },
          ]}
          {...(onOpenChargeParent ? { onRowClick: onOpenChargeParent } : {})}
          isLoading={chargesLoading}
          error={chargesError}
          errorKind={chargesErrorKind}
          onRetry={onRetryCharges}
          {...(onAddCharge ? { onAdd: onAddCharge } : {})}
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
      title="Send a test event"
      bodyClassName="flex flex-col"
      action={
        <Button variant="outline" size="sm" className="h-8 px-3" onClick={copy}>
          <CopyIcon aria-hidden />
          Copy cURL
        </Button>
      }
    >
      <pre className="border-border bg-invert text-invert-foreground flex-1 rounded-lg border p-3.5 font-mono text-[11.5px]/relaxed break-words whitespace-pre-wrap">
        <code>{command}</code>
      </pre>
    </Section>
  )
}

/**
 * The create form, shown read-only: **Details** then **Metering**, the same
 * cards with the same rows, labels and hints in the same order, so someone
 * who just filled the form finds each field where they left it. Editing stays
 * in one place: "Edit details" in the header's ⋯ menu opens the real form.
 *
 * Ids and timestamps are not create-form fields: the header's ID chip carries
 * the id, and the right-hand rail (test event, metadata) is shared with
 * Overview.
 */
function InformationTab({
  feature,
  isMetered,
  groupName,
}: {
  feature: Feature
  isMetered: boolean
  groupName?: string | undefined
}) {
  const filters = feature.meterFilters ?? []
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* The same locked card the Plan page uses, so the rows read at one size. */}
      <EditableCard
        title="Details"
        locked
        onSave={noSave}
        fields={[
          {
            key: 'type',
            label: 'Type',
            value: FEATURE_TYPE_LABEL[feature.type],
            hint: 'The type is fixed once the feature exists.',
            readOnly: true,
          },
          { key: 'name', label: 'Name', value: feature.name, readOnly: true },
          {
            key: 'lookupKey',
            label: 'Lookup key',
            value: feature.lookupKey,
            ...(feature.lookupKey ? { display: mono(feature.lookupKey) } : {}),
            placeholder: 'None',
            hint: 'Fixed once set: integrations key off it.',
            readOnly: true,
          },
          {
            key: 'description',
            label: 'Description',
            value: feature.description,
            placeholder: 'None',
            readOnly: true,
          },
          {
            key: 'label',
            label: 'Tag',
            value: groupName ?? '',
            placeholder: 'None',
            hint: 'The label the feature is filed under.',
            readOnly: true,
          },
        ]}
      />

      {isMetered ? (
        <EditableCard
          title="Metering"
          locked
          onSave={noSave}
          fields={[
            {
              key: 'event',
              label: 'Event name',
              value: feature.eventName ?? '',
              ...(feature.eventName ? { display: mono(feature.eventName) } : {}),
              placeholder: 'None',
              hint: 'The event whose usage is measured.',
              readOnly: true,
            },
            {
              key: 'filters',
              label: 'Event filters',
              value: filters.length ? 'set' : '',
              ...(filters.length
                ? {
                    display: mono(
                      filters
                        .map((filter) => `${filter.key} = ${filter.values.join(', ')}`)
                        .join(', '),
                    ),
                  }
                : {}),
              placeholder: 'None',
              hint: 'Only events whose property matches one of the values are counted.',
              readOnly: true,
            },
            {
              key: 'aggregation',
              label: 'Aggregation',
              value: feature.aggregationType ? AGGREGATION_LABEL[feature.aggregationType] : '',
              placeholder: 'None',
              hint: 'How events are combined into a usage number.',
              readOnly: true,
            },
            // Only when the aggregation has one: the form hides it too.
            ...(feature.aggregationField
              ? [
                  {
                    key: 'field',
                    label: 'Event field',
                    value: feature.aggregationField,
                    display: mono(feature.aggregationField),
                    hint: 'The property on the event to aggregate.',
                    readOnly: true,
                  },
                ]
              : []),
            {
              key: 'unit',
              label: 'Unit name',
              value: feature.unitSingular,
              placeholder: 'None',
              hint: 'Shown after a quantity of one, for example call.',
              readOnly: true,
            },
          ]}
        />
      ) : null}
    </div>
  )
}

/** A locked card never saves; `EditableCard` wants the prop regardless. */
const noSave = async () => undefined

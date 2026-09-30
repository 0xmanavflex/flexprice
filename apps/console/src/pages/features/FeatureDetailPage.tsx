import { useMemo, useState } from 'react'
import {
  AGGREGATION_LABEL,
  DEFAULT_GROUP_QUERY,
  GroupEntityType,
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  FeatureType,
  needsAggregationTarget,
  type Feature,
} from '@fp/domain'
import { ApiError, useFeature, useGroups, useUpdateFeature } from '@fp/query'
import { CatalogStatusBadge, FeatureEditorDialog, FeatureTypeBadge } from '@fp/ui/pages'
import {
  AppFailure,
  type DetailItem,
  DetailList,
  DetailShell,
  EmptyState,
  LoadingRows,
  PageBody,
  ResourceNavigation,
  Section,
} from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { CheckIcon, CopyIcon, GaugeIcon, PencilIcon, ReceiptIcon } from 'lucide-react'
import { toSubmitError } from './featureMessages'

export interface FeatureDetailPageProps {
  featureId: string
  onNavigateToList: () => void
}

type FeatureTab = 'overview' | 'charges' | 'entitlements' | 'information'

/**
 * One feature, in full.
 *
 * Built on the shared `DetailShell`: a breadcrumb, a large title with its type
 * and status badges, the identifier, and the description. There is **no rail**.
 * A rail is for money and counts — events over time, plans using a feature — and
 * V2 has no hook that can derive any of those for a feature yet. Faking one out
 * of Type/Status/Aggregation/Unit is exactly the metadata restatement the audit
 * called out, so the header simply carries none; `DetailShell` renders nothing
 * where the rail would be.
 *
 * For a **metered** feature the page leads with what it meters (once, in "Event
 * details") and a ready-to-run "Ingest an event" cURL built from the feature's
 * own event name and aggregation — the one genuinely useful thing this page can
 * offer a developer today. Charges and Entitlements are honest empty states:
 * there is no linked-price or entitlement read hook yet, so they say what will
 * appear rather than inventing rows.
 *
 * Edit opens the same dialog the list uses, prefilled.
 */
export function FeatureDetailPage({ featureId, onNavigateToList }: FeatureDetailPageProps) {
  const feature = useFeature(featureId)
  const [tab, setTab] = useState<FeatureTab>('overview')
  const [editing, setEditing] = useState(false)
  const update = useUpdateFeature()
  const groups = useGroups({ ...DEFAULT_GROUP_QUERY, pageSize: 100 })
  const groupOptions = useMemo(
    () =>
      (groups.data?.groups ?? [])
        .filter((group) => group.entityType === GroupEntityType.Feature)
        .map((group) => ({ value: group.id, label: group.name })),
    [groups.data],
  )

  if (feature.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (feature.error) {
    return (
      <PageBody>
        <AppFailure
          title={failureTitle(feature.error)}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={() => void feature.refetch()}
        />
      </PageBody>
    )
  }

  if (!feature.data) {
    return (
      <PageBody>
        <AppFailure
          title="This feature no longer exists"
          detail="It may have been deleted. Everything else in the catalogue still works."
          onRetry={onNavigateToList}
        />
      </PageBody>
    )
  }

  const data = feature.data
  const isMetered = data.type === FeatureType.Metered

  return (
    <DetailShell
      trail={[{ label: 'Features', onClick: onNavigateToList }, { label: data.name }]}
      title={data.name}
      badges={
        <>
          <FeatureTypeBadge type={data.type} />
          <CatalogStatusBadge status={data.status} />
        </>
      }
      identifier={data.lookupKey || data.id}
      actions={
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon aria-hidden className="size-4" />
          Edit
        </Button>
      }
      {...(data.description ? { description: data.description } : {})}
    >
      {/* The shared line nav, the same section strip the customer and plan pages use. */}
      <ResourceNavigation
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'charges', label: 'Charges' },
          { id: 'entitlements', label: 'Entitlements' },
          { id: 'information', label: 'Information' },
        ]}
        value={tab}
        onChange={(id) => setTab(id as FeatureTab)}
        label="Feature sections"
      />

      <div className="flex flex-col gap-6 pt-5">
        {tab === 'overview' ? (
          isMetered ? (
            <>
              <Section
                title="Event details"
                description="What this feature meters, and how usage is measured."
              >
                <DetailList
                  items={[
                    {
                      label: 'Event name',
                      value: data.eventName ? (
                        <span className="font-mono text-xs">{data.eventName}</span>
                      ) : (
                        '—'
                      ),
                    },
                    {
                      label: 'Aggregation',
                      value: data.aggregationType ? AGGREGATION_LABEL[data.aggregationType] : '—',
                    },
                    { label: 'Unit (singular)', value: data.unitSingular || '—' },
                    { label: 'Unit (plural)', value: data.unitPlural || '—' },
                  ]}
                />
              </Section>
              <IngestEventSection feature={data} />
            </>
          ) : (
            <Section title="Overview" description="How this feature behaves.">
              <p className="text-sm leading-relaxed text-muted-foreground">
                This is a boolean feature — it gates access to functionality rather than metering
                usage, so it carries no event name or aggregation.
              </p>
            </Section>
          )
        ) : null}

        {tab === 'charges' ? (
          <Section title="Charges" description="Prices across the catalogue that meter this feature.">
            <EmptyState
              size="inline"
              icon={<ReceiptIcon aria-hidden />}
              title="No linked charges to show yet"
              description="Plans and add-ons that price this feature will appear here once the linked-price view is wired up."
            />
          </Section>
        ) : null}

        {tab === 'entitlements' ? (
          <Section title="Entitlements" description="Plans and add-ons that grant this feature.">
            <EmptyState
              size="inline"
              icon={<GaugeIcon aria-hidden />}
              title="No entitlements to show yet"
              description="Plans and add-ons that grant this feature will appear here once the entitlement view is wired up."
            />
          </Section>
        ) : null}

        {tab === 'information' ? (
          <Section title="Information" description="Every attribute of this feature.">
            <DetailList items={informationItems(data, isMetered)} />
          </Section>
        ) : null}
      </div>

      <FeatureEditorDialog
        open={editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(false)
            update.reset()
          }
        }}
        mode="edit"
        feature={data}
        groups={groupOptions}
        onSubmit={(draft) =>
          update.mutate(
            { id: data.id, draft },
            {
              onSuccess: () => {
                setEditing(false)
                update.reset()
              },
            },
          )
        }
        isSubmitting={update.isPending}
        submitError={toSubmitError(update.error)}
      />
    </DetailShell>
  )
}

/**
 * The "Ingest an event" developer aid, ported from V1's `FeatureDetails`.
 *
 * A read-only cURL that a developer can copy, drop their key and customer id
 * into, and fire — pre-filled with this feature's own event name so the meter
 * actually matches. When the aggregation sums or averages a field (anything but
 * a plain count), the body carries a placeholder property to make that explicit.
 */
function IngestEventSection({ feature }: { feature: Feature }) {
  const command = buildIngestCurl(feature)
  return (
    <Section
      title="Ingest an event"
      description="Send a usage event to Flexprice for this feature. Fill in the placeholders, then run it from your terminal or backend."
      actions={<CopyButton value={command} />}
    >
      <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground">
        <code>{command}</code>
      </pre>
    </Section>
  )
}

/** Builds the ingest cURL from the feature's event name and aggregation. */
function buildIngestCurl(feature: Feature): string {
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

/** Copy-to-clipboard, with a brief confirmation. A nice-to-have on the snippet. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const done = navigator.clipboard?.writeText(value)
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
  )
}

/** The full attribute set, once. Meter ID only appears for metered features. */
function informationItems(feature: Feature, isMetered: boolean): DetailItem[] {
  return [
    { label: 'Name', value: feature.name },
    {
      label: 'Lookup key',
      value: feature.lookupKey ? (
        <span className="font-mono text-xs">{feature.lookupKey}</span>
      ) : (
        '—'
      ),
    },
    { label: 'Type', value: FEATURE_TYPE_LABEL[feature.type] },
    { label: 'Status', value: FEATURE_STATUS_LABEL[feature.status] },
    { label: 'Feature ID', value: <span className="font-mono text-xs">{feature.id}</span> },
    ...(isMetered
      ? [
          {
            label: 'Meter ID',
            value: feature.meterId ? (
              <span className="font-mono text-xs">{feature.meterId}</span>
            ) : (
              '—'
            ),
          },
        ]
      : []),
    { label: 'Description', value: feature.description || '—', full: true },
    { label: 'Created', value: formatDate(feature.createdAt) },
    { label: 'Updated', value: formatDate(feature.updatedAt) },
  ]
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}

function failureTitle(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return 'You do not have access to this feature.'
      case 'unauthorized':
        return 'Your session has expired. Sign in again.'
      case 'network':
        return 'Could not reach Flexprice.'
      default:
        return 'This feature could not be loaded.'
    }
  }
  return 'This feature could not be loaded.'
}

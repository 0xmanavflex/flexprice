import {
  AGGREGATION_LABEL,
  FEATURE_TYPE_LABEL,
  FeatureType,
  type Feature,
} from '@fp/domain'
import { ApiError, useFeature } from '@fp/query'
import { CatalogStatusBadge, FeatureTypeBadge } from '@fp/ui/flexprice'
import {
  AppFailure,
  DetailList,
  DetailHeader,
  DetailStats,
  EmptyState,
  LoadingRows,
  PageBody,
  Section,
} from '@fp/ui/compositions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@fp/ui/primitives'
import { GaugeIcon, ReceiptIcon } from 'lucide-react'

export interface FeatureDetailPageProps {
  featureId: string
  onNavigateToList: () => void
}

/**
 * One feature, in full.
 *
 * The reference detail page: a shared header, a Frame stat rail, then tabbed
 * sections — Overview (what this feature meters, and what it is linked to) and
 * Information (every attribute). Replaces V1's `FeatureDetails`, which reaches
 * into `FeatureApi` directly and hand-rolls its own cards; this fetches through
 * `useFeature` and composes the shared detail pieces.
 *
 * Charges and entitlements show an honest empty state: V2 has no linked-price
 * or entitlement read hook yet, so the sections say so rather than inventing
 * rows — the same stand-in the list pages use for surfaces still being built.
 */
export function FeatureDetailPage({ featureId, onNavigateToList }: FeatureDetailPageProps) {
  const feature = useFeature(featureId)

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
    <>
      <DetailHeader
        breadcrumb={
          <button
            type="button"
            onClick={onNavigateToList}
            className="w-fit text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Features
          </button>
        }
        title={data.name}
        badges={
          <>
            <FeatureTypeBadge type={data.type} />
            <CatalogStatusBadge status={data.status} />
          </>
        }
        identifier={data.lookupKey || data.id}
        {...(data.description ? { description: data.description } : {})}
      />

      <PageBody>
        <DetailStats stats={detailStats(data)} />

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="information">Information</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-4 pt-2">
            {isMetered ? (
              <Section title="Event details" description="What this feature meters, and how.">
                <DetailList
                  items={[
                    { label: 'Event name', value: data.eventName },
                    {
                      label: 'Aggregation',
                      value: data.aggregationType ? AGGREGATION_LABEL[data.aggregationType] : null,
                    },
                    { label: 'Unit (singular)', value: data.unitSingular },
                    { label: 'Unit (plural)', value: data.unitPlural },
                  ]}
                />
              </Section>
            ) : null}

            <Section title="Charges" description="Prices across the catalogue that meter this feature.">
              <EmptyState
                size="inline"
                icon={<ReceiptIcon aria-hidden />}
                title="No charges linked yet"
                description="Prices that meter this feature will appear here once the linked-price view lands."
              />
            </Section>

            <Section title="Entitlements" description="Plans and add-ons that grant this feature.">
              <EmptyState
                size="inline"
                icon={<GaugeIcon aria-hidden />}
                title="No entitlements linked yet"
                description="Plans and add-ons that grant this feature will appear here once the entitlement view lands."
              />
            </Section>
          </TabsContent>

          <TabsContent value="information" className="pt-2">
            <Section title="Information" description="Every attribute of this feature.">
              <DetailList
                items={[
                  { label: 'Name', value: data.name },
                  { label: 'Lookup key', value: data.lookupKey },
                  { label: 'Type', value: FEATURE_TYPE_LABEL[data.type] },
                  { label: 'Status', value: <CatalogStatusBadge status={data.status} /> },
                  { label: 'Feature ID', value: <span className="font-mono text-xs">{data.id}</span> },
                  { label: 'Description', value: data.description },
                  { label: 'Created', value: formatDate(data.createdAt) },
                  { label: 'Updated', value: formatDate(data.updatedAt) },
                ]}
              />
            </Section>
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  )
}

function detailStats(feature: Feature) {
  const stats = [
    { label: 'Type', value: FEATURE_TYPE_LABEL[feature.type] },
    { label: 'Status', value: <CatalogStatusBadge status={feature.status} /> },
  ]
  if (feature.type === FeatureType.Metered) {
    stats.push({
      label: 'Aggregation',
      value: feature.aggregationType ? AGGREGATION_LABEL[feature.aggregationType] : '—',
    })
    stats.push({ label: 'Unit', value: feature.unitSingular || '—' })
  } else {
    stats.push({ label: 'Updated', value: formatDate(feature.updatedAt) })
  }
  return stats
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

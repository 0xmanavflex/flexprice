import { GROUP_ENTITY_TYPE_LABEL, type Group } from '@fp/domain'
import { ApiError, useGroup } from '@fp/query'
import { CatalogStatusBadge } from '@fp/ui/flexprice'
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
import { LayersIcon } from 'lucide-react'

export interface GroupDetailPageProps {
  groupId: string
  onNavigateToList: () => void
}

/**
 * One group, in full.
 *
 * A shared header, a Frame stat rail, then the group's own details and the
 * members it bundles. The details lead, so the page opens on the record itself
 * rather than an empty section. Replaces V1's `GroupProfilePage`, which reaches
 * into `GroupApi` directly and hand-rolls its own header; this fetches through
 * `useGroup` and composes the shared detail pieces.
 *
 * Members show an honest empty state: V2 has no member-entities read hook yet,
 * so the section says so rather than inventing rows — the same stand-in the
 * list pages use for surfaces still being built.
 */
export function GroupDetailPage({ groupId, onNavigateToList }: GroupDetailPageProps) {
  const group = useGroup(groupId)

  if (group.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (group.error) {
    return (
      <PageBody>
        <AppFailure
          title={failureTitle(group.error)}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={() => void group.refetch()}
        />
      </PageBody>
    )
  }

  if (!group.data) {
    return (
      <PageBody>
        <AppFailure
          title="This group no longer exists"
          detail="It may have been deleted. Everything else in the catalogue still works."
          onRetry={onNavigateToList}
        />
      </PageBody>
    )
  }

  const data = group.data

  return (
    <>
      <DetailHeader
        breadcrumb={
          <button
            type="button"
            onClick={onNavigateToList}
            className="w-fit text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Groups
          </button>
        }
        title={data.name}
        badges={<CatalogStatusBadge status={data.status} />}
        identifier={data.lookupKey || data.id}
      />

      <PageBody>
        <DetailStats stats={detailStats(data)} />

        <Section title="Information" description="Every attribute of this group.">
          <DetailList
            items={[
              { label: 'Name', value: data.name },
              { label: 'Lookup key', value: data.lookupKey },
              { label: 'Holds', value: GROUP_ENTITY_TYPE_LABEL[data.entityType] },
              { label: 'Members', value: membersLabel(data) },
              { label: 'Status', value: <CatalogStatusBadge status={data.status} /> },
              { label: 'Group ID', value: <span className="font-mono text-xs">{data.id}</span> },
              { label: 'Created', value: formatDate(data.createdAt) },
              { label: 'Updated', value: formatDate(data.updatedAt) },
            ]}
          />
        </Section>

        <Section title="Members" description="The prices or features this group bundles.">
          <EmptyState
            size="inline"
            icon={<LayersIcon aria-hidden />}
            title="No members to show yet"
            description="The prices and features this group holds will appear here once the member view lands."
          />
        </Section>
      </PageBody>
    </>
  )
}

function detailStats(group: Group) {
  return [
    { label: 'Holds', value: GROUP_ENTITY_TYPE_LABEL[group.entityType] },
    { label: 'Members', value: membersLabel(group) },
    { label: 'Status', value: <CatalogStatusBadge status={group.status} /> },
    { label: 'Updated', value: formatDate(group.updatedAt) },
  ]
}

/** "12 prices", "1 feature" — the count with the kind it holds. */
function membersLabel(group: Group): string {
  const count = new Intl.NumberFormat().format(group.entityCount)
  const noun = GROUP_ENTITY_TYPE_LABEL[group.entityType].toLowerCase()
  const singular = group.entityCount === 1 ? noun.replace(/s$/, '') : noun
  return `${count} ${singular}`
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}

function failureTitle(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return 'You do not have access to this group.'
      case 'unauthorized':
        return 'Your session has expired. Sign in again.'
      case 'network':
        return 'Could not reach Flexprice.'
      default:
        return 'This group could not be loaded.'
    }
  }
  return 'This group could not be loaded.'
}

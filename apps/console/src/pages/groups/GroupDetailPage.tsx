import { useState } from 'react'
import { GROUP_ENTITY_TYPE_LABEL } from '@fp/domain'
import { ApiError, useGroup } from '@fp/query'
import { CatalogDetailFrame, CatalogStatusBadge, GroupMembersView } from '@fp/ui/pages'
import {
  AppFailure,
  DetailList,
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
 * A group exists to show its contents, so the page leads with the one number it
 * can honestly derive — how many members it holds, from the `entityIds` the
 * group model carries as a count — then lists the record and, where the members
 * themselves would go, an honest empty state.
 *
 * The members are a genuine empty state, not a stub dressed as one: V2 has no
 * member-entities read hook, so there is no way to enumerate them yet. The count
 * is real (it rides on the group), so it earns the rail; the list of who they
 * are is not, so the section says so plainly rather than inventing rows.
 */
export function GroupDetailPage({ groupId, onNavigateToList }: GroupDetailPageProps) {
  const group = useGroup(groupId)
  const [tab, setTab] = useState('members')

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
  const kind = GROUP_ENTITY_TYPE_LABEL[data.entityType].toLowerCase()

  const noun = GROUP_ENTITY_TYPE_LABEL[data.entityType]

  return (
    <CatalogDetailFrame
      listLabel="Groups"
      onBack={onNavigateToList}
      icon={<LayersIcon />}
      title={data.name}
      badges={<CatalogStatusBadge status={data.status} />}
      subtitle={`${new Intl.NumberFormat().format(data.entityCount)} ${kind}`}
      id={data.lookupKey || data.id}
      menuLabel="Group actions"
      tab={tab}
      onTabChange={setTab}
      tabs={[
        {
          value: 'members',
          label: noun,
          count: data.entityCount,
          content: <GroupMembersView kind={kind} count={data.entityCount} />,
        },
        {
          value: 'information',
          label: 'Information',
          content: (
            <Section title="Information" description="Every attribute of this group.">
              <DetailList
                items={[
                  { label: 'Name', value: data.name },
                  { label: 'Lookup key', value: data.lookupKey || '—' },
                  { label: 'Holds', value: noun },
                  { label: 'Status', value: <CatalogStatusBadge status={data.status} /> },
                  {
                    label: 'Group ID',
                    value: <span className="font-mono text-xs">{data.id}</span>,
                  },
                  { label: 'Created', value: formatDate(data.createdAt) },
                  { label: 'Updated', value: formatDate(data.updatedAt) },
                ]}
              />
            </Section>
          ),
        },
      ]}
    />
  )
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

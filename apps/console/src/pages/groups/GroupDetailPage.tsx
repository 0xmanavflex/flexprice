import { useState } from 'react'
import { GROUP_ENTITY_TYPE_LABEL } from '@fp/domain'
import { ApiError, useGroup } from '@fp/query'
import { CatalogDetailFrame, CatalogStatusBadge, GroupMembersView, Pill } from '@fp/ui/pages'
import { AppFailure, EditableCard, LoadingRows, PageBody } from '@fp/ui/compositions'
import { LayersIcon } from '@fp/ui/icons'

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
      badges={
        <>
          <Pill>{noun} group</Pill>
          <Pill>
            {new Intl.NumberFormat().format(data.entityCount)} {kind}
          </Pill>
        </>
      }
      id={data.lookupKey || data.id}
      menuLabel="Group actions"
      menu={[{ id: 'edit-details', label: 'Edit', onSelect: () => setTab('information') }]}
      tab={tab}
      onTabChange={setTab}
      tabs={[
        {
          value: 'members',
          label: noun,
          count: data.entityCount,
          content: <GroupMembersView kind={kind} />,
        },
        {
          value: 'information',
          label: 'Information',
          content: (
            <EditableCard
              className="max-w-3xl"
              title="Group details"
              locked
              fields={[
                { key: 'name', label: 'Name', value: data.name, readOnly: true },
                {
                  key: 'lookupKey',
                  label: 'Lookup key',
                  value: data.lookupKey || '',
                  display: <span className="font-mono text-[13px]">{data.lookupKey || '—'}</span>,
                  readOnly: true,
                },
                { key: 'holds', label: 'Holds', value: noun, readOnly: true },
                {
                  key: 'status',
                  label: 'Status',
                  value: data.status,
                  display: <CatalogStatusBadge status={data.status} />,
                  readOnly: true,
                },
                {
                  key: 'id',
                  label: 'Group ID',
                  value: data.id,
                  display: <span className="font-mono text-[13px]">{data.id}</span>,
                  readOnly: true,
                },
                {
                  key: 'created',
                  label: 'Created',
                  value: formatDate(data.createdAt),
                  readOnly: true,
                },
                {
                  key: 'updated',
                  label: 'Updated',
                  value: formatDate(data.updatedAt),
                  readOnly: true,
                },
              ]}
              onSave={() => undefined}
            />
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

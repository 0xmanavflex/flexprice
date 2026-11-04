import { useState } from 'react'
import { GROUP_ENTITY_TYPE_LABEL, GroupEntityType } from '@fp/domain'
import { useDeleteGroup, useGroup, useGroupMembers } from '@fp/query'
import { CatalogDetailFrame, CatalogStatusBadge, GroupMembersView, Pill } from '@fp/ui/pages'
import { ConfirmDialog, EditableCard } from '@fp/ui/compositions'
import { CopyIcon, LayersIcon, Trash2Icon } from '@fp/ui/icons'
import { subTab } from '../shared/subTab'
import { detailGate } from '../shared/detailGate'

export interface GroupDetailPageProps {
  groupId: string
  onNavigateToList: () => void
}

/**
 * One tag (the API's group), in full, as V1's group page: what it holds (its
 * `entityIds`, named through the feature or price search) and its record. It
 * opens inside Settings, under Tags. The record is read-only because the SDK
 * has no group update; a tag can be deleted or its id copied.
 */
export function GroupDetailPage({ groupId, onNavigateToList }: GroupDetailPageProps) {
  const group = useGroup(groupId)
  const members = useGroupMembers(group.data)
  const remove = useDeleteGroup()
  const [tab, setTab] = useState('members')
  const [deleting, setDeleting] = useState(false)

  if (!group.data) {
    return detailGate(group, {
      noun: 'this tag',
      listName: 'tags',
      onBack: onNavigateToList,
      recordPath: `/groups/${encodeURIComponent(groupId)}`,
    })
  }

  const data = group.data
  const kind = GROUP_ENTITY_TYPE_LABEL[data.entityType].toLowerCase()

  const noun = GROUP_ENTITY_TYPE_LABEL[data.entityType]

  return (
    <CatalogDetailFrame
      listLabel="Tags"
      onBack={onNavigateToList}
      icon={<LayersIcon />}
      title={data.name}
      badges={
        <>
          <CatalogStatusBadge status={data.status} />
          <Pill>{noun.replace(/s$/, '')}</Pill>
          <Pill>
            {new Intl.NumberFormat().format(data.entityCount)}{' '}
            {data.entityCount === 1 ? 'member' : 'members'}
          </Pill>
        </>
      }
      id={data.lookupKey || data.id}
      menuLabel="Tag actions"
      // No edit item: the SDK has no group update, so the record is read-only.
      menu={[
        {
          id: 'copy',
          label: 'Copy tag ID',
          icon: <CopyIcon aria-hidden />,
          onSelect: () => void navigator.clipboard?.writeText(data.id),
        },
        {
          id: 'delete',
          label: 'Delete tag',
          icon: <Trash2Icon aria-hidden />,
          destructive: true,
          onSelect: () => setDeleting(true),
        },
      ]}
      tab={tab}
      onTabChange={setTab}
      tabs={[
        {
          value: 'members',
          label: noun,
          count: data.entityCount,
          content: (
            <GroupMembersView
              kind={kind}
              priceGroup={data.entityType === GroupEntityType.Price}
              {...subTab(members, kind)}
              {...(members.data ? { members: members.data } : {})}
            />
          ),
        },
        {
          value: 'information',
          label: 'Information',
          content: (
            <EditableCard
              className="max-w-3xl"
              title="Tag details"
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
                  key: 'id',
                  label: 'Tag ID',
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
    >
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(false)
            remove.reset()
          }
        }}
        title={`Delete ${data.name}?`}
        description="The tag is removed and its members are no longer tagged. The features or prices themselves are not changed."
        confirmLabel="Delete tag"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not delete the tag. Try again.' : null}
        onConfirm={() => remove.mutate(data.id, { onSuccess: onNavigateToList })}
      />
    </CatalogDetailFrame>
  )
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}

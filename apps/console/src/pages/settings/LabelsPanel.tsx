import { useEffect, useRef, useState } from 'react'
import {
  type CreateGroup,
  DEFAULT_GROUP_QUERY,
  GROUP_ENTITY_TYPE_LABEL,
  GROUP_STATUS_LABEL,
  type Group,
  GroupEntityType,
  createGroupSchema,
  emptyGroup,
} from '@fp/domain'
import { useCreateGroup, useDeleteGroup, useGroups } from '@fp/query'
import { ConfirmDialog, EmptyState, Field, LoadingRows, OptionSelect } from '@fp/ui/compositions'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fp/ui/primitives'
import { TagIcon } from 'lucide-react'
import {
  ActionError,
  PanelError,
  TableBlock,
  WidePanel,
  formatDate,
  mutationMessage,
  toFailure,
} from './panelKit'
import { useDraft } from './useDraft'

const ENTITY_OPTIONS = Object.values(GroupEntityType).map((value) => ({
  value,
  label: GROUP_ENTITY_TYPE_LABEL[value],
}))

/**
 * Labels — the groups that tag prices and features for reporting and filters.
 *
 * Labels are the console's name for the API's groups, so this reads and writes
 * the same records as the Groups pages. Creating one happens in a dialog on
 * this page: a label is three fields, and leaving Settings for a full page to
 * fill them in is a lot of navigation for very little form. The groups API has
 * no update route, so there is no edit here either — Open goes to the detail
 * page, which is where a group's members are managed.
 */
export function LabelsPanel({ onOpenPage }: { onOpenPage: (href: string) => void }) {
  const [isCreating, setIsCreating] = useState(false)
  const [deleting, setDeleting] = useState<Group | null>(null)

  const groups = useGroups({ ...DEFAULT_GROUP_QUERY, pageSize: 100 })
  const remove = useDeleteGroup()

  const failure = toFailure(groups.error, 'your labels')
  const rows = groups.data?.groups ?? []

  if (failure) {
    return (
      <WidePanel>
        <PanelError failure={failure} onRetry={() => void groups.refetch()} />
      </WidePanel>
    )
  }

  return (
    <WidePanel>
      <TableBlock
        title="Labels"
        description="Group prices and features so they can be filtered, reported and invoiced together."
        actions={
          <Button size="sm" onClick={() => setIsCreating(true)}>
            New label
          </Button>
        }
      >
        {groups.isPending ? (
          <LoadingRows rows={3} columns={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            size="inline"
            icon={<TagIcon aria-hidden />}
            title="No labels yet"
            description="A label collects prices or features under one name, like a product line or a region."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Lookup key</TableHead>
                <TableHead>Holds</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-px text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {group.lookupKey || '—'}
                  </TableCell>
                  <TableCell>{GROUP_ENTITY_TYPE_LABEL[group.entityType]}</TableCell>
                  <TableCell className="text-right tabular-nums">{group.entityCount}</TableCell>
                  <TableCell>{GROUP_STATUS_LABEL[group.status]}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(group.createdAt)}
                  </TableCell>
                  <TableCell className="w-px text-right whitespace-nowrap">
                    <span className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onOpenPage(`/groups/${group.id}`)}
                      >
                        Open
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(group)}>
                        Delete
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableBlock>

      <CreateLabelDialog
        open={isCreating}
        onOpenChange={(open) => {
          if (!open) setIsCreating(false)
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            remove.reset()
          }
        }}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete label'}
        description="The label is removed. The prices or features it held are not."
        confirmLabel="Delete"
        destructive
        isPending={remove.isPending}
        error={mutationMessage(remove.error, 'The label could not be deleted.')}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
      />
    </WidePanel>
  )
}

function CreateLabelDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateGroup()
  const draft = useDraft<CreateGroup>(createGroupSchema, emptyGroup())
  const busy = create.isPending
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      draft.reset(emptyGroup())
      create.reset()
    }
    wasOpen.current = open
  }, [open, draft, create])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New label</DialogTitle>
          <DialogDescription>
            A label holds prices or features, never both. What it holds is fixed once created.
          </DialogDescription>
        </DialogHeader>
        <form
          id="create-label"
          className="flex flex-col gap-4"
          noValidate
          onSubmit={draft.handleSubmit((value) =>
            create.mutate(value, { onSuccess: () => onOpenChange(false) }),
          )}
        >
          <Field
            label="Name"
            required
            hint="What the label is called when you pick it elsewhere."
            {...(draft.error('name') ? { error: draft.error('name') } : {})}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                autoFocus
                disabled={busy}
                value={draft.text('name')}
                onChange={(event) => draft.setText('name', event.target.value)}
                {...field}
              />
            )}
          </Field>

          <Field
            label="Lookup key"
            required
            hint="Stable identifier used by the API. Lowercase letters, numbers, hyphens and underscores."
            {...(draft.error('lookupKey') ? { error: draft.error('lookupKey') } : {})}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                disabled={busy}
                value={draft.text('lookupKey')}
                onChange={(event) => draft.setText('lookupKey', event.target.value)}
                {...field}
              />
            )}
          </Field>

          <Field
            label="Holds"
            required
            {...(draft.error('entityType') ? { error: draft.error('entityType') } : {})}
          >
            {({ id, ...field }) => (
              <OptionSelect
                id={id}
                {...field}
                value={draft.value.entityType}
                onValueChange={(value) =>
                  draft.update((current) => ({
                    ...current,
                    entityType: value as CreateGroup['entityType'],
                  }))
                }
                options={ENTITY_OPTIONS}
                disabled={busy}
              />
            )}
          </Field>

          <ActionError message={mutationMessage(create.error, 'It could not be created.')} />
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-label" disabled={busy}>
            {busy ? 'Creating…' : 'Create label'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

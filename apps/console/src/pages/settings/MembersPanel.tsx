import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_MEMBER_QUERY,
  type InviteMember,
  type Member,
  type Role,
  emptyInvite,
  inviteMemberSchema,
  memberDisplayName,
} from '@fp/domain'
import {
  useInviteMember,
  useRemoveMember,
  useRoles,
  useTeamMembers,
  useUpdateMemberRoles,
  useUserInfo,
} from '@fp/query'
import { ConfirmDialog, EmptyState, Field } from '@fp/ui/compositions'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@fp/ui/primitives'
import { UsersIcon } from 'lucide-react'
import { RoleList, RolePicker } from './RolePicker'
import {
  ActionError,
  PanelError,
  WidePanel,
  mutationMessage,
  toFailure,
  SettingsBlock,
  SettingsTable,
} from './panelKit'
import { useDraft } from './useDraft'

/**
 * The people in this organisation, and what each of them may do.
 *
 * ## Search and role narrowing are client-side, and the screen says so
 *
 * `POST /users/search` accepts `filters` and `roles` and **silently ignores
 * both**. Verified live: a `contains` filter came back with a row whose name
 * cannot match it. An accepted-and-ignored filter is worse than a rejected one
 * — the list looks filtered and is not — so neither is sent. `matchesMemberQuery`
 * narrows the page that arrived, which means the search reaches the rows on
 * screen and no further, and the caption under the box says exactly that
 * rather than letting someone conclude the organisation has one member named
 * "dana".
 *
 * ## Two columns that do not exist
 *
 * `UserResponse` carries no `created_at` and no `status`. So there is **no
 * "Joined" column** and **no pending/invited state** — an invited person is
 * indistinguishable from an accepted one in the payload, and a "Pending" badge
 * derived from nothing is a lie with a colour. When the API grows the fields,
 * the columns can follow.
 */
export function MembersPanel() {
  const [query] = useState({ ...DEFAULT_MEMBER_QUERY, pageSize: 100 })
  const [isInviting, setIsInviting] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)

  const members = useTeamMembers(query)
  const roles = useRoles('user')
  const me = useUserInfo()
  const remove = useRemoveMember()

  const failure = toFailure(members.error, 'the members list')
  const fetched = members.data?.members ?? []

  if (failure) {
    return (
      <WidePanel>
        <PanelError failure={failure} onRetry={() => void members.refetch()} />
      </WidePanel>
    )
  }

  return (
    <WidePanel>
      <SettingsTable<Member>
        label="Members"
        noun="members"
        hint="Everyone who can sign in to this organisation. Search covers the members loaded here."
        rows={fetched}
        isLoading={members.isPending}
        getRowId={(member) => member.id}
        action={
          <Button size="sm" onClick={() => setIsInviting(true)}>
            Invite member
          </Button>
        }
        empty={
          <EmptyState
            size="inline"
            icon={<UsersIcon aria-hidden />}
            title="No members yet"
            description="Invite someone and they can sign in to this organisation."
          />
        }
        columns={[
          {
            key: 'name',
            header: 'Name',
            sortBy: (member) => memberDisplayName(member),
            text: (member) => `${memberDisplayName(member)} ${member.email}`,
            cell: (member) => (
              <span className="flex items-center gap-2 font-medium">
                {memberDisplayName(member)}
                {member.id === me.data?.id ? <Badge variant="secondary">You</Badge> : null}
              </span>
            ),
          },
          {
            key: 'email',
            header: 'Email',
            sortBy: (member) => member.email,
            cell: (member) => <span className="text-muted-foreground">{member.email || '—'}</span>,
          },
          {
            key: 'roles',
            header: 'Roles',
            cell: (member) => <RoleList roles={member.roles} catalogue={roles.data ?? []} />,
          },
          {
            key: 'actions',
            header: '',
            width: 160,
            cell: (member) => (
              <span className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(member)}>
                  Edit roles
                </Button>
                {/*
                 * Removing yourself locks you out of the console with no way
                 * back in, so it is not offered. The API would allow it.
                 */}
                {member.id === me.data?.id ? null : (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(member)}>
                    Remove
                  </Button>
                )}
              </span>
            ),
          },
        ]}
      />

      {members.data && members.data.total > fetched.length ? (
        <p className="text-muted-foreground text-xs">
          Showing {fetched.length} of {members.data.total}.
        </p>
      ) : null}

      <InviteDialog
        open={isInviting}
        roles={roles.data ?? []}
        onOpenChange={(open) => {
          if (!open) setIsInviting(false)
        }}
      />

      {editing ? (
        <EditRolesSection
          member={editing}
          roles={roles.data ?? []}
          onDone={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
            remove.reset()
          }
        }}
        title={removing ? `Remove ${memberDisplayName(removing)}?` : 'Remove member'}
        description="They lose access to this organisation immediately. Inviting them again starts a new account."
        confirmLabel="Remove"
        destructive
        isPending={remove.isPending}
        error={mutationMessage(remove.error, 'The member could not be removed.')}
        onConfirm={() => {
          if (!removing) return
          remove.mutate(removing.id, {
            onSuccess: () => setRemoving(null),
          })
        }}
      />
    </WidePanel>
  )
}

/**
 * Inviting someone.
 *
 * The roles are chosen up front because the alternative is a two-step dance —
 * invite, then find them in the table, then edit — for something the create
 * call already accepts.
 */
function InviteDialog({
  open,
  roles,
  onOpenChange,
}: {
  open: boolean
  roles: Role[]
  onOpenChange: (open: boolean) => void
}) {
  const invite = useInviteMember()
  const draft = useDraft<InviteMember>(inviteMemberSchema, emptyInvite())
  const error = mutationMessage(invite.error, 'The invitation could not be sent.')
  const busy = invite.isPending
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      draft.reset(emptyInvite())
      invite.reset()
    }
    wasOpen.current = open
  }, [open, draft, invite])

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
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>They can sign in as soon as the account exists.</DialogDescription>
        </DialogHeader>
        <form
          id="invite-member"
          className="flex max-h-[min(24rem,50vh)] flex-col gap-4 overflow-y-auto"
          noValidate
          onSubmit={draft.handleSubmit((value) =>
            invite.mutate(value, { onSuccess: () => onOpenChange(false) }),
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              required
              {...(draft.error('email') ? { error: draft.error('email') } : {})}
            >
              {({ id, ...field }) => (
                <Input
                  id={id}
                  type="email"
                  autoFocus
                  placeholder="amara@northwind.example"
                  disabled={busy}
                  value={draft.text('email')}
                  onChange={(event) => draft.setText('email', event.target.value)}
                  {...field}
                />
              )}
            </Field>

            <Field label="Name" {...(draft.error('name') ? { error: draft.error('name') } : {})}>
              {({ id, ...field }) => (
                <Input
                  id={id}
                  placeholder="Amara Osei"
                  disabled={busy}
                  value={draft.text('name')}
                  onChange={(event) => draft.setText('name', event.target.value)}
                  {...field}
                />
              )}
            </Field>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Roles</span>
            <RolePicker
              label="Roles for the new member"
              roles={roles}
              selected={draft.value.roles ?? []}
              disabled={busy}
              onChange={(next) => draft.update((current) => ({ ...current, roles: next }))}
            />
          </div>

          <ActionError message={error} />
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
          <Button type="submit" form="invite-member" disabled={busy}>
            {busy ? 'Inviting…' : 'Send invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Changing one person's roles. `PUT /users/:id/roles` takes the whole set. */
function EditRolesSection({
  member,
  roles,
  onDone,
}: {
  member: Member
  roles: Role[]
  onDone: () => void
}) {
  const update = useUpdateMemberRoles()
  const [selected, setSelected] = useState<string[]>(member.roles)

  const error = mutationMessage(update.error, 'The roles could not be saved.')

  return (
    <SettingsBlock
      title={`Roles for ${memberDisplayName(member)}`}
      description="The whole set is replaced, so what is highlighted here is what they will hold."
    >
      <RolePicker
        label={`Roles for ${memberDisplayName(member)}`}
        roles={roles}
        selected={selected}
        disabled={update.isPending}
        onChange={setSelected}
      />

      <ActionError message={error} />

      <div className="flex items-center gap-3">
        <Button
          disabled={update.isPending}
          onClick={() => update.mutate({ id: member.id, roles: selected }, { onSuccess: onDone })}
        >
          {update.isPending ? 'Saving…' : 'Save roles'}
        </Button>
        <Button variant="ghost" disabled={update.isPending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </SettingsBlock>
  )
}

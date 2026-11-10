import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_MEMBER_QUERY,
  type InviteMember,
  type Member,
  type Role,
  emptyInvite,
  inviteMemberSchema,
  memberDisplayName,
  RBAC_ENTITY,
  SUPER_ADMIN_ROLE_ID,
  canEditMemberRoles,
  canRemoveMember,
} from '@fp/domain'
import {
  type PasswordLink,
  useCreatePasswordLink,
  useInviteMember,
  useRemoveMember,
  useRoles,
  useTeamMembers,
  useUpdateMemberRoles,
  useUserInfo,
} from '@fp/query'
import {
  ConfirmDialog,
  EmptyState,
  Field,
  FormDialog,
  WriteGate,
  useAccess,
} from '@fp/ui/compositions'
import { KeyRoundIcon, PencilIcon } from '@fp/ui/icons'
import { PasswordLinkDialog, RowActionsMenu } from '@fp/ui/pages'
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
import { useRegion } from '@/app/region'
import { passwordLinkUrl, passwordLinksAvailableFor } from '@/app/auth/passwordLink'
import { RoleList, RolePicker } from './RolePicker'
import {
  ActionError,
  PanelError,
  SettingsTable,
  WidePanel,
  mutationMessage,
  toFailure,
} from './panelKit'
import { useDraft } from './useDraft'

/**
 * Team: the people in this organisation, and what each of them may do.
 *
 * The section opens straight onto the table: the toolbar (search, Invite) is
 * the only thing above it.
 *
 * ## Search is client-side
 *
 * `POST /users/search` accepts `filters` and `roles` and **silently ignores
 * both**. Verified live: a `contains` filter came back with a row whose name
 * cannot match it. An accepted-and-ignored filter is worse than a rejected one
 *: the list looks filtered and is not: so neither is sent. Every member is
 * read instead (`useTeamMembers` pages through them all), so the table's own
 * search, sort and paging cover the whole team.
 *
 * ## Two columns that do not exist
 *
 * `UserResponse` carries no `created_at` and no `status`. So there is **no
 * "Joined" column** and **no pending/invited state**: an invited person is
 * indistinguishable from an accepted one in the payload, and a "Pending" badge
 * derived from nothing is a lie with a colour. When the API grows the fields,
 * the columns can follow.
 *
 * ## Passwords: a link on self-hosted, a one-time password on hosted
 *
 * A self-hosted deployment (no Supabase) never hands an admin a member's
 * password. An invitation answers with a one-time link, and "Reset password"
 * on a member's row makes another; the member sets their own password at it
 * (flexprice#3123). Hosted regions keep the one-time password on invite and
 * Supabase's own reset email, and offer no "Reset password" here.
 */
export function MembersPanel() {
  const [isInviting, setIsInviting] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [shared, setShared] = useState<SharedLink | null>(null)
  const { region } = useRegion()
  const selfHosted = passwordLinksAvailableFor(region)
  const createLink = useCreatePasswordLink()
  const [editing, setEditing] = useState<Member | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)

  const members = useTeamMembers(DEFAULT_MEMBER_QUERY)
  const roles = useRoles('user')
  const me = useUserInfo()
  const remove = useRemoveMember()
  const access = useAccess()
  // V1's rules: roles and removal are super-admin only, never on yourself, and
  // never the last member. Without them the column is not shown at all.
  const viewer = { id: me.data?.id ?? '', roles: access.isSuperAdmin ? [SUPER_ADMIN_ROLE_ID] : [] }
  const manages = access.isSuperAdmin

  const failure = toFailure(members.error, 'your team')
  const rows = members.data?.members ?? []

  if (failure) {
    return (
      <WidePanel>
        <PanelError failure={failure} onRetry={() => void members.refetch()} />
      </WidePanel>
    )
  }

  // Inviting needs user write (V1); disabled with the reason otherwise.
  const invite = (
    <WriteGate entity={RBAC_ENTITY.User}>
      <Button onClick={() => setIsInviting(true)}>Invite member</Button>
    </WriteGate>
  )

  return (
    <WidePanel>
      <SettingsTable<Member>
        label="Team"
        noun="members"
        hint="Everyone who can sign in to this organisation, and the roles they hold."
        rows={rows}
        isLoading={members.isPending}
        getRowId={(member) => member.id}
        action={invite}
        empty={
          <EmptyState
            size="inline"
            title="Nobody else is on your team yet"
            description={
              selfHosted
                ? 'Invite a teammate by email and choose their roles. You get a link to share, where they set their own password.'
                : 'Invite a teammate by email and choose their roles. You get a one-time password to share with them.'
            }
          />
        }
        columns={[
          {
            key: 'name',
            header: 'Name',
            sortBy: (member) => memberDisplayName(member),
            text: (member) => memberDisplayName(member),
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
            cell: (member) => (
              <span className="text-muted-foreground truncate">{member.email || '—'}</span>
            ),
          },
          {
            key: 'roles',
            header: 'Roles',
            text: (member) => member.roles.join(' '),
            cell: (member) => <RoleList roles={member.roles} catalogue={roles.data ?? []} />,
          },
          ...(manages
            ? [
                {
                  key: 'actions',
                  header: '',
                  width: 56,
                  cell: (member: Member) =>
                    canEditMemberRoles(member, viewer) ? (
                      <RowActionsMenu
                        label={memberDisplayName(member)}
                        extra={[
                          {
                            label: 'Edit roles',
                            icon: <PencilIcon aria-hidden className="size-4" />,
                            onSelect: () => setEditing(member),
                          },
                          // Self-hosted only: hosted members reset through
                          // Supabase's email, and the API refuses links there.
                          ...(selfHosted
                            ? [
                                {
                                  label: 'Reset password',
                                  icon: <KeyRoundIcon aria-hidden className="size-4" />,
                                  onSelect: () => {
                                    setShared({ member, link: null })
                                    createLink.reset()
                                    createLink.mutate(member.id, {
                                      onSuccess: (link) =>
                                        setShared((current) =>
                                          current?.member.id === member.id
                                            ? { member, link }
                                            : current,
                                        ),
                                    })
                                  },
                                },
                              ]
                            : []),
                        ]}
                        // Absent rather than disabled when this member cannot be
                        // removed (the last super admin, or yourself).
                        {...(canRemoveMember(member, viewer, rows.length)
                          ? { onRemove: () => setRemoving(member) }
                          : {})}
                        removeLabel="Remove from team"
                      />
                    ) : null,
                },
              ]
            : []),
        ]}
      />

      {members.data && members.data.total > rows.length ? (
        <p className="text-muted-foreground text-xs">
          Showing {rows.length} of {members.data.total}.
        </p>
      ) : null}

      <InviteDialog
        open={isInviting}
        roles={roles.data ?? []}
        selfHosted={selfHosted}
        onOpenChange={(open) => {
          if (!open) setIsInviting(false)
        }}
        onInvited={({ member, password, inviteLink }) => {
          setIsInviting(false)
          if (inviteLink) setShared({ member, link: inviteLink })
          else if (password) setCredentials({ email: member.email, password })
        }}
      />

      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />

      <PasswordLinkDialog
        member={
          shared ? { name: memberDisplayName(shared.member), email: shared.member.email } : null
        }
        link={
          shared?.link
            ? {
                url: passwordLinkUrl(shared.link.token),
                purpose: shared.link.purpose,
                expiry: formatExpiry(shared.link.expiresAt),
              }
            : null
        }
        isPending={createLink.isPending}
        error={mutationMessage(createLink.error, 'The link could not be created.')}
        onClose={() => {
          setShared(null)
          createLink.reset()
        }}
      />

      {editing ? (
        <EditRolesDialog
          key={editing.id}
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
 * The roles are chosen up front because the alternative is a two-step dance:
 * invite, then find them in the table, then edit: for something the create
 * call already accepts.
 */
function InviteDialog({
  open,
  roles,
  selfHosted,
  onOpenChange,
  onInvited,
}: {
  open: boolean
  roles: Role[]
  /** Self-hosted answers with an invite link; hosted with a one-time password. */
  selfHosted: boolean
  onOpenChange: (open: boolean) => void
  /** The invitation went through, with whichever of the two the API sent. */
  onInvited: (result: { member: Member; password: string; inviteLink: PasswordLink | null }) => void
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
          <DialogDescription>
            {selfHosted
              ? 'You get a link to share with them, where they set their own password.'
              : 'You get a one-time password to share with them, shown once.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="invite-member"
          className="flex max-h-[min(24rem,50vh)] flex-col gap-4 overflow-y-auto"
          noValidate
          onSubmit={draft.handleSubmit((value) =>
            invite.mutate(value, {
              onSuccess: (result) =>
                onInvited({
                  ...result,
                  member: { ...result.member, email: result.member.email || value.email },
                }),
            }),
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

interface Credentials {
  email: string
  password: string
}

/** A CSV cell, quoted when it holds a comma, quote or line break. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * The new member's one-time password, shown once.
 *
 * The API returns it on the invite and keeps no copy, so this is the only time
 * anyone sees it: it can be revealed, copied on its own or with the email, or
 * saved as a CSV to hand over.
 *
 * There is deliberately no sign-in link. A URL is not a private channel: it
 * lands in history, Referer headers, logs and chat link previews: so a link
 * carrying, or leading to, a working credential is never built here. (The
 * self-hosted set-password link is different in kind: it signs nobody in, it
 * works once, and its token rides in the fragment, which no server receives.)
 */
function CredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: Credentials | null
  onClose: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    if (credentials) {
      setRevealed(false)
      setCopied(null)
    }
  }, [credentials])
  if (!credentials) return null

  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text).then(() => setCopied(what))
  }
  const download = () => {
    const csv = `email,password\r\n${[credentials.email, credentials.password].map(csvCell).join(',')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `flexprice-credentials-${credentials.email.replace(/@.*/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'member'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share these sign-in details</DialogTitle>
          <DialogDescription>
            {credentials.email} signs in with this one-time password. It is shown only now, so copy
            it before you close this. They can change it after signing in.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="One-time password">
            {({ id, ...field }) => (
              <span className="flex gap-2">
                <Input
                  id={id}
                  readOnly
                  type={revealed ? 'text' : 'password'}
                  value={credentials.password}
                  className="font-mono"
                  {...field}
                />
                <Button type="button" variant="outline" onClick={() => setRevealed((v) => !v)}>
                  {revealed ? 'Hide' : 'Show'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copy(credentials.password, 'password')}
                >
                  {copied === 'password' ? 'Copied' : 'Copy'}
                </Button>
              </span>
            )}
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={download}>
            Download CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              copy(`Email: ${credentials.email}\nPassword: ${credentials.password}`, 'all')
            }
          >
            {copied === 'all' ? 'Copied' : 'Copy all'}
          </Button>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface SharedLink {
  member: Member
  /** null while it is being created. */
  link: PasswordLink | null
}

function formatExpiry(iso: string): string | null {
  const at = new Date(iso)
  if (!iso || Number.isNaN(at.getTime())) return null
  return at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Changing one person's roles, in a small dialog over the table rather than a
 * titled card under it. `PUT /users/:id/roles` takes the whole set, so what is
 * highlighted is exactly what they will hold.
 */
function EditRolesDialog({
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
  const name = memberDisplayName(member)

  return (
    <FormDialog
      open
      size="sm"
      title={`Roles for ${name}`}
      onOpenChange={(open) => {
        if (!open && !update.isPending) onDone()
      }}
    >
      <div className="flex flex-col gap-4">
        <RolePicker
          label={`Roles for ${name}`}
          roles={roles}
          selected={selected}
          disabled={update.isPending}
          onChange={setSelected}
        />

        <ActionError message={error} />

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" disabled={update.isPending} onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate({ id: member.id, roles: selected }, { onSuccess: onDone })}
          >
            {update.isPending ? 'Saving…' : 'Save roles'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}

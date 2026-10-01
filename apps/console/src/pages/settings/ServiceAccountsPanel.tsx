import { useEffect, useRef, useState } from 'react'
import {
  type CreateServiceAccount,
  DEFAULT_SERVICE_ACCOUNT_QUERY,
  type Member,
  type MemberQuery,
  type RenameMember,
  type Role,
  createServiceAccountSchema,
  emptyServiceAccount,
  matchesMemberQuery,
  memberDisplayName,
  renameMemberSchema,
} from '@fp/domain'
import {
  useCreateServiceAccount,
  useDeleteServiceAccount,
  useRenameServiceAccount,
  useRoles,
  useServiceAccounts,
} from '@fp/query'
import { ConfirmDialog, EmptyState, Field, LoadingRows } from '@fp/ui/compositions'
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
import { BotIcon } from 'lucide-react'
import { RoleList, RolePicker } from './RolePicker'
import { ActionError, PanelError, WidePanel, mutationMessage, toFailure, SettingsBlock } from './panelKit'
import { useDraft } from './useDraft'

/**
 * Service accounts — the identities that are not people.
 *
 * The same `/users` endpoints as Members, discriminated by `type`, which is
 * why the two tabs look alike. They differ in three ways that matter and are
 * reflected here: a service account has no email (the field is always empty on
 * the wire, so there is no column for it), it is *renamed* rather than having
 * its profile edited, and at least one role is required at creation — a
 * machine identity with no permissions can authenticate and then do nothing,
 * which is a confusing way to fail.
 *
 * Search is client-side for the same reason as Members: `POST /users/search`
 * accepts a filter and ignores it.
 */
export function ServiceAccountsPanel() {
  const [query, setQuery] = useState<MemberQuery>({
    ...DEFAULT_SERVICE_ACCOUNT_QUERY,
    pageSize: 100,
  })
  const [isCreating, setIsCreating] = useState(false)
  const [renaming, setRenaming] = useState<Member | null>(null)
  const [deleting, setDeleting] = useState<Member | null>(null)

  const accounts = useServiceAccounts(query)
  const roles = useRoles('service_account')
  const remove = useDeleteServiceAccount()

  const failure = toFailure(accounts.error, 'your service accounts')
  const fetched = accounts.data?.members ?? []
  const visible = fetched.filter((member) => matchesMemberQuery(member, query))
  const isFiltered = query.search.trim().length > 0

  if (failure) {
    return (
      <WidePanel>
        <PanelError failure={failure} onRetry={() => void accounts.refetch()} />
      </WidePanel>
    )
  }

  return (
    <WidePanel>
      <SettingsBlock
        title="Service accounts"
        description="Identities for your systems rather than your people. An API key is issued against one."
        actions={
          <Button size="sm" onClick={() => setIsCreating(true)}>
            New service account
          </Button>
        }
      >
        <div className="flex flex-col gap-1.5">
          <Input
            type="search"
            aria-label="Search service accounts"
            placeholder="Search by name"
            value={query.search}
            onChange={(event) => setQuery({ ...query, search: event.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Searches the {fetched.length} account{fetched.length === 1 ? '' : 's'} loaded here — the
            API ignores the search filter it accepts, so this narrows the page rather than the
            directory.
          </p>
        </div>

        {accounts.isPending ? (
          <LoadingRows rows={3} columns={3} />
        ) : visible.length === 0 ? (
          <EmptyState
            size="inline"
            icon={<BotIcon aria-hidden />}
            title={isFiltered ? 'No service account matches that' : 'No service accounts yet'}
            description={
              isFiltered
                ? 'Nothing in the loaded page matches. Clear the search to see them all.'
                : 'A service account is how a system of yours holds permissions without borrowing a person’s.'
            }
            isFiltered={isFiltered}
            {...(isFiltered
              ? {
                  onClearFilters: (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setQuery({ ...query, search: '' })}
                    >
                      Clear search
                    </Button>
                  ),
                }
              : {})}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead className="w-px text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{memberDisplayName(account)}</TableCell>
                  <TableCell>
                    <RoleList roles={account.roles} catalogue={roles.data ?? []} />
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {account.id}
                  </TableCell>
                  <TableCell className="w-px text-right whitespace-nowrap">
                    <span className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setRenaming(account)}>
                        Rename
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(account)}>
                        Delete
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SettingsBlock>

      <CreateAccountDialog
        open={isCreating}
        roles={roles.data ?? []}
        onOpenChange={(open) => {
          if (!open) setIsCreating(false)
        }}
      />

      {renaming ? <RenameSection account={renaming} onDone={() => setRenaming(null)} /> : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            remove.reset()
          }
        }}
        title={deleting ? `Delete ${memberDisplayName(deleting)}?` : 'Delete service account'}
        description="Any API key issued against it stops working immediately."
        confirmLabel="Delete"
        destructive
        isPending={remove.isPending}
        error={mutationMessage(remove.error, 'The service account could not be deleted.')}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
      />
    </WidePanel>
  )
}

function CreateAccountDialog({
  open,
  roles,
  onOpenChange,
}: {
  open: boolean
  roles: Role[]
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateServiceAccount()
  const draft = useDraft<CreateServiceAccount>(createServiceAccountSchema, emptyServiceAccount())
  const busy = create.isPending
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      draft.reset(emptyServiceAccount())
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
          <DialogTitle>New service account</DialogTitle>
          <DialogDescription>Give it only the roles the system actually needs.</DialogDescription>
        </DialogHeader>
        <form
          id="create-service-account"
          className="flex max-h-[min(24rem,50vh)] flex-col gap-4 overflow-y-auto"
          noValidate
          onSubmit={draft.handleSubmit((value) =>
            create.mutate(value, { onSuccess: () => onOpenChange(false) }),
          )}
        >
        <Field
          label="Name"
          required
          {...(draft.error('name') ? { error: draft.error('name') } : {})}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              autoFocus
              placeholder="usage-ingest"
              disabled={busy}
              value={draft.text('name')}
              onChange={(event) => draft.setText('name', event.target.value)}
              {...field}
            />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            Roles <span className="text-destructive">*</span>
          </span>
          <RolePicker
            label="Roles for the new service account"
            roles={roles}
            selected={draft.value.roles}
            disabled={busy}
            onChange={(next) => draft.update((current) => ({ ...current, roles: next }))}
          />
          {draft.error('roles') ? (
            <p role="alert" className="text-destructive text-sm">
              {draft.error('roles')}
            </p>
          ) : null}
        </div>

        <ActionError message={mutationMessage(create.error, 'It could not be created.')} />
      </form>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-service-account" disabled={busy}>
            {busy ? 'Creating…' : 'Create service account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Renaming, which is the only edit `PUT /users/:id` offers for a machine.
 *
 * Roles are changed through `PUT /users/:id/roles` like a person's, and that
 * is deliberately not folded in here: one form that silently issues two calls
 * can half-succeed, and "the name saved but the roles did not" is a state with
 * nowhere to put it.
 */
function RenameSection({ account, onDone }: { account: Member; onDone: () => void }) {
  const rename = useRenameServiceAccount()
  const draft = useDraft<RenameMember>(renameMemberSchema, { name: account.name })
  const busy = rename.isPending

  return (
    <SettingsBlock
      title={`Rename ${memberDisplayName(account)}`}
      description="Its roles and its keys are untouched."
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={draft.handleSubmit((value) =>
          rename.mutate({ id: account.id, name: value.name }, { onSuccess: onDone }),
        )}
      >
        <Field
          label="Name"
          required
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

        <ActionError message={mutationMessage(rename.error, 'The name could not be saved.')} />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save name'}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </SettingsBlock>
  )
}

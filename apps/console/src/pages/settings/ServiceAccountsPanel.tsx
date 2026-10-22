import { useEffect, useRef, useState } from 'react'
import {
  type CreateServiceAccount,
  DEFAULT_SERVICE_ACCOUNT_QUERY,
  type Member,
  type RenameMember,
  type Role,
  createServiceAccountSchema,
  emptyServiceAccount,
  memberDisplayName,
  renameMemberSchema,
  RBAC_ENTITY,
} from '@fp/domain'
import {
  useCreateServiceAccount,
  useDeleteServiceAccount,
  useRenameServiceAccount,
  useRoles,
  useServiceAccounts,
} from '@fp/query'
import { ConfirmDialog, Field, FormDialog, WriteGate } from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import { RoleList, RolePicker } from './RolePicker'
import {
  ActionError,
  PanelError,
  PanelActions,
  PanelFirstRun,
  SettingsTable,
  WidePanel,
  mutationMessage,
  toFailure,
} from './panelKit'
import { useDraft } from './useDraft'

const SERVICE_ACCOUNT_DOCS_URL = 'https://docs.flexprice.io/docs/rbac/service-accounts/create'

/**
 * Service accounts — the identities that are not people. Lives under
 * Developers (`/service-accounts`).
 *
 * The same `/users` endpoints as Team, discriminated by `type`, which is why
 * the two tables look alike. They differ in three ways that matter and are
 * reflected here: a service account has no email (the field is always empty on
 * the wire, so there is no column for it), it is *renamed* rather than having
 * its profile edited, and at least one role is required at creation — a
 * machine identity with no permissions can authenticate and then do nothing,
 * which is a confusing way to fail.
 *
 * Search is the table's own, client-side, for the same reason as Team:
 * `POST /users/search` accepts a filter and ignores it.
 */
export function ServiceAccountsPanel() {
  const [isCreating, setIsCreating] = useState(false)
  const [renaming, setRenaming] = useState<Member | null>(null)
  const [deleting, setDeleting] = useState<Member | null>(null)

  const accounts = useServiceAccounts({ ...DEFAULT_SERVICE_ACCOUNT_QUERY, pageSize: 100 })
  const roles = useRoles('service_account')
  const remove = useDeleteServiceAccount()

  const failure = toFailure(accounts.error, 'your service accounts')
  const rows = accounts.data?.members ?? []

  if (failure) {
    return (
      <WidePanel>
        <PanelError failure={failure} onRetry={() => void accounts.refetch()} />
      </WidePanel>
    )
  }

  // Laid out exactly as API keys' first run: the empty state centred in the
  // page body, under the same top-right create button the table has.
  const firstRun = !accounts.isPending && rows.length === 0

  return (
    <WidePanel fill={firstRun}>
      <h1 className="sr-only">Service accounts</h1>
      {firstRun ? (
        <>
          <PanelActions>
            <WriteGate entity={RBAC_ENTITY.User}>
              <Button onClick={() => setIsCreating(true)}>New service account</Button>
            </WriteGate>
          </PanelActions>
          <PanelFirstRun
            scene="developers"
            title="No service accounts yet"
            description="A service account lets one of your systems hold its own roles instead of borrowing a person’s. Create one, then issue it an API key."
            docsHref={SERVICE_ACCOUNT_DOCS_URL}
          />
        </>
      ) : (
        <SettingsTable<Member>
          label="Service accounts"
          noun="service accounts"
          hint="Identities for your systems rather than your people. An API key is issued against one."
          rows={rows}
          isLoading={accounts.isPending}
          getRowId={(account) => account.id}
          action={
            <WriteGate entity={RBAC_ENTITY.User}>
              <Button onClick={() => setIsCreating(true)}>New service account</Button>
            </WriteGate>
          }
          // First run is handled above; the table only ever renders with rows
          // or while loading.
          empty={null}
          columns={[
            {
              key: 'name',
              header: 'Name',
              sortBy: (account) => memberDisplayName(account),
              text: (account) => memberDisplayName(account),
              cell: (account) => <span className="font-medium">{memberDisplayName(account)}</span>,
            },
            {
              key: 'roles',
              header: 'Roles',
              text: (account) => account.roles.join(' '),
              cell: (account) => <RoleList roles={account.roles} catalogue={roles.data ?? []} />,
            },
            {
              key: 'id',
              header: 'Identifier',
              text: (account) => account.id,
              cell: (account) => (
                <span className="text-muted-foreground font-mono text-xs">{account.id}</span>
              ),
            },
            {
              key: 'actions',
              header: '',
              width: 160,
              cell: (account) => (
                // Managing service accounts needs user write (V1).
                <WriteGate entity={RBAC_ENTITY.User}>
                  <span className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setRenaming(account)}>
                      Rename
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(account)}>
                      Delete
                    </Button>
                  </span>
                </WriteGate>
              ),
            },
          ]}
        />
      )}

      <CreateAccountDialog
        open={isCreating}
        roles={roles.data ?? []}
        onOpenChange={(open) => {
          if (!open) setIsCreating(false)
        }}
      />

      {renaming ? (
        <RenameDialog key={renaming.id} account={renaming} onDone={() => setRenaming(null)} />
      ) : null}

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

/** Creating one, in a small dialog. Give it only the roles the system needs. */
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
    <FormDialog
      open={open}
      size="sm"
      title="New service account"
      onOpenChange={(next) => {
        if (!next && busy) return
        onOpenChange(next)
      }}
    >
      <form
        className="flex flex-col gap-4"
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

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create service account'}
          </Button>
        </div>
      </form>
    </FormDialog>
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
function RenameDialog({ account, onDone }: { account: Member; onDone: () => void }) {
  const rename = useRenameServiceAccount()
  const draft = useDraft<RenameMember>(renameMemberSchema, { name: account.name })
  const busy = rename.isPending

  return (
    <FormDialog
      open
      size="sm"
      title={`Rename ${memberDisplayName(account)}`}
      onOpenChange={(next) => {
        if (!next && !busy) onDone()
      }}
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
          hint="Its roles and its keys are untouched."
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

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save name'}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

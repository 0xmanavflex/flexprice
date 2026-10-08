import { useState } from 'react'
import { ENVIRONMENT_TYPE_LABEL, EnvironmentType, type Environment } from '@fp/domain'
import { useDeleteEnvironment, useEnvironmentList, useUpdateEnvironment } from '@fp/query'
import { ConfirmDialog, EmptyState } from '@fp/ui/compositions'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@fp/ui/primitives'
import { LayersIcon } from 'lucide-react'
import { env } from '@/env'
import { useSession } from '@/app/session'
import { EnvironmentFormPage } from '@/pages/environments/EnvironmentFormPage'
import {
  ActionError,
  PanelError,
  SettingsBlock,
  SettingsTable,
  WidePanel,
  mutationMessage,
  toFailure,
} from './panelKit'

/** The token the mocked build signs every request with — the same one `useEnvironments` uses. */
const MOCK_TOKEN = 'mock-session-token'

/**
 * The environments this token may work in: add, rename and delete, all here.
 *
 * Production reads green and a sandbox yellow, so the two are told apart at a
 * glance. Creating one opens the same dialog the switcher opens, and it keeps
 * the API's own failure sentence (a tenant limit is a real 400). The type is
 * fixed at creation; only the name is edited.
 */
export function EnvironmentsPanel() {
  const { session, environmentId, setEnvironmentId } = useSession()
  const token = env.apiKey ?? session?.token ?? (env.useMocks ? MOCK_TOKEN : null)

  const list = useEnvironmentList(token)
  const rename = useUpdateEnvironment(token)
  const remove = useDeleteEnvironment(token)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Environment | null>(null)
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<Environment | null>(null)

  const failure = toFailure(list.error, 'your environments')
  const environments = list.data ?? []

  if (!token) {
    return (
      <WidePanel>
        <SettingsBlock
          title="Environments"
          description="Sign in to see the environments you can work in."
        >
          <p className="text-muted-foreground text-sm">
            Environments belong to a session — there is nothing to list until one exists.
          </p>
        </SettingsBlock>
      </WidePanel>
    )
  }

  if (failure) {
    return (
      <WidePanel>
        <PanelError failure={failure} onRetry={() => void list.refetch()} />
      </WidePanel>
    )
  }

  const closeEditor = () => {
    setEditing(null)
    rename.reset()
  }

  return (
    <WidePanel>
      <SettingsTable<Environment>
        label="Environments"
        noun="environments"
        hint="Separate places to work. Production bills real customers; a sandbox charges nobody."
        rows={environments}
        isLoading={list.isPending}
        getRowId={(environment) => environment.id}
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            New environment
          </Button>
        }
        empty={
          <EmptyState
            size="inline"
            icon={<LayersIcon aria-hidden />}
            title="No environments"
            description="Every other call needs one, so the console cannot load data until this token can reach one."
          />
        }
        columns={[
          {
            key: 'name',
            header: 'Name',
            sortBy: (environment) => environment.name,
            text: (environment) => environment.name,
            cell: (environment) => <span className="font-medium">{environment.name}</span>,
          },
          {
            key: 'type',
            header: 'Type',
            text: (environment) => ENVIRONMENT_TYPE_LABEL[environment.type],
            cell: (environment) => (
              <Badge
                variant={
                  environment.type === EnvironmentType.Production
                    ? 'success-light'
                    : 'warning-light'
                }
              >
                {ENVIRONMENT_TYPE_LABEL[environment.type]}
              </Badge>
            ),
          },
          {
            key: 'id',
            header: 'Identifier',
            text: (environment) => environment.id,
            cell: (environment) => (
              <span className="text-muted-foreground font-mono text-xs">{environment.id}</span>
            ),
          },
          {
            key: 'actions',
            header: '',
            width: 160,
            cell: (environment) => (
              <span className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setName(environment.name)
                    setEditing(environment)
                  }}
                >
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(environment)}>
                  Delete
                </Button>
              </span>
            ),
          },
        ]}
      />

      <EnvironmentFormPage open={creating} onOpenChange={setCreating} />

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? undefined : closeEditor())}>
        <DialogContent className="sm:max-w-md">
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              const trimmed = name.trim()
              if (!editing || trimmed.length === 0) return
              rename.mutate({ id: editing.id, name: trimmed }, { onSuccess: closeEditor })
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit environment</DialogTitle>
            </DialogHeader>
            <Input
              aria-label="Name"
              autoFocus
              disabled={rename.isPending}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <ActionError message={mutationMessage(rename.error, 'The name could not be saved.')} />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={rename.isPending}
                onClick={closeEditor}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={rename.isPending || name.trim().length === 0}>
                {rename.isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            remove.reset()
          }
        }}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete environment'}
        description="Everything in this environment goes with it. This cannot be undone."
        confirmLabel="Delete"
        destructive
        isPending={remove.isPending}
        error={mutationMessage(remove.error, 'The environment could not be deleted.')}
        onConfirm={() => {
          if (!deleting) return
          const target = deleting
          remove.mutate(target.id, {
            onSuccess: () => {
              setDeleting(null)
              if (target.id === environmentId) {
                const next = environments.find((environment) => environment.id !== target.id)
                if (next) setEnvironmentId(next.id)
              }
            },
          })
        }}
      />
    </WidePanel>
  )
}

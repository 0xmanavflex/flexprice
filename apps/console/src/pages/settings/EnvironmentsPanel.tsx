import { useState } from 'react'
import {
  ENVIRONMENT_TYPE_DESCRIPTION,
  ENVIRONMENT_TYPE_LABEL,
  type CreateEnvironment,
  EnvironmentType,
} from '@fp/domain'
import { useCreateEnvironment, useEnvironmentList } from '@fp/query'
import { LoadingRows, Section } from '@fp/ui/compositions'
import { EnvironmentForm } from '@fp/ui/flexprice'
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fp/ui/primitives'
import { env } from '@/env'
import { useSession } from '@/app/session'
import { PanelError, WidePanel, mutationMessage, toFailure } from './panelKit'

/** The token the mocked build signs every request with — the same one `useEnvironments` uses. */
const MOCK_TOKEN = 'mock-session-token'

/**
 * The environments this token may work in, and a way to make another.
 *
 * ## The bug this panel exists partly to not repeat
 *
 * Creating an environment from the shell's switcher is a known open defect:
 * the dialog closes whether the call succeeded or failed, so hitting the
 * tenant limit — "You have reached the maximum limit of 2 development
 * environment(s)", a real 400 on the live tenant — looks exactly like success
 * until you notice the list did not grow. `EnvironmentForm` has taken
 * `isSubmitting` and `submitError` props all along; the switcher never passed
 * them.
 *
 * Here they are passed. The form stays open on failure with the API's own
 * sentence under it, and closes only once the list has actually gained a row.
 * The API's message is used verbatim rather than being mapped to a generic
 * one, because "maximum limit of 2 development environment(s)" tells the
 * reader the rule and the number, and no sentence written here could.
 */
export function EnvironmentsPanel() {
  const { session } = useSession()
  const token = env.apiKey ?? session?.token ?? (env.useMocks ? MOCK_TOKEN : null)

  const list = useEnvironmentList(token)
  const create = useCreateEnvironment(token)
  const [isCreating, setIsCreating] = useState(false)

  const failure = toFailure(list.error, 'your environments')
  const environments = list.data ?? []
  const createError = mutationMessage(create.error, 'The environment could not be created.')

  if (!token) {
    return (
      <WidePanel>
        <Section
          title="Environments"
          description="Sign in to see the environments you can work in."
        >
          <p className="text-muted-foreground text-sm">
            Environments belong to a session — there is nothing to list until one exists.
          </p>
        </Section>
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

  return (
    <WidePanel>
      <Section
        title="Environments"
        description="Separate places to work. Production bills real customers; a sandbox charges nobody."
        actions={
          isCreating ? null : (
            <Button size="sm" onClick={() => setIsCreating(true)}>
              New environment
            </Button>
          )
        }
      >
        {list.isPending ? (
          <LoadingRows rows={2} columns={3} />
        ) : environments.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            This token can reach no environments. Every other call needs one, so the console cannot
            load data until that is fixed.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Identifier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {environments.map((environment) => (
                <TableRow key={environment.id}>
                  <TableCell className="font-medium">{environment.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Badge
                        variant={
                          environment.type === EnvironmentType.Production
                            ? 'warning-light'
                            : 'secondary'
                        }
                      >
                        {ENVIRONMENT_TYPE_LABEL[environment.type]}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {ENVIRONMENT_TYPE_DESCRIPTION[environment.type]}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {environment.id}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      {isCreating ? (
        <Section
          title="New environment"
          description="A sandbox is the safe default. Production is real customers and real money."
        >
          <EnvironmentForm
            id="settings-create-environment"
            isSubmitting={create.isPending}
            submitError={createError}
            onSubmit={(draft: CreateEnvironment) =>
              create.mutate(draft, {
                // Closed only on success. A form that closes on failure is how
                // the switcher lost the tenant-limit error.
                onSuccess: () => {
                  setIsCreating(false)
                  create.reset()
                },
              })
            }
          />
          <div className="flex items-center gap-3">
            <Button type="submit" form="settings-create-environment" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create environment'}
            </Button>
            <Button
              variant="ghost"
              disabled={create.isPending}
              onClick={() => {
                setIsCreating(false)
                create.reset()
              }}
            >
              Cancel
            </Button>
          </div>
        </Section>
      ) : null}
    </WidePanel>
  )
}

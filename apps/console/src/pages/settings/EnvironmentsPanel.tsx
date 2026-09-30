import { useNavigate } from '@tanstack/react-router'
import { ENVIRONMENT_TYPE_DESCRIPTION, ENVIRONMENT_TYPE_LABEL, EnvironmentType } from '@fp/domain'
import { useEnvironmentList } from '@fp/query'
import { LoadingRows, Section } from '@fp/ui/compositions'
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
import { PanelError, WidePanel, toFailure } from './panelKit'

/** The token the mocked build signs every request with — the same one `useEnvironments` uses. */
const MOCK_TOKEN = 'mock-session-token'

/**
 * The environments this token may work in, and a way to make another.
 *
 * Creating one is the full page at `/environments/new` — the same page the
 * switcher opens — so there is one create flow, and it keeps the API's own
 * failure sentence (a tenant limit is a real 400) on screen.
 */
export function EnvironmentsPanel() {
  const { session } = useSession()
  const token = env.apiKey ?? session?.token ?? (env.useMocks ? MOCK_TOKEN : null)

  const list = useEnvironmentList(token)
  const navigate = useNavigate()

  const failure = toFailure(list.error, 'your environments')
  const environments = list.data ?? []

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
          <Button size="sm" onClick={() => void navigate({ to: '/environments/new' })}>
            New environment
          </Button>
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
    </WidePanel>
  )
}

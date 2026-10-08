import type { Role } from '@fp/domain'
import { grantsEverything, summarizePermissions } from '@fp/domain'
import { useRoles } from '@fp/query'
import { EmptyState } from '@fp/ui/compositions'
import { Badge } from '@fp/ui/primitives'
import { ShieldIcon } from 'lucide-react'
import { PanelError, SettingsTable, WidePanel, toFailure } from './panelKit'

/** One role and who may hold it. */
interface RoleRow {
  id: string
  role: Role
  forPeople: boolean
  forMachines: boolean
}

/**
 * The role catalogue, and what each role can actually do.
 *
 * Read-only, and that is the product, not a shortcut. Roles are defined by the
 * backend — `GET /rbac/roles` lists them and there is no create, update or
 * delete anywhere in the SDK — so the honest screen is a reference, not an
 * editor. Offering a disabled "New role" button here would suggest the
 * capability is switched off for this account rather than absent from the
 * product.
 *
 * Assignment is the part that *is* editable, and it happens where the person
 * is: Team, on the tab beside this one, or the service account's own page.
 *
 * Both audiences are in the one table, because a service account cannot hold
 * every role a person can (`all_writer` is filtered out of the service-account
 * list live) and a catalogue that showed only one of the two would be quietly
 * wrong about the other.
 */
export function RolesPanel() {
  const people = useRoles('user')
  const machines = useRoles('service_account')

  const failure = toFailure(people.error ?? machines.error, 'the role catalogue')

  if (failure) {
    return (
      <WidePanel>
        <PanelError
          failure={failure}
          onRetry={() => {
            void people.refetch()
            void machines.refetch()
          }}
        />
      </WidePanel>
    )
  }

  const peopleRoles = people.data ?? []
  const machineRoles = machines.data ?? []
  const rows: RoleRow[] = [
    ...peopleRoles.map((role) => ({
      id: role.id,
      role,
      forPeople: true,
      forMachines: machineRoles.some((other) => other.id === role.id),
    })),
    ...machineRoles
      .filter((role) => !peopleRoles.some((other) => other.id === role.id))
      .map((role) => ({ id: role.id, role, forPeople: false, forMachines: true })),
  ]

  return (
    <WidePanel>
      <SettingsTable<RoleRow>
        label="Roles & permissions"
        noun="roles"
        rows={rows}
        isLoading={people.isPending || machines.isPending}
        empty={
          <EmptyState
            size="inline"
            icon={<ShieldIcon aria-hidden />}
            title="No roles are defined for this account"
            description="Roles come from Flexprice itself, not from this screen. Once they exist you assign them to a person on the Team tab or to a service account under Developers."
          />
        }
        columns={[
          {
            key: 'name',
            header: 'Role',
            sortBy: (row) => row.role.name || row.id,
            text: (row) => `${row.role.name} ${row.role.description}`,
            cell: (row) => (
              <span className="flex flex-col">
                <span className="font-medium">{row.role.name || row.id}</span>
                <code className="text-muted-foreground text-xs">{row.id}</code>
              </span>
            ),
          },
          {
            key: 'permissions',
            header: 'Permissions',
            width: 420,
            text: (row) => summarizePermissions(row.role),
            cell: (row) =>
              grantsEverything(row.role) ? (
                <Badge variant="warning-light">Full access</Badge>
              ) : (
                <span
                  className="text-muted-foreground block truncate text-xs"
                  title={summarizePermissions(row.role)}
                >
                  {summarizePermissions(row.role)}
                </span>
              ),
          },
          {
            key: 'holders',
            header: 'Held by',
            text: (row) =>
              [row.forPeople ? 'People' : '', row.forMachines ? 'Service accounts' : ''].join(' '),
            cell: (row) => (
              <span className="flex flex-wrap gap-1.5">
                {row.forPeople ? <Badge variant="secondary">People</Badge> : null}
                {row.forMachines ? <Badge variant="secondary">Service accounts</Badge> : null}
              </span>
            ),
          },
        ]}
      />
    </WidePanel>
  )
}

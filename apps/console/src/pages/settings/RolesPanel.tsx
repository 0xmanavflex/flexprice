import type { Role } from '@fp/domain'
import { grantsEverything } from '@fp/domain'
import { useRoles } from '@fp/query'
import { LoadingRows } from '@fp/ui/compositions'
import { Badge } from '@fp/ui/primitives'
import { PanelError, WidePanel, toFailure, SettingsBlock } from './panelKit'

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
 * is: Members, on the tab beside this one. Saying so is the point of the
 * description — otherwise a reader concludes roles cannot be assigned at all.
 *
 * Both audiences are listed, because a service account cannot hold every role
 * a person can (`all_writer` is filtered out of the service-account list live)
 * and a catalogue that showed only one of the two would be quietly wrong on
 * the Service accounts tab.
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

  if (people.isPending || machines.isPending) {
    return (
      <WidePanel>
        <LoadingRows rows={4} columns={2} />
      </WidePanel>
    )
  }

  const peopleRoles = people.data ?? []
  const machineRoles = machines.data ?? []
  const machineOnly = machineRoles.filter(
    (role) => !peopleRoles.some((other) => other.id === role.id),
  )

  return (
    <WidePanel>
      <SettingsBlock
        title="Roles"
        description="Defined by Flexprice, not editable here. Assign them to a person under Members, or to a machine under Service accounts."
      >
        {peopleRoles.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            This account has no roles defined for people.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {peopleRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                forMachines={machineRoles.some((other) => other.id === role.id)}
              />
            ))}
          </div>
        )}
      </SettingsBlock>

      {machineOnly.length > 0 ? (
        <SettingsBlock
          title="Service-account roles"
          description="Roles a machine identity may hold but a person may not."
        >
          <div className="flex flex-col gap-4">
            {machineOnly.map((role) => (
              <RoleCard key={role.id} role={role} forMachines />
            ))}
          </div>
        </SettingsBlock>
      ) : null}
    </WidePanel>
  )
}

function RoleCard({ role, forMachines }: { role: Role; forMachines: boolean }) {
  const everything = grantsEverything(role)

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">{role.name || role.id}</h3>
        <code className="text-muted-foreground text-xs">{role.id}</code>
        {everything ? <Badge variant="warning-light">Full access</Badge> : null}
        {forMachines ? <Badge variant="secondary">Service accounts</Badge> : null}
      </div>

      {role.description ? (
        <p className="text-muted-foreground text-sm">{role.description}</p>
      ) : null}

      {everything ? (
        <p className="text-sm">Every action on every resource, including managing other members.</p>
      ) : role.permissions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No permissions are attached to this role.</p>
      ) : (
        <dl className="grid gap-2 sm:grid-cols-2">
          {role.permissions.map((permission) => (
            <div key={permission.resource} className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium">
                {permission.resource === '*' ? 'All resources' : permission.resource}
              </dt>
              <dd className="text-muted-foreground text-xs">
                {permission.actions.map((action) => (action === '*' ? 'all' : action)).join(', ')}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

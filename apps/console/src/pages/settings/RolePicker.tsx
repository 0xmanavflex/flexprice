import type { Role } from '@fp/domain'
import { SUPER_ADMIN_ROLE_ID, isRoleSelected, summarizePermissions, toggleRole } from '@fp/domain'
import { CheckboxRow } from '@fp/ui/compositions'

/**
 * Choosing roles, with the one rule the domain enforces made visible.
 *
 * `toggleRole` is not a plain set toggle: picking **super admin** replaces the
 * whole selection, and picking anything else drops super admin. That is the
 * domain's rule, not this component's, and the reason is that "super admin
 * plus event reader" is a sentence with no meaning: the first already grants
 * the second. So the control does not offer the combination and does not have
 * to explain afterwards why it was rejected.
 *
 * One checkbox row per role with a line saying what it grants (its own
 * description, else a summary of its permissions), so the choice can be made
 * without hovering for a tooltip.
 */
export interface RolePickerProps {
  roles: Role[]
  selected: string[]
  onChange: (roles: string[]) => void
  disabled?: boolean
  /** Names the group for assistive tech: "Roles for Dana", not just "Roles". */
  label: string
}

export function RolePicker({ roles, selected, onChange, disabled, label }: RolePickerProps) {
  if (roles.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No roles are defined for this account. Roles are created by the backend, not here.
      </p>
    )
  }

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      {roles.map((role) => (
        <CheckboxRow
          key={role.id}
          checked={isRoleSelected(selected, role.id)}
          disabled={disabled ?? false}
          onCheckedChange={() => onChange(toggleRole(selected, role.id))}
          description={
            role.id === SUPER_ADMIN_ROLE_ID
              ? 'Full access to everything. Replaces any other role.'
              : role.description || summarizePermissions(role)
          }
        >
          {role.name || role.id}
        </CheckboxRow>
      ))}
    </div>
  )
}

/** The roles a member holds, read-only, for a table cell. */
export function RoleList({ roles, catalogue }: { roles: string[]; catalogue: Role[] }) {
  if (roles.length === 0) return <span className="text-muted-foreground">None</span>

  const name = (id: string) => catalogue.find((role) => role.id === id)?.name || id

  return <span className="text-sm">{roles.map(name).join(', ')}</span>
}

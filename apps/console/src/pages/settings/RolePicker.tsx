import type { Role } from '@fp/domain'
import { SUPER_ADMIN_ROLE_ID, isRoleSelected, summarizePermissions, toggleRole } from '@fp/domain'
import { Button } from '@fp/ui/primitives'

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
 * Toggle buttons rather than checkboxes because `@fp/ui/primitives` exports
 * neither a checkbox nor a switch today (the files exist in the package; the
 * barrel does not re-export them). `aria-pressed` is the correct role for a
 * two-state button, so this loses nothing but the tick.
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
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {roles.map((role) => {
        const isSelected = isRoleSelected(selected, role.id)
        // Super admin is outlined in the warning tone when it is *not* held,
        // so the one button that grants everything does not look like the
        // other four.
        const emphasis =
          role.id === SUPER_ADMIN_ROLE_ID && !isSelected ? 'border-warning/40' : undefined

        return (
          <Button
            key={role.id}
            type="button"
            size="sm"
            variant={isSelected ? 'default' : 'outline'}
            aria-pressed={isSelected}
            disabled={disabled ?? false}
            title={summarizePermissions(role)}
            {...(emphasis ? { className: emphasis } : {})}
            onClick={() => onChange(toggleRole(selected, role.id))}
          >
            {role.name || role.id}
          </Button>
        )
      })}
    </div>
  )
}

/** The roles a member holds, read-only, for a table cell. */
export function RoleList({ roles, catalogue }: { roles: string[]; catalogue: Role[] }) {
  if (roles.length === 0) return <span className="text-muted-foreground">None</span>

  const name = (id: string) => catalogue.find((role) => role.id === id)?.name || id

  return <span className="text-sm">{roles.map(name).join(', ')}</span>
}

/**
 * RBAC roles: read-only, and one rule that has to live here.
 *
 * Roles are defined by the backend and can only be *assigned*: there is no
 * create, update or delete on `/rbac/roles`. Verified live, the five roles are
 * `super_admin`, `all_reader`, `all_writer`, `event_ingestor` and
 * `event_reader`, and the list is narrower for a service account than for a
 * person (`all_writer` is not offered to machines).
 *
 * The rule worth moving out of the UI is **super-admin exclusivity**. Super
 * admin grants `*: ['*']`, so holding it alongside `all_reader` is not a
 * stricter grant, it is the same grant with misleading extra chips. V1 enforces
 * this inside a role-picker component, which means the rule is unavailable to a
 * form that submits without the picker, to a test, and to anything that assigns
 * roles in bulk. Here it is a pure function over a role list.
 */

/** The role that subsumes every other. */
export const SUPER_ADMIN_ROLE_ID = 'super_admin'

/** One resource and the actions a role permits on it. `*` means "everything". */
export interface RolePermission {
  /** Resource name, or `*` for all resources. */
  resource: string
  /** `read`, `write`, or `*` for all actions. */
  actions: string[]
}

/** The read model the role picker and the permissions table render. */
export interface Role {
  id: string
  name: string
  description: string
  permissions: RolePermission[]
}

/** Which roles a principal of this kind may hold. The API filters the list. */
export const RoleAudience = {
  User: 'user',
  ServiceAccount: 'service_account',
} as const
export type RoleAudience = (typeof RoleAudience)[keyof typeof RoleAudience]

export function isSuperAdminRole(roleId: string): boolean {
  return roleId === SUPER_ADMIN_ROLE_ID
}

export function grantsEverything(role: Role): boolean {
  return role.permissions.some((p) => p.resource === '*' && p.actions.includes('*'))
}

/**
 * Settle a role selection so super admin is always exclusive.
 *
 * Total, and safe to apply to any list from any source: a picker, a form
 * default, a bulk assignment, a response being echoed back. Selecting super
 * admin clears everything else; it is the only role that can coexist with
 * nothing. Duplicates are removed and order is preserved.
 */
export function normalizeRoleSelection(roles: readonly string[]): string[] {
  if (roles.includes(SUPER_ADMIN_ROLE_ID)) return [SUPER_ADMIN_ROLE_ID]
  return [...new Set(roles)]
}

/**
 * Add or remove one role, keeping super admin exclusive.
 *
 * Selecting super admin clears every other role. Selecting any *other* role
 * while super admin is held replaces super admin rather than adding to it:
 * the alternative is a checkbox that appears to do nothing, because the
 * normalized result would drop what was just ticked.
 */
export function toggleRole(roles: readonly string[], roleId: string): string[] {
  if (roles.includes(roleId)) return roles.filter((r) => r !== roleId)
  if (isSuperAdminRole(roleId)) return [SUPER_ADMIN_ROLE_ID]
  return normalizeRoleSelection([...roles.filter((r) => !isSuperAdminRole(r)), roleId])
}

/**
 * Is this role selectable right now?
 *
 * Nothing is ever disabled: super admin is exclusive by *replacement*, not by
 * greying out the rest, so a person can always change their mind in one click.
 * Kept as a named function so a picker does not invent its own answer.
 */
export function isRoleSelected(roles: readonly string[], roleId: string): boolean {
  return roles.includes(roleId)
}

/** A short, human summary of what a role permits, for a picker's second line. */
export function summarizePermissions(role: Role): string {
  if (grantsEverything(role)) return 'Full access'
  if (role.permissions.length === 0) return 'No permissions'
  return role.permissions
    .map((p) => `${p.resource === '*' ? 'all' : p.resource}: ${p.actions.join(', ')}`)
    .join(' · ')
}

/**
 * Access control: what the signed-in principal may see and do in the console.
 *
 * Mirrors V1's `useCurrentUserPermissions` exactly, as pure functions. The
 * console only decides what to *show*; the API is the authority and refuses
 * anything a role does not grant, whatever the UI did.
 *
 * - A principal holds role ids (`GET /users/me`). Each role maps resources to
 *   actions (`GET /rbac/roles`). Access is the union across held roles.
 * - `*` as the resource matches every entity; `*` as an action matches every
 *   action.
 * - **Write does not imply read**, as in V1 and the backend. A route that a
 *   write-only role should reach asks for `['read', 'write']` (any of).
 * - An entity or role the catalogue does not know is denied.
 */
import { type Role, SUPER_ADMIN_ROLE_ID } from './role'

/** The backend's entities (`internal/types/rbac.go`), as V1 lists them. */
export const RBAC_ENTITY = {
  User: 'user',
  Environment: 'environment',
  Event: 'event',
  Meter: 'meter',
  Price: 'price',
  Customer: 'customer',
  Plan: 'plan',
  Addon: 'addon',
  Group: 'group',
  AlertSettings: 'alert_settings',
  Subscription: 'subscription',
  Wallet: 'wallet',
  Tenant: 'tenant',
  Invoice: 'invoice',
  Feature: 'feature',
  Entitlement: 'entitlement',
  CreditGrant: 'creditgrant',
  Payment: 'payment',
  Integration: 'integration',
  Task: 'task',
  Tax: 'tax',
  Secret: 'secret',
  Connection: 'connection',
  CostSheet: 'costsheet',
  CreditNote: 'creditnote',
  Coupon: 'coupon',
  Ai: 'ai',
  Portal: 'portal',
  Webhook: 'webhook',
  Cron: 'cron',
  Setting: 'setting',
  OAuth: 'oauth',
  CheckoutSession: 'checkoutsession',
  Workflow: 'workflow',
  FxRate: 'fxrate',
} as const
export type RbacEntity = (typeof RBAC_ENTITY)[keyof typeof RBAC_ENTITY]

export const RBAC_ACTION = { Read: 'read', Write: 'write' } as const
export type RbacAction = (typeof RBAC_ACTION)[keyof typeof RBAC_ACTION]

/** What a route or control needs: one entity, and one action or any of several. */
export interface AccessRequirement {
  entity: RbacEntity
  action: RbacAction | readonly RbacAction[]
  /** Also require super admin, as V1 does for tenant-wide settings. */
  superAdmin?: boolean
}

/** The resolved grants of a principal: role ids → resource → actions. */
export interface AccessGrants {
  roles: readonly string[]
  /** Only the held roles that the catalogue knows. */
  permissions: ReadonlyArray<Readonly<Record<string, readonly string[]>>>
}

/** Resolve a principal's held roles against the role catalogue. */
export function resolveGrants(
  roleIds: readonly string[],
  catalogue: readonly Role[],
): AccessGrants {
  const byId = new Map(catalogue.map((role) => [role.id, role]))
  const permissions = roleIds.flatMap((id) => {
    const role = byId.get(id)
    if (!role) return []
    const map: Record<string, string[]> = {}
    for (const permission of role.permissions) map[permission.resource] = [...permission.actions]
    return [map]
  })
  return { roles: [...roleIds], permissions }
}

function grants(actions: readonly string[] | undefined, action: RbacAction): boolean {
  return Boolean(actions && (actions.includes('*') || actions.includes(action)))
}

/** V1's `can(entity, action)`: any held role grants the action on the entity or on `*`. */
export function canAccess(grantsOf: AccessGrants, entity: RbacEntity, action: RbacAction): boolean {
  return grantsOf.permissions.some(
    (permissions) => grants(permissions['*'], action) || grants(permissions[entity], action),
  )
}

export function isSuperAdmin(roles: readonly string[]): boolean {
  return roles.includes(SUPER_ADMIN_ROLE_ID)
}

/** Whether a requirement is met: any of its actions, and super admin when asked for. */
export function meetsRequirement(grantsOf: AccessGrants, requirement: AccessRequirement): boolean {
  if (requirement.superAdmin && !isSuperAdmin(grantsOf.roles)) return false
  const actions: readonly RbacAction[] =
    typeof requirement.action === 'string' ? [requirement.action] : requirement.action
  return actions.some((action) => canAccess(grantsOf, requirement.entity, action))
}

/* ---- Members (V1 `memberUtils.ts`, `UsersSection.tsx`) ---------------------- */

/**
 * `PUT /users/{id}/roles` is super-admin only and refuses the caller's own
 * roles, so neither is offered.
 */
export function canEditMemberRoles(
  member: { id: string },
  viewer: { id: string; roles: readonly string[] },
): boolean {
  return isSuperAdmin(viewer.roles) && member.id !== viewer.id
}

/**
 * Removing a person is super-admin only, never yourself, and never the last
 * member of the tenant.
 */
export function canRemoveMember(
  member: { id: string },
  viewer: { id: string; roles: readonly string[] },
  memberCount: number,
): boolean {
  return canEditMemberRoles(member, viewer) && memberCount > 1
}

/** `DELETE /users/{id}` exists only for service accounts; people are removed instead. */
export function canDeleteMember(member: { type: string }): boolean {
  return member.type === 'service_account'
}

/** The sentence a disabled control gives as its reason, as V1's tooltips do. */
export function accessDeniedReason(requirement: Pick<AccessRequirement, 'superAdmin'>): string {
  return requirement.superAdmin
    ? 'Only a super admin can change this.'
    : 'Your role does not allow this. Ask an admin for access.'
}

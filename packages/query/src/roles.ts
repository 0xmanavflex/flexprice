import { useQuery } from '@tanstack/react-query'
import { call } from '@fp/api'
import { type Role, type RoleAudience, type RolePermission } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * RBAC roles. Read-only, because the API is.
 *
 * `GET /rbac/roles` and `GET /rbac/roles/{id}`. There is no create, update or
 * delete: roles are backend-defined and the console only assigns them.
 *
 * Two things about these two routes are unlike every other module here, and
 * both are the same cause: the SDK types them as `Promise<{[k: string]: any}>`
 * because the OpenAPI document gives them no response model:
 *
 *   - the responses are **not camelCased**. Everything else in this package
 *     reads `lookupKey`; these come back exactly as the server wrote them.
 *     The fields happen to be single words (`id`, `name`, `description`,
 *     `permissions`), so nothing is misspelled here today: but a field added
 *     upstream with two words will arrive snake_case, and this mapper is where
 *     that has to be handled rather than in a component.
 *   - the payloads are **wrapped**: the list is `{roles: [...]}`, not the
 *     `{items, pagination}` every search endpoint returns, and the detail is
 *     `{role: {...}}`. There is no pagination and no total.
 *
 * Verified live: five roles, `super_admin`, `all_reader`, `all_writer`,
 * `event_ingestor`, `event_reader`, and the service-account list omits
 * `all_writer`.
 */

/**
 * The wire shape. Permissions arrive as an object keyed by resource:
 * `{"*": ["*"]}` for super admin, `{"event": ["read"]}` for a scoped role:
 * which is convenient to store and awkward to render, so the mapper turns it
 * into a list.
 */
export interface RoleWire {
  id?: string | undefined
  name?: string | undefined
  description?: string | undefined
  permissions?: Record<string, string[]> | undefined
}

function toPermissions(permissions: Record<string, string[]> | undefined): RolePermission[] {
  if (!permissions || typeof permissions !== 'object') return []

  return (
    Object.entries(permissions)
      .map(([resource, actions]) => ({
        resource,
        actions: Array.isArray(actions) ? actions.filter((a) => typeof a === 'string') : [],
      }))
      // `*` first: the widest grant is the one a reader needs to see first.
      .sort((a, b) =>
        a.resource === '*' ? -1 : b.resource === '*' ? 1 : a.resource.localeCompare(b.resource),
      )
  )
}

export function toRole(wire: RoleWire): Role {
  return {
    id: wire.id ?? '',
    // A role with no display name falls back to its id, which is readable
    // enough (`event_reader`) to be better than "Untitled".
    name: wire.name ?? wire.id ?? '',
    description: wire.description ?? '',
    permissions: toPermissions(wire.permissions),
  }
}

/** Pull the `roles` array out of the list envelope, tolerating its absence. */
export function toRoleList(response: unknown): Role[] {
  const roles = (response as { roles?: unknown } | null)?.roles
  if (!Array.isArray(roles)) return []
  return roles.map((role) => toRole(role as RoleWire))
}

/** Pull the single role out of the `{role: {...}}` detail envelope. */
export function toRoleDetail(response: unknown): Role | null {
  const role = (response as { role?: unknown } | null)?.role
  if (!role || typeof role !== 'object') return null
  return toRole(role as RoleWire)
}

/**
 * The roles assignable to a principal of this kind.
 *
 * `audience` is a real server-side filter here: unlike the user search's
 * `roles`, this one is honoured: asking for `service_account` returned four
 * roles where the unfiltered list returned five. Passing it is what stops a
 * picker offering a machine a role it cannot hold.
 *
 * Roles change only on a backend deploy, so this is cached hard: a role picker
 * that refetches on every drawer open is spending a request on a list that has
 * not changed in months.
 */
export function useRoles(audience?: RoleAudience) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.roles.list({ ...(audience ? { audience } : {}) }),
    queryFn: async () => {
      const response = await call(() =>
        audience ? client.rbac.listRbacRoles(audience) : client.rbac.listRbacRoles(),
      )
      return toRoleList(response)
    },
    staleTime: 60 * 60 * 1000,
  })
}

/** One role, for a permissions detail view. Returns null if the API omits it. */
export function useRole(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.roles.detail(id),
    queryFn: async () => {
      const response = await call(() => client.rbac.getRbacRole(id))
      return toRoleDetail(response)
    },
    enabled: id.length > 0,
    staleTime: 60 * 60 * 1000,
  })
}

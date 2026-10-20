import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { call, type CurrentUser } from '@fp/api'
import {
  type AccessGrants,
  type AccessRequirement,
  type RbacAction,
  type RbacEntity,
  type Role,
  RoleAudience,
  canAccess,
  isSuperAdmin,
  meetsRequirement,
  resolveGrants,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import { toRoleList } from './roles'
import { useCurrentUser } from './session'

/**
 * What the signed-in principal may do, as V1's `useCurrentUserPermissions`.
 *
 * Held role ids come from `GET /users/me`; what each role grants comes from
 * `GET /rbac/roles?user_type=`. `can()` is V1's rule (`@fp/domain` `access`).
 *
 * Status matters as much as the answer, and is what keeps a page from
 * flashing "Access denied" before roles arrive:
 *
 * - `loading` — the user or the catalogue is not in yet. Callers wait.
 * - `ready` — answers are real.
 * - `error` — either read failed. Everything is denied (fail closed, as V1);
 *   the API would refuse anyway.
 * - `unrestricted` — no session token (a dev build signed in by API key).
 *   There is no principal to read, so the console shows everything and the
 *   API stays the judge.
 */
export type AccessStatus = 'loading' | 'ready' | 'error' | 'unrestricted'

export interface AccessControl {
  status: AccessStatus
  roles: readonly string[]
  isSuperAdmin: boolean
  can: (entity: RbacEntity, action: RbacAction) => boolean
  meets: (requirement: AccessRequirement) => boolean
}

const NO_GRANTS: AccessGrants = { roles: [], permissions: [] }

/** The pure part of the hook: status and answers from what has loaded. */
export function toAccessControl(input: {
  hasToken: boolean
  user: CurrentUser | undefined
  userFailed: boolean
  catalogue: readonly Role[] | undefined
  catalogueFailed: boolean
}): AccessControl {
  if (!input.hasToken) {
    return {
      status: 'unrestricted',
      roles: [],
      isSuperAdmin: false,
      can: () => true,
      meets: () => true,
    }
  }
  const status: AccessStatus =
    input.userFailed || input.catalogueFailed
      ? 'error'
      : input.user && input.catalogue
        ? 'ready'
        : 'loading'
  const grants =
    status === 'ready' && input.user && input.catalogue
      ? resolveGrants(input.user.roles, input.catalogue)
      : NO_GRANTS
  return {
    status,
    roles: grants.roles,
    isSuperAdmin: isSuperAdmin(grants.roles),
    can: (entity, action) => canAccess(grants, entity, action),
    meets: (requirement) => meetsRequirement(grants, requirement),
  }
}

export function useAccessControl(token: string | null): AccessControl {
  const client = useFlexprice()
  const user = useCurrentUser(token)
  const audience =
    user.data?.type === RoleAudience.ServiceAccount
      ? RoleAudience.ServiceAccount
      : RoleAudience.User
  const catalogue = useQuery({
    queryKey: queryKeys.session.accessRoles(token ?? '', audience),
    queryFn: async () => toRoleList(await call(() => client.rbac.listRbacRoles(audience))),
    enabled: Boolean(token) && Boolean(user.data),
    // V1 re-reads the catalogue every five minutes.
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  })

  // A background refetch that fails keeps the answers it had: only a first
  // read that fails is an error.
  const userFailed = user.isError && !user.data
  const catalogueFailed = catalogue.isError && !catalogue.data
  return useMemo(
    () =>
      toAccessControl({
        hasToken: Boolean(token),
        user: user.data,
        userFailed,
        catalogue: catalogue.data,
        catalogueFailed,
      }),
    [token, user.data, userFailed, catalogue.data, catalogueFailed],
  )
}

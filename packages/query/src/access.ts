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
  /** Read the user and the catalogue again, after an `error`. */
  retry: () => void
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
  retry?: () => void
}): AccessControl {
  const retry = input.retry ?? (() => undefined)
  if (!input.hasToken) {
    return {
      status: 'unrestricted',
      retry,
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
    retry,
    roles: grants.roles,
    isSuperAdmin: isSuperAdmin(grants.roles),
    can: (entity, action) => canAccess(grants, entity, action),
    meets: (requirement) => meetsRequirement(grants, requirement),
  }
}

/**
 * `environmentId` gates the catalogue read: `/rbac/roles` needs the
 * `X-Environment-ID` header, and before the shell has chosen an environment
 * (a fresh sign-in, a new tab) the request would go out without it and be
 * refused with a 403 — which read as "Access denied" until a reload. Access
 * stays `loading` until an environment is known.
 */
export function useAccessControl(
  token: string | null,
  { environmentId }: { environmentId: string | null },
): AccessControl {
  const client = useFlexprice()
  const user = useCurrentUser(token)
  const audience =
    user.data?.type === RoleAudience.ServiceAccount
      ? RoleAudience.ServiceAccount
      : RoleAudience.User
  const catalogue = useQuery({
    queryKey: queryKeys.session.accessRoles(token ?? '', audience),
    queryFn: async () => toRoleList(await call(() => client.rbac.listRbacRoles(audience))),
    // In parallel with `/users/me`, not after it: console sign-ins are people,
    // so the user catalogue is fetched straight away (switched only if the
    // principal turns out to be a service account). Waiting for the user first
    // would put two round trips in front of every gated page.
    enabled: Boolean(token) && Boolean(environmentId),
    // V1 re-reads the catalogue every five minutes.
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    // The client's default: a network or server failure is retried, a
    // refusal (403/401) is not.
  })

  // A background refetch that fails keeps the answers it had: only a first
  // read that fails is an error.
  const userFailed = user.isError && !user.data
  const catalogueFailed = catalogue.isError && !catalogue.data
  // `refetch` is stable per query; the flags decide what a retry re-reads.
  const refetchUser = user.refetch
  const refetchCatalogue = catalogue.refetch
  return useMemo(
    () =>
      toAccessControl({
        hasToken: Boolean(token),
        user: user.data,
        userFailed,
        catalogue: catalogue.data,
        catalogueFailed,
        retry: () => {
          if (userFailed) void refetchUser()
          void refetchCatalogue()
        },
      }),
    [token, user.data, userFailed, catalogue.data, catalogueFailed, refetchUser, refetchCatalogue],
  )
}

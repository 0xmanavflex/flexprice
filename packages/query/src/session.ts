import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  ApiError,
  ErrorKind,
  type CurrentUser,
  type EnvironmentRecord,
  type SessionCredentials,
  createEnvironment,
  fetchCurrentUser,
  fetchEnvironments,
  signIn,
} from '@fp/api'
import { EnvironmentType, type CreateEnvironment, type Environment } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceServerURL } from './provider'

/**
 * The session, through the same door as everything else.
 *
 * Sign-in is a mutation and not a query because it is an exchange: an email
 * and a password go out, a token comes back, and nothing about it should be
 * cached, retried or refetched on focus. Who the token belongs to, and which
 * environments it can act in, are queries — they answer the same way every
 * time until the token changes.
 *
 * Both reads are keyed by the token rather than by nothing. A signed-out user
 * and a differently-signed-in user must not read each other's cache entry, and
 * keying on the token makes that structural instead of a `clear()` someone has
 * to remember to call.
 */

export type { CurrentUser, SessionCredentials } from '@fp/api'

/** A token-taking hook's guard: no token, no request, no error, no spinner. */
function enabledFor(token: string | null): boolean {
  return typeof token === 'string' && token.length > 0
}

export function useSignIn() {
  const serverURL = useFlexpriceServerURL()

  return useMutation<SessionCredentials, Error, { email: string; password: string }>({
    mutationFn: ({ email, password }) => signIn(serverURL, email, password),
  })
}

export function useCurrentUser(token: string | null): UseQueryResult<CurrentUser> {
  const serverURL = useFlexpriceServerURL()

  return useQuery({
    queryKey: [...queryKeys.session.current(), token],
    queryFn: () => fetchCurrentUser(serverURL, token as string),
    enabled: enabledFor(token),
    // A signed-in user's identity does not change while they look at a grid.
    staleTime: 5 * 60_000,
  })
}

/**
 * Wire `type` to the domain enum.
 *
 * An unrecognised type is treated as a sandbox deliberately: the failure mode
 * of mislabelling production as a sandbox is a scary-looking badge, and the
 * failure mode of the reverse is someone editing live pricing believing they
 * are not.
 */
export function toEnvironment(record: EnvironmentRecord): Environment {
  return {
    id: record.id,
    name: record.name,
    type: record.type === EnvironmentType.Production ? EnvironmentType.Production : EnvironmentType.Sandbox,
  }
}

export function useEnvironmentList(token: string | null): UseQueryResult<Environment[]> {
  const serverURL = useFlexpriceServerURL()

  return useQuery({
    queryKey: [...queryKeys.session.environments(), token],
    queryFn: async () => (await fetchEnvironments(serverURL, token as string)).map(toEnvironment),
    enabled: enabledFor(token),
    staleTime: 5 * 60_000,
  })
}

/**
 * Creates an environment, then makes the list say so.
 *
 * `POST /environments` is as undocumented as the list it adds to, and lives in
 * `@fp/api`'s `session.ts` for the same reason — see the note there, and
 * `docs/api-contract-gap.md`. It is a real route: the hosted API answers a
 * malformed-by-quota create with a `validation_error` naming the tenant's
 * per-type limit, which is a handler that ran.
 *
 * The success path invalidates the list rather than writing the new row into
 * the cache. A tenant's environments are subject to server-side quotas and
 * defaulting the console cannot see, so the list the server returns after a
 * create is worth more than the one this layer could assemble.
 *
 * Errors are not swallowed. "You have reached the maximum limit of 2
 * development environment(s)" is the most useful sentence the API has to offer
 * at that moment, and it arrives as an `ApiError` the caller can render.
 */
export function useCreateEnvironment(
  token: string | null,
): UseMutationResult<Environment, Error, CreateEnvironment> {
  const serverURL = useFlexpriceServerURL()
  const queryClient = useQueryClient()

  return useMutation<Environment, Error, CreateEnvironment>({
    mutationFn: async (draft) => {
      if (!enabledFor(token)) {
        // Reached only by a caller that renders the create dialog while signed
        // out. Failing here beats sending `Bearer null` and reading a 401 back
        // as though the name were wrong.
        throw new ApiError(ErrorKind.Unauthorized, 'Sign in to create an environment.')
      }
      return toEnvironment(await createEnvironment(serverURL, token as string, draft))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.environments() })
    },
  })
}

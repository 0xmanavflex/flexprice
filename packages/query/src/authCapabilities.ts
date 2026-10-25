import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { PASSWORD_ONLY, fetchAuthCapabilities, type AuthCapabilities } from '@fp/api'
import { queryKeys } from './keys'
import { useFlexpriceServerURL } from './provider'

export type { AuthCapabilities, AuthProviderId } from '@fp/api'
export { PASSWORD_ONLY } from '@fp/api'

/**
 * What this deployment offers at sign-in.
 *
 * Keyed by server URL, not by nothing: the region picker can point the console
 * at the other hosted API without a reload, and the two regions are separate
 * deployments that may answer differently. A single cache entry would show one
 * region's methods on the other's sign-in screen.
 *
 * Three settings that are not the usual defaults, each for a reason:
 *
 *   - **`retry: false`.** `fetchAuthCapabilities` already resolves rather than
 *     rejects, so there is no rejection to retry: a retry policy here would be
 *     dead configuration that reads as though it does something.
 *   - **`placeholderData: PASSWORD_ONLY`.** The sign-in form must render on the
 *     first frame. Waiting for this answer would put a spinner in front of a
 *     password field that always works, which is a slower sign-in in exchange
 *     for nothing.
 *   - **A long `staleTime`.** A deployment does not change which identity
 *     provider it runs while someone is typing their password.
 *
 * Callers therefore never need to branch on `isLoading` or `isError`: `data` is
 * always a usable `AuthCapabilities`, and the worst case is password-only.
 */
export function useAuthCapabilities(): UseQueryResult<AuthCapabilities> {
  const serverURL = useFlexpriceServerURL()

  return useQuery({
    queryKey: queryKeys.session.capabilities(serverURL),
    queryFn: () => fetchAuthCapabilities(serverURL),
    placeholderData: PASSWORD_ONLY,
    retry: false,
    staleTime: 10 * 60_000,
  })
}

/** The capabilities, never undefined: the shape pages actually want. */
export function useAuthCapabilitiesValue(): AuthCapabilities {
  return useAuthCapabilities().data ?? PASSWORD_ONLY
}

import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ApiError,
  ErrorKind,
  changeOwnPassword,
  checkPasswordLink,
  createPasswordLink,
  setPasswordWithLink,
} from '@fp/api'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * One-time password links (self-hosted). The wire calls and the flow are
 * described in `@fp/api`'s `passwordLinks.ts`.
 */

async function requireToken(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken()
  if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in first.')
  return token
}

/**
 * A link for a member to set their password: `POST /users/{id}/password-link`.
 * Nothing is cached: each call mints a new link, and none is ever re-shown.
 */
export function useCreatePasswordLink() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useMutation({
    mutationFn: async (userId: string) =>
      createPasswordLink(
        serverURL,
        await requireToken(auth.getToken),
        (await auth.getEnvironmentId()) ?? '',
        userId,
      ),
  })
}

/** Change the signed-in member's own password: `PUT /users/me/password`. */
export function useChangeOwnPassword() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useMutation({
    mutationFn: async (password: string) =>
      changeOwnPassword(
        serverURL,
        await requireToken(auth.getToken),
        (await auth.getEnvironmentId()) ?? '',
        password,
      ),
  })
}

/**
 * What a link is for, read before the form is shown: `POST /auth/password/check`.
 *
 * Not retried: a spent or expired link answers 404, and asking again cannot
 * change that. Never refetched: setting the password spends the link, and a
 * refetch after that would replace the success screen with "expired".
 */
export function usePasswordLinkDetails(linkToken: string | null) {
  const serverURL = useFlexpriceServerURL()

  return useQuery({
    queryKey: queryKeys.session.passwordLink(serverURL, linkToken ?? ''),
    queryFn: () => checkPasswordLink(serverURL, linkToken ?? ''),
    enabled: Boolean(linkToken),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/** Set a password through a link: `POST /auth/password`. */
export function useSetPasswordWithLink() {
  const serverURL = useFlexpriceServerURL()

  return useMutation({
    mutationFn: ({ linkToken, password }: { linkToken: string; password: string }) =>
      setPasswordWithLink(serverURL, linkToken, password),
  })
}

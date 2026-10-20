import { useCallback } from 'react'
import { ApiError, ErrorKind, fetchSupportChatToken } from '@fp/api'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * A fetcher for the support chat's identity hash — `POST /users/chat/verify`.
 *
 * A function rather than a query, as V1 has it: the widget asks once, when it
 * boots, and the hash is handed straight to it. Resolves to the hash, or to an
 * empty string when the API sends none.
 */
export function useFetchSupportChatHash(environmentId: string | null): () => Promise<string> {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useCallback(async () => {
    const token = await auth.getToken()
    if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to use support chat.')
    const response = await fetchSupportChatToken(serverURL, token, environmentId ?? '')
    return response.token ?? ''
  }, [auth, serverURL, environmentId])
}

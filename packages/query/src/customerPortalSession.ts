import { useMutation } from '@tanstack/react-query'
import { ApiError, ErrorKind, createCustomerPortalSession } from '@fp/api'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Mints a customer portal session for one customer, by external id — what
 * "Open customer portal" and "Copy portal link" need. Resolves the session
 * token; the app turns it into a link to its portal surface.
 */
export function useCreateCustomerPortalSession() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useMutation({
    mutationFn: async (externalId: string) => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to open the customer portal.')
      if (!environmentId) throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
      const session = await createCustomerPortalSession(serverURL, token, environmentId, externalId)
      if (!session.token) throw new ApiError(ErrorKind.Unknown, 'Flexprice did not return a portal session.')
      return session
    },
  })
}

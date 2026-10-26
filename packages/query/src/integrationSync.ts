import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, pushToIntegrations } from '@fp/api'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Push a customer to the providers that sync customers outbound: V1's
 * "Push to Integration". A push can create the provider record, which the
 * backend maps back, so the customer's integration marks are refreshed.
 */
export function usePushCustomerToIntegrations(customerId: string) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to push this customer.')
      if (!environmentId) throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
      await pushToIntegrations(serverURL, token, environmentId, {
        entityType: 'customer',
        entityId: customerId,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrationLinks.forCustomer(customerId),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() })
    },
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, createCustomerSetupIntent, pushToIntegrations } from '@fp/api'
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
    mutationFn: async (connectionId?: string) => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to push this customer.')
      if (!environmentId) throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
      await pushToIntegrations(serverURL, token, environmentId, {
        entityType: 'customer',
        entityId: customerId,
        ...(connectionId ? { connectionId } : {}),
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

/**
 * Start saving a card for a customer at one connected provider (V1's "Save
 * card"). Resolves to the provider's hosted setup page; nothing is saved until
 * the card is entered there, so no cache is invalidated here.
 */
export function useAddCustomerCard(customerId: string) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useMutation({
    mutationFn: async (input: { provider: string; returnUrl: string; setDefault: boolean }) => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to add a card.')
      if (!environmentId) throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
      const { checkoutUrl } = await createCustomerSetupIntent(
        serverURL,
        token,
        environmentId,
        customerId,
        {
          provider: input.provider,
          successUrl: input.returnUrl,
          cancelUrl: input.returnUrl,
          setDefault: input.setDefault,
        },
      )
      if (!checkoutUrl)
        throw new ApiError(ErrorKind.Server, 'The provider did not return a setup link.')
      return checkoutUrl
    },
  })
}

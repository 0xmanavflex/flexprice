import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError, ErrorKind, fetchInvoiceHostedLink } from '@fp/api'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Resolves one invoice's customer-facing link on demand: what "Open hosted
 * invoice" and "Copy hosted invoice link" need. Null when the invoice has none.
 */
export function useInvoiceHostedLink() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to open the hosted invoice.')
      if (!environmentId) throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
      return fetchInvoiceHostedLink(serverURL, token, environmentId, invoiceId)
    },
  })
}

/**
 * The invoice page's hosted link, read beside `useInvoice`. Keyed under the
 * invoice's detail key, so finalizing: which issues the link and invalidates
 * the detail: refreshes it too. Null when the invoice has none.
 */
export function useInvoiceHostedUrl(invoiceId: string, options: { enabled?: boolean } = {}) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useQuery({
    enabled: (options.enabled ?? true) && invoiceId !== '',
    queryKey: [...queryKeys.invoices.detail(invoiceId), 'hostedUrl'],
    queryFn: async () => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token || !environmentId) return null
      return fetchInvoiceHostedLink(serverURL, token, environmentId, invoiceId)
    },
  })
}

import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getHostedInvoice, getHostedInvoiceDownload, payHostedInvoice } from '@fp/api'
import { type HostedInvoice, toHostedInvoice, toPaymentActionUrl, toPresignedUrl } from '@fp/domain'
import { queryKeys } from './keys'

/**
 * The hosted invoice page's data, read with the token from the link: never
 * the console session, so none of these hooks needs `FlexpriceProvider`.
 */

export function useHostedInvoice(
  apiOrigin: string,
  token: string,
): { data: HostedInvoice | undefined; error: unknown; isPending: boolean; refetch: () => void } {
  const query = useQuery({
    queryKey: queryKeys.hostedInvoice.detail(apiOrigin, token),
    queryFn: async () => toHostedInvoice(await getHostedInvoice(apiOrigin, token)),
    // A customer coming back from the gateway's tab sees the payment land.
    refetchOnWindowFocus: true,
    // The page has no error boundary: every failure is rendered by the page itself.
    throwOnError: false,
  })
  return {
    data: query.data,
    error: query.error,
    isPending: query.isPending,
    refetch: () => void query.refetch(),
  }
}

/** Resolves a fresh PDF URL; each one lasts an hour. */
export function useHostedInvoiceDownload(
  apiOrigin: string,
  token: string,
): { download: () => Promise<string | null>; isPending: boolean; error: unknown } {
  const mutation = useMutation({
    mutationFn: async () => toPresignedUrl(await getHostedInvoiceDownload(apiOrigin, token)),
  })
  return {
    download: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
    error: mutation.error,
  }
}

/**
 * Starts a payment and resolves the gateway checkout URL.
 *
 * One idempotency key per attempt: a retry after a failure sends the same key,
 * so the backend answers with the payment it may already have made.
 */
export function usePayHostedInvoice(
  apiOrigin: string,
  token: string,
): { pay: () => Promise<string | null>; isPending: boolean; error: unknown } {
  const queryClient = useQueryClient()
  const key = useRef<string | null>(null)
  const mutation = useMutation({
    mutationFn: async () => {
      key.current ??= crypto.randomUUID()
      return toPaymentActionUrl(await payHostedInvoice(apiOrigin, token, key.current))
    },
    onSuccess: (url) => {
      key.current = null
      if (url === null) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.hostedInvoice.detail(apiOrigin, token),
        })
      }
    },
  })
  return { pay: () => mutation.mutateAsync(), isPending: mutation.isPending, error: mutation.error }
}

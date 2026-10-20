import { useMutation } from '@tanstack/react-query'
import { ApiError, ErrorKind, generateSampleEvents } from '@fp/api'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/** How long the backend streams sample events for, as V1 asks. */
export const SAMPLE_EVENT_DURATION_SECONDS = 60

/**
 * Starts the backend streaming sample usage events for one subscription.
 *
 * Resolves when the backend has accepted the request, not when the events
 * have landed: they arrive through ingestion over the next minute, so there is
 * nothing to invalidate yet. The Events debugger shows them as they come in.
 */
export function useGenerateSampleEvents() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to stream events.')
      if (!environmentId) throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
      return generateSampleEvents(serverURL, token, environmentId, {
        subscriptionId,
        durationSeconds: SAMPLE_EVENT_DURATION_SECONDS,
      })
    },
  })
}

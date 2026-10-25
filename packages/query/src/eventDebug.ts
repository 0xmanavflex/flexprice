import { useQuery } from '@tanstack/react-query'
import { ApiError, ErrorKind, fetchEventDebug } from '@fp/api'
import { type EventDebug, type RawEvent, toEventDebug } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Why one event did or did not bill.
 *
 * Read only when a sheet is open on an event, never for a list: the lookup
 * walks five stages server-side and is far heavier than the row it explains.
 *
 * The window is taken from the event's own timestamp, widened by a day each
 * way. Without it the backend searches the last fortnight and answers 404 for
 * anything older, which would make the debugger useless for exactly the
 * events people go looking for.
 */
const DAY_MS = 24 * 60 * 60 * 1000

export function useEventDebug(event: RawEvent | null): {
  data: EventDebug | undefined
  isPending: boolean
  error: unknown
  refetch: () => void
} {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  // Both are required by the route; an event missing either cannot be traced.
  const eventId = event?.id ?? ''
  const externalCustomerId = event?.externalCustomerId ?? ''
  const at = event?.timestamp?.getTime()

  const query = useQuery({
    queryKey: queryKeys.events.debug(eventId, externalCustomerId),
    queryFn: async (): Promise<EventDebug> => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to trace an event.')
      const body = await fetchEventDebug(serverURL, token, environmentId ?? '', {
        eventId,
        externalCustomerId,
        ...(at
          ? {
              startTime: new Date(at - DAY_MS).toISOString(),
              endTime: new Date(at + DAY_MS).toISOString(),
            }
          : {}),
      })
      return toEventDebug(body)
    },
    enabled: eventId !== '' && externalCustomerId !== '',
    staleTime: 60_000,
    // A trace is a point-in-time answer about a stored event; re-running it
    // because a window regained focus tells nobody anything new.
    refetchOnWindowFocus: false,
  })

  return {
    data: query.data,
    isPending: query.isPending && eventId !== '' && externalCustomerId !== '',
    error: query.error,
    refetch: () => void query.refetch(),
  }
}

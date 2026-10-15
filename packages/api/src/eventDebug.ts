import { request } from './settings'

/**
 * `GET /events/lookup` — every stage an ingested event went through.
 *
 * Absent from the SDK, so this speaks `fetch` directly like its neighbours.
 * Two things about the route are not guessable and were checked live:
 *
 *   - the event id is a **query parameter**, not a path segment, because an
 *     event id may contain `/` and a path would truncate it;
 *   - `external_customer_id` is required. The events table is keyed by it, so
 *     an id-only lookup has no sort key to seek on and the backend refuses.
 *
 * The window matters too: with no `start_time`/`end_time` the backend looks
 * back a fortnight and answers 404 for anything older, naming the window it
 * tried in the error. Callers pass the event's own timestamp so that an event
 * found in the list can always be traced.
 */
export interface EventDebugParams {
  eventId: string
  externalCustomerId: string
  /** ISO 8601. Widen the window to cover the event being looked up. */
  startTime?: string | undefined
  endTime?: string | undefined
}

export async function fetchEventDebug(
  serverURL: string,
  token: string,
  environmentId: string,
  params: EventDebugParams,
): Promise<unknown> {
  const search = new URLSearchParams({
    id: params.eventId,
    external_customer_id: params.externalCustomerId,
  })
  if (params.startTime) search.set('start_time', params.startTime)
  if (params.endTime) search.set('end_time', params.endTime)
  return request(serverURL, `/events/lookup?${search.toString()}`, {
    method: 'GET',
    token,
    environmentId,
  })
}

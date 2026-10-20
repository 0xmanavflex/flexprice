import { request } from './settings'

/**
 * `POST /portal/onboarding/events`.
 *
 * Asks the backend to generate sample usage events for one subscription over
 * `duration` seconds. The console sends no events itself: the backend decides
 * which events, how many and with what properties. Not in `@flexprice/sdk`.
 *
 * This is V1's "stream events" (`EventsApi.fireEvents`): one request, and the
 * events then land through normal ingestion over the following minute.
 */
export async function generateSampleEvents(
  serverURL: string,
  token: string,
  environmentId: string,
  body: { subscriptionId: string; durationSeconds: number },
): Promise<unknown> {
  return request(serverURL, '/portal/onboarding/events', {
    method: 'POST',
    token,
    environmentId,
    body: { subscription_id: body.subscriptionId, duration: body.durationSeconds },
  })
}

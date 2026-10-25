import {
  type QueryClient,
  type UseQueryResult,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ApiError,
  type AuthSource,
  ErrorKind,
  type SvixMessageStatus,
  type SvixSession,
  type WebhookDashboard,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  fetchWebhookDashboard,
  generateSvixPlayEndpoint,
  getWebhookEndpoint,
  getWebhookEndpointHeaders,
  getWebhookEndpointSecret,
  getWebhookEndpointStats,
  getWebhookMessage,
  listWebhookEndpointMessages,
  listWebhookEndpoints,
  listWebhookEventTypes,
  listWebhookMessageAttempts,
  listWebhookMessages,
  patchWebhookEndpointHeaders,
  recoverWebhookEndpoint,
  resendWebhookMessage,
  rotateWebhookEndpointSecret,
  sendWebhookExample,
  updateWebhookEndpoint,
} from '@fp/api'
import {
  type CreateWebhookEndpoint,
  type WebhookActivityPoint,
  type WebhookAttempt,
  WebhookDeliveryStatus,
  type WebhookEndpoint,
  type WebhookEndpointMessage,
  type WebhookEndpointPatch,
  type WebhookEndpointStats,
  type WebhookEventType,
  type WebhookHeader,
  type WebhookMessage,
  type WebhookStatusFilter,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * The webhook portal: V1's Svix integration, minus `svix-react`.
 *
 * `GET /webhooks/dashboard` hands out a Svix app-portal token for this
 * environment's application; every hook below uses it to call Svix directly,
 * which is what V1's `SvixProvider` does. The token lives in exactly one cache
 * entry (`webhooks.portal`) and is read from there at request time, never
 * returned to a component: `useWebhookPortal` selects it away.
 *
 * A Svix 401 means the portal token expired. The request is retried once with a
 * freshly minted token before the failure is reported.
 */

/* ---- wire → domain ------------------------------------------------------ */

type Wire = Record<string, unknown>

function rec(value: unknown): Wire {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Wire) : {}
}
function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
function date(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

const STATUS_FROM_WIRE: Record<number, WebhookDeliveryStatus> = {
  0: WebhookDeliveryStatus.Succeeded,
  1: WebhookDeliveryStatus.Pending,
  2: WebhookDeliveryStatus.Failed,
  3: WebhookDeliveryStatus.Sending,
}

const STATUS_TO_WIRE: Record<WebhookDeliveryStatus, SvixMessageStatus> = {
  succeeded: 0,
  pending: 1,
  failed: 2,
  sending: 3,
}

function status(value: unknown): WebhookDeliveryStatus {
  return STATUS_FROM_WIRE[num(value) ?? -1] ?? WebhookDeliveryStatus.Pending
}

export function toWebhookEndpoint(raw: unknown): WebhookEndpoint {
  const wire = rec(raw)
  return {
    id: str(wire['id']),
    url: str(wire['url']),
    description: str(wire['description']),
    filterTypes: strings(wire['filterTypes']),
    rateLimit: num(wire['rateLimit']),
    disabled: wire['disabled'] === true,
    createdAt: date(wire['createdAt']),
    updatedAt: date(wire['updatedAt']),
  }
}

export function toWebhookEndpointStats(raw: unknown): WebhookEndpointStats {
  const wire = rec(raw)
  return {
    succeeded: num(wire['success']) ?? 0,
    failed: num(wire['fail']) ?? 0,
    pending: num(wire['pending']) ?? 0,
    sending: num(wire['sending']) ?? 0,
  }
}

export function toWebhookHeaders(raw: unknown): WebhookHeader[] {
  const wire = rec(raw)
  const visible = Object.entries(rec(wire['headers'])).map(([name, value]) => ({
    name,
    value: str(value),
    sensitive: false,
  }))
  const withheld = strings(wire['sensitive']).map((name) => ({ name, value: '', sensitive: true }))
  return [...visible, ...withheld].sort((a, b) => a.name.localeCompare(b.name))
}

export function toWebhookEventType(raw: unknown): WebhookEventType {
  const wire = rec(raw)
  const schemas = rec(wire['schemas'])
  // Versions are keyed "1", "2", …; the catalog shows the latest.
  const latest = Object.keys(schemas).sort((a, b) => Number(b) - Number(a))[0]
  const schema = latest ? schemas[latest] : undefined
  const examples = rec(schema)['examples']
  return {
    name: str(wire['name']),
    description: str(wire['description']),
    schema: schema ?? null,
    example: Array.isArray(examples) && examples.length > 0 ? examples[0] : null,
    deprecated: wire['deprecated'] === true,
    archived: wire['archived'] === true,
  }
}

export function toWebhookMessage(raw: unknown): WebhookMessage {
  const wire = rec(raw)
  return {
    id: str(wire['id']),
    eventId: str(wire['eventId']),
    eventType: str(wire['eventType']),
    payload: wire['payload'] ?? null,
    timestamp: date(wire['timestamp']),
  }
}

export function toWebhookEndpointMessage(raw: unknown): WebhookEndpointMessage {
  const wire = rec(raw)
  return {
    ...toWebhookMessage(raw),
    status: status(wire['status']),
    nextAttempt: date(wire['nextAttempt']),
  }
}

export function toWebhookAttempt(raw: unknown): WebhookAttempt {
  const wire = rec(raw)
  return {
    id: str(wire['id']),
    messageId: str(wire['msgId']),
    endpointId: str(wire['endpointId']),
    url: str(wire['url']),
    status: status(wire['status']),
    responseStatusCode: num(wire['responseStatusCode']) ?? 0,
    response: str(wire['response']),
    responseDurationMs: num(wire['responseDurationMs']),
    trigger: num(wire['triggerType']) === 1 ? 'manual' : 'scheduled',
    timestamp: date(wire['timestamp']),
  }
}

function page(raw: unknown): { data: unknown[]; iterator: string; done: boolean } {
  const wire = rec(raw)
  return {
    data: Array.isArray(wire['data']) ? wire['data'] : [],
    iterator: str(wire['iterator']),
    done: wire['done'] !== false,
  }
}

/** Follows Svix's cursor until `done` or `max` rows. */
async function collect(
  fetchPage: (iterator: string | undefined) => Promise<unknown>,
  max: number,
): Promise<unknown[]> {
  const rows: unknown[] = []
  let iterator: string | undefined
  for (;;) {
    const next = page(await fetchPage(iterator))
    rows.push(...next.data)
    if (next.done || !next.iterator || rows.length >= max) return rows.slice(0, max)
    iterator = next.iterator
  }
}

/* ---- the portal session ------------------------------------------------- */

/** What a screen may know about the portal: whether it is on, and which Svix app. */
export interface WebhookPortalStatus {
  enabled: boolean
  appId: string
}

function enabledFor(environmentId: string | null): environmentId is string {
  return typeof environmentId === 'string' && environmentId.length > 0
}

function portalOptions(serverURL: string, auth: AuthSource, environmentId: string) {
  return queryOptions<WebhookDashboard>({
    queryKey: queryKeys.webhooks.portal(environmentId),
    queryFn: async () => {
      const token = await auth.getToken()
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to manage webhooks.')
      return fetchWebhookDashboard(serverURL, token, environmentId)
    },
    // App-portal tokens last days; re-minting one per screen visit is waste.
    // A short `gcTime` still drops the credential soon after the screens close.
    staleTime: 10 * 60_000,
    gcTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  })
}

function toSession(portal: WebhookDashboard): SvixSession {
  if (!portal.svixEnabled) {
    throw new ApiError(ErrorKind.Forbidden, 'Webhooks are not enabled for this environment.')
  }
  return { appId: portal.appId, token: portal.token }
}

async function withSession<T>(
  queryClient: QueryClient,
  options: ReturnType<typeof portalOptions>,
  run: (session: SvixSession) => Promise<T>,
): Promise<T> {
  const portal = await queryClient.ensureQueryData(options)
  try {
    return await run(toSession(portal))
  } catch (error) {
    if (!(error instanceof ApiError) || error.kind !== ErrorKind.Unauthorized) throw error
    const fresh = await queryClient.fetchQuery({ ...options, staleTime: 0 })
    return run(toSession(fresh))
  }
}

/** Whether this environment has a webhook portal, and its Svix app id. Never the token. */
export function useWebhookPortal(
  environmentId: string | null,
): UseQueryResult<WebhookPortalStatus> {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useQuery({
    ...portalOptions(serverURL, auth, environmentId ?? ''),
    enabled: enabledFor(environmentId),
    select: (portal): WebhookPortalStatus => ({
      enabled: portal.svixEnabled && portal.appId.length > 0 && portal.token.length > 0,
      appId: portal.appId,
    }),
  })
}

/** The plumbing every data hook shares: the session runner and whether it may run yet. */
function usePortalRunner(environmentId: string | null) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()
  const portal = useWebhookPortal(environmentId)
  const env = environmentId ?? ''
  const options = portalOptions(serverURL, auth, env)
  return {
    env,
    ready: enabledFor(environmentId) && portal.data?.enabled === true,
    queryClient,
    run: <T>(fn: (session: SvixSession) => Promise<T>) => withSession(queryClient, options, fn),
  }
}

/* ---- reads -------------------------------------------------------------- */

export function useWebhookEndpoints(environmentId: string | null) {
  const portal = usePortalRunner(environmentId)
  return useQuery({
    queryKey: queryKeys.webhooks.of(portal.env, 'endpoints'),
    queryFn: () =>
      portal.run(async (session) =>
        (await collect((iterator) => listWebhookEndpoints(session, { iterator }), 250)).map(
          toWebhookEndpoint,
        ),
      ),
    enabled: portal.ready,
  })
}

export function useWebhookEndpoint(environmentId: string | null, endpointId: string) {
  const portal = usePortalRunner(environmentId)
  return useQuery({
    queryKey: queryKeys.webhooks.of(portal.env, 'endpoint', endpointId),
    queryFn: () =>
      portal.run(async (session) =>
        toWebhookEndpoint(await getWebhookEndpoint(session, endpointId)),
      ),
    enabled: portal.ready && endpointId.length > 0,
  })
}

/** Delivery counts per endpoint, keyed by endpoint id. */
export function useWebhookEndpointStats(environmentId: string | null, endpointIds: string[]) {
  const portal = usePortalRunner(environmentId)
  return useQuery({
    queryKey: queryKeys.webhooks.of(portal.env, 'stats', endpointIds),
    queryFn: () =>
      portal.run(async (session) => {
        const entries = await Promise.all(
          endpointIds.map(
            async (id) =>
              [id, toWebhookEndpointStats(await getWebhookEndpointStats(session, id))] as const,
          ),
        )
        return Object.fromEntries(entries) as Record<string, WebhookEndpointStats>
      }),
    enabled: portal.ready && endpointIds.length > 0,
    staleTime: 60_000,
  })
}

/**
 * The endpoint's signing secret, fetched only while `revealed`.
 *
 * A credential, so it is never kept: `gcTime: 0` drops it the moment the
 * reveal is undone.
 */
export function useWebhookEndpointSecret(
  environmentId: string | null,
  endpointId: string,
  revealed: boolean,
) {
  const portal = usePortalRunner(environmentId)
  return useQuery({
    queryKey: queryKeys.webhooks.of(portal.env, 'secret', endpointId),
    queryFn: () =>
      portal.run(async (session) =>
        str(rec(await getWebhookEndpointSecret(session, endpointId))['key']),
      ),
    enabled: portal.ready && revealed && endpointId.length > 0,
    staleTime: 0,
    gcTime: 0,
  })
}

export function useWebhookEndpointHeaders(environmentId: string | null, endpointId: string) {
  const portal = usePortalRunner(environmentId)
  return useQuery({
    queryKey: queryKeys.webhooks.of(portal.env, 'headers', endpointId),
    queryFn: () =>
      portal.run(async (session) =>
        toWebhookHeaders(await getWebhookEndpointHeaders(session, endpointId)),
      ),
    enabled: portal.ready && endpointId.length > 0,
  })
}

/** The whole event catalog, schemas included. Changes on a deploy, not a click. */
export function useWebhookEventTypes(environmentId: string | null) {
  const portal = usePortalRunner(environmentId)
  return useQuery({
    queryKey: queryKeys.webhooks.of(portal.env, 'eventTypes'),
    queryFn: () =>
      portal.run(async (session) =>
        (await collect((iterator) => listWebhookEventTypes(session, { iterator }), 1000))
          .map(toWebhookEventType)
          .filter((eventType) => !eventType.archived),
      ),
    enabled: portal.ready,
    staleTime: 10 * 60_000,
  })
}

/** The most recent messages sent from this environment, newest first. */
export function useWebhookMessages(environmentId: string | null, eventType: string) {
  const portal = usePortalRunner(environmentId)
  return useQuery({
    queryKey: queryKeys.webhooks.of(portal.env, 'messages', eventType),
    queryFn: () =>
      portal.run(async (session) =>
        page(
          await listWebhookMessages(session, {
            limit: 100,
            ...(eventType ? { eventTypes: [eventType] } : {}),
          }),
        ).data.map(toWebhookMessage),
      ),
    enabled: portal.ready,
    placeholderData: (previous) => previous,
  })
}

export function useWebhookMessage(environmentId: string | null, messageId: string | null) {
  const portal = usePortalRunner(environmentId)
  return useQuery({
    queryKey: queryKeys.webhooks.of(portal.env, 'message', messageId ?? ''),
    queryFn: () =>
      portal.run(async (session) =>
        toWebhookMessage(await getWebhookMessage(session, messageId ?? '')),
      ),
    enabled: portal.ready && !!messageId,
  })
}

export function useWebhookMessageAttempts(
  environmentId: string | null,
  messageId: string | null,
  options: { endpointId?: string | undefined } = {},
) {
  const portal = usePortalRunner(environmentId)
  return useQuery({
    queryKey: queryKeys.webhooks.of(
      portal.env,
      'attempts',
      messageId ?? '',
      options.endpointId ?? '',
    ),
    queryFn: () =>
      portal.run(async (session) =>
        page(
          await listWebhookMessageAttempts(session, messageId ?? '', {
            endpointId: options.endpointId,
          }),
        ).data.map(toWebhookAttempt),
      ),
    enabled: portal.ready && !!messageId,
  })
}

/** Messages one endpoint was sent, filtered by their latest status there. */
export function useWebhookEndpointMessages(
  environmentId: string | null,
  endpointId: string,
  filter: WebhookStatusFilter,
) {
  const portal = usePortalRunner(environmentId)
  return useQuery({
    queryKey: queryKeys.webhooks.of(portal.env, 'endpointMessages', endpointId, filter),
    queryFn: () =>
      portal.run(async (session) =>
        page(
          await listWebhookEndpointMessages(session, endpointId, {
            status: filter === 'all' ? undefined : STATUS_TO_WIRE[filter],
          }),
        ).data.map(toWebhookEndpointMessage),
      ),
    enabled: portal.ready && endpointId.length > 0,
    placeholderData: (previous) => previous,
  })
}

const ACTIVITY_HOURS = 6
/** Activity asks Svix for one stats window per endpoint per hour; cap the fan-out. */
const ACTIVITY_MAX_ENDPOINTS = 25

/** Hourly windows, oldest first, ending at `now`. Exported for tests. */
export function hourlyWindows(now: Date, hours = ACTIVITY_HOURS): { start: Date; end: Date }[] {
  const hour = 60 * 60 * 1000
  return Array.from({ length: hours }, (_, index) => {
    const end = new Date(now.getTime() - (hours - 1 - index) * hour)
    return { start: new Date(end.getTime() - hour), end }
  })
}

/** Successful and failed attempts per hour over the last six, across endpoints (V1's Activity tab). */
export function useWebhookActivity(environmentId: string | null, endpointIds: string[]) {
  const portal = usePortalRunner(environmentId)
  const ids = endpointIds.slice(0, ACTIVITY_MAX_ENDPOINTS)
  return useQuery({
    queryKey: queryKeys.webhooks.of(portal.env, 'activity', ids),
    queryFn: () =>
      portal.run(async (session): Promise<WebhookActivityPoint[]> => {
        if (ids.length === 0) return []
        return Promise.all(
          hourlyWindows(new Date()).map(async (window) => {
            const stats = await Promise.all(
              ids.map(async (id) =>
                toWebhookEndpointStats(
                  await getWebhookEndpointStats(session, id, {
                    since: window.start,
                    until: window.end,
                  }),
                ),
              ),
            )
            return {
              start: window.start,
              succeeded: stats.reduce((sum, entry) => sum + entry.succeeded, 0),
              failed: stats.reduce((sum, entry) => sum + entry.failed, 0),
            }
          }),
        )
      }),
    enabled: portal.ready,
    staleTime: 60_000,
  })
}

/* ---- writes ------------------------------------------------------------- */

function useWebhookMutation<V, R>(
  environmentId: string | null,
  fn: (session: SvixSession, variables: V) => Promise<R>,
) {
  const portal = usePortalRunner(environmentId)
  return useMutation<R, Error, V>({
    mutationFn: async (variables) => {
      if (!portal.ready) {
        throw new ApiError(ErrorKind.Forbidden, 'Webhooks are not enabled for this environment.')
      }
      return portal.run((session) => fn(session, variables))
    },
    onSuccess: () =>
      portal.queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.data(portal.env) }),
  })
}

export function useCreateWebhookEndpoint(environmentId: string | null) {
  return useWebhookMutation(environmentId, async (session, draft: CreateWebhookEndpoint) =>
    toWebhookEndpoint(
      await createWebhookEndpoint(session, {
        url: draft.url.trim(),
        description: draft.description.trim(),
        filterTypes: draft.filterTypes,
      }),
    ),
  )
}

/** Svix's update replaces, so the patch is laid over the endpoint as last read. */
export function useUpdateWebhookEndpoint(environmentId: string | null) {
  return useWebhookMutation(
    environmentId,
    async (
      session,
      { endpoint, patch }: { endpoint: WebhookEndpoint; patch: WebhookEndpointPatch },
    ) =>
      toWebhookEndpoint(
        await updateWebhookEndpoint(session, endpoint.id, {
          url: patch.url ?? endpoint.url,
          description: patch.description ?? endpoint.description,
          filterTypes: patch.filterTypes ?? endpoint.filterTypes,
          rateLimit: patch.rateLimit === undefined ? endpoint.rateLimit : patch.rateLimit,
          disabled: patch.disabled ?? endpoint.disabled,
        }),
      ),
  )
}

export function useDeleteWebhookEndpoint(environmentId: string | null) {
  return useWebhookMutation(environmentId, (session, endpointId: string) =>
    deleteWebhookEndpoint(session, endpointId),
  )
}

export function useRotateWebhookEndpointSecret(environmentId: string | null) {
  return useWebhookMutation(environmentId, (session, endpointId: string) =>
    rotateWebhookEndpointSecret(session, endpointId),
  )
}

/** Sets one header, or removes one. Never rewrites the set. */
export function usePatchWebhookEndpointHeaders(environmentId: string | null) {
  return useWebhookMutation(
    environmentId,
    (
      session,
      change: { endpointId: string; set?: { name: string; value: string }; remove?: string },
    ) =>
      patchWebhookEndpointHeaders(session, change.endpointId, {
        headers: change.set ? { [change.set.name]: change.set.value } : {},
        ...(change.remove ? { deleteHeaders: [change.remove] } : {}),
      }),
  )
}

export function useSendWebhookExample(environmentId: string | null) {
  return useWebhookMutation(
    environmentId,
    async (session, { endpointId, eventType }: { endpointId: string; eventType: string }) =>
      toWebhookMessage(await sendWebhookExample(session, endpointId, eventType)),
  )
}

export function useResendWebhookMessage(environmentId: string | null) {
  return useWebhookMutation(
    environmentId,
    (session, { messageId, endpointId }: { messageId: string; endpointId: string }) =>
      resendWebhookMessage(session, messageId, endpointId),
  )
}

export function useRecoverWebhookEndpoint(environmentId: string | null) {
  return useWebhookMutation(
    environmentId,
    async (session, { endpointId, since }: { endpointId: string; since: Date }) => {
      await recoverWebhookEndpoint(session, endpointId, since)
    },
  )
}

/** A throwaway Svix Play inbox URL, for trying an endpoint before a receiver exists. */
export function useGenerateSvixPlayUrl() {
  return useMutation({ mutationFn: () => generateSvixPlayEndpoint() })
}

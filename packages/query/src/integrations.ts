import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  type AuthSource,
  type ConnectionUpdate,
  type OAuthCompleteRequest,
  ErrorKind,
  createConnection,
  deleteConnection,
  listConnections,
  oauthComplete,
  oauthInit,
  updateConnection,
} from '@fp/api'
import {
  INTEGRATION_CATALOG,
  type ConnectionPayload,
  type Integration,
  type IntegrationConnection,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Integrations: the fixed catalogue joined with `GET /connections`, so each
 * card can say whether this environment has connected it. The connections
 * route has no SDK method (see `@fp/api` `connections.ts`).
 */

export interface ConnectionWire {
  id?: string
  name?: string
  provider_type?: string
  connection_status?: string
  metadata?: Record<string, unknown> | null
  sync_config?: Record<string, { inbound?: boolean; outbound?: boolean } | undefined> | null
  billing_entity_id?: string | null
  created_at?: string
}

function isPublished(wire: ConnectionWire): boolean {
  return !wire.connection_status || wire.connection_status === 'published'
}

export function toIntegrationConnection(wire: ConnectionWire): IntegrationConnection {
  const syncConfig: IntegrationConnection['syncConfig'] = {}
  for (const [entity, value] of Object.entries(wire.sync_config ?? {})) {
    if (value && typeof value === 'object')
      syncConfig[entity] = {
        ...(typeof value.inbound === 'boolean' ? { inbound: value.inbound } : {}),
        ...(typeof value.outbound === 'boolean' ? { outbound: value.outbound } : {}),
      }
  }
  const metadata: Record<string, string> = {}
  for (const [key, value] of Object.entries(wire.metadata ?? {})) {
    if (typeof value === 'string') metadata[key] = value
  }
  return {
    id: wire.id ?? '',
    name: wire.name ?? '',
    providerType: wire.provider_type ?? '',
    syncConfig,
    metadata,
    billingEntityId: wire.billing_entity_id ?? null,
    createdAt: wire.created_at,
  }
}

/** Every published connection of each provider, in wire order; drafts and archived ones do not count. */
export function toIntegrations(wires: ConnectionWire[]): Integration[] {
  return INTEGRATION_CATALOG.map((spec) => ({
    ...spec,
    connections: wires
      .filter((w) => w.id && w.provider_type === spec.providerType && isPublished(w))
      .map(toIntegrationConnection),
  }))
}

export async function fetchIntegrations(
  serverURL: string,
  auth: AuthSource,
): Promise<Integration[]> {
  const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
  if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to view integrations.')

  const body = await listConnections(serverURL, token, environmentId ?? '')
  const record = (body ?? {}) as { connections?: ConnectionWire[] | null }
  return toIntegrations(record.connections ?? [])
}

export function useConnections(options: { enabled?: boolean } = {}) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.integrations.all(),
    queryFn: () => fetchIntegrations(serverURL, auth),
    enabled: options.enabled ?? true,
  })
}

/** Token and environment for a write, or the error a signed-out caller should see. */
async function credentials(auth: AuthSource) {
  const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
  if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to manage integrations.')
  return { token, environmentId: environmentId ?? '' }
}

function useRefreshConnections() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() })
    // A connected provider adds a column of marks to every customer.
    void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() })
  }
}

/** Connects a provider that needs only credentials. */
export function useConnectIntegration() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const refresh = useRefreshConnections()

  return useMutation({
    mutationFn: async (payload: ConnectionPayload) => {
      const { token, environmentId } = await credentials(auth)
      return toIntegrationConnection(
        (await createConnection(serverURL, token, environmentId, payload)) as ConnectionWire,
      )
    },
    onSuccess: refresh,
  })
}

/** Name, metadata and sync settings, plus the few secrets the API lets a connection rotate. */
export function useUpdateConnection() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const refresh = useRefreshConnections()

  return useMutation({
    mutationFn: async ({ id, ...body }: ConnectionUpdate & { id: string }) => {
      const { token, environmentId } = await credentials(auth)
      return toIntegrationConnection(
        (await updateConnection(serverURL, token, environmentId, id, body)) as ConnectionWire,
      )
    },
    onSuccess: refresh,
  })
}

/** Archives the connection; the provider becomes connectable again. */
export function useDisconnectIntegration() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const refresh = useRefreshConnections()

  return useMutation({
    mutationFn: async (id: string) => {
      const { token, environmentId } = await credentials(auth)
      await deleteConnection(serverURL, token, environmentId, id)
    },
    onSuccess: refresh,
  })
}

export interface OAuthStart {
  oauthUrl: string
  sessionId: string
}

/** Saves the form and returns where to send the reader to approve access. */
export function useStartOAuth() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const refresh = useRefreshConnections()

  return useMutation({
    mutationFn: async (payload: ConnectionPayload): Promise<OAuthStart> => {
      const { token, environmentId } = await credentials(auth)
      const { provider_type, encrypted_secret_data, ...rest } = payload
      const body = (await oauthInit(serverURL, token, environmentId, {
        provider: provider_type,
        credentials: encrypted_secret_data,
        ...rest,
      })) as { oauth_url?: string; session_id?: string } | null
      if (!body?.oauth_url || !body.session_id)
        throw new ApiError(ErrorKind.Server, 'The provider did not return a sign-in address.')
      return { oauthUrl: body.oauth_url, sessionId: body.session_id }
    },
    // oauth/init saves an incomplete connection straight away.
    onSuccess: refresh,
  })
}

/** Finishes consent on the callback page, with what the provider put in the address. */
export function useCompleteOAuth() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const refresh = useRefreshConnections()

  return useMutation({
    mutationFn: async (request: OAuthCompleteRequest) => {
      const { token, environmentId } = await credentials(auth)
      const body = (await oauthComplete(serverURL, token, environmentId, request)) as {
        connection_id?: string
      } | null
      return { connectionId: body?.connection_id ?? '' }
    },
    onSuccess: refresh,
  })
}

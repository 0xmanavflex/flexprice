import { useQuery } from '@tanstack/react-query'
import { ApiError, type AuthSource, ErrorKind, listConnections } from '@fp/api'
import { INTEGRATION_CATALOG, type Integration } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Integrations: the fixed catalogue joined with `GET /connections`, so each
 * card can say whether this environment has connected it. The connections
 * route has no SDK method (see `@fp/api` `connections.ts`).
 */

export interface ConnectionWire {
  id?: string
  provider_type?: string
  connection_status?: string
}

/** Published connections per `provider_type`; drafts and archived ones do not count. */
export function countConnections(wires: ConnectionWire[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const wire of wires) {
    if (!wire.provider_type) continue
    if (wire.connection_status && wire.connection_status !== 'published') continue
    counts.set(wire.provider_type, (counts.get(wire.provider_type) ?? 0) + 1)
  }
  return counts
}

export function toIntegrations(wires: ConnectionWire[]): Integration[] {
  const counts = countConnections(wires)
  return INTEGRATION_CATALOG.map((spec) => ({
    ...spec,
    connections: counts.get(spec.providerType) ?? 0,
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

export function useIntegrations() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.integrations.all(),
    queryFn: () => fetchIntegrations(serverURL, auth),
  })
}

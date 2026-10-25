import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type ApiKey,
  ApiKeyStatus,
  ApiKeyType,
  type CreateApiKey,
  type CreatedApiKey,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * API keys. List, create, delete: and no update, because the API has none.
 *
 * `GET /secrets/api/keys`, `POST /secrets/api/keys`,
 * `DELETE /secrets/api/keys/{id}`. The list takes `limit`, `offset` and
 * `status` as **positional query parameters**, not a filter body: it is a
 * plain GET rather than one of this package's `/search` POSTs, so there is no
 * `filters` DSL, no sort and no name search available on it.
 *
 * The rule the types exist to enforce: a created key's secret comes back once,
 * on the create response, and never again. `useCreateApiKey` returns a
 * `CreatedApiKey` carrying it; `useApiKeys` returns `ApiKey`, which has no
 * field for it. Nothing can re-read a secret because nothing has a way to ask.
 */

/** The wire shape this reads, after the SDK camelCases the response. */
export interface ApiKeyWire {
  id?: string | undefined
  name?: string | undefined
  displayId?: string | undefined
  type?: string | undefined
  provider?: string | undefined
  status?: string | undefined
  roles?: string[] | undefined
  userId?: string | undefined
  userType?: string | undefined
  serviceAccountName?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
  expiresAt?: Date | undefined
  lastUsedAt?: Date | undefined
}

const API_KEY_TYPES = new Set<string>(Object.values(ApiKeyType))
const API_KEY_STATUSES = new Set<string>(Object.values(ApiKeyStatus))

export function toApiKey(wire: ApiKeyWire): ApiKey {
  const type = API_KEY_TYPES.has(wire.type ?? '')
    ? (wire.type as ApiKeyType)
    : // An unknown type is the API ahead of this client. `private_key` is the
      // safer label: it is the one the UI warns about handling carefully.
      ApiKeyType.Private

  const status = API_KEY_STATUSES.has(wire.status ?? '')
    ? (wire.status as ApiKeyStatus)
    : ApiKeyStatus.Published

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled key',
    displayId: wire.displayId ?? '',
    type,
    status,
    roles: wire.roles ?? [],
    ownerId: wire.userId ?? '',
    serviceAccountName: wire.serviceAccountName ?? '',
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
    // A key with no expiry never expires: a real absence, not a missing value.
    expiresAt: wire.expiresAt ?? null,
    lastUsedAt: wire.lastUsedAt ?? null,
  }
}

export interface ApiKeyPage {
  keys: ApiKey[]
  total: number
}

export interface ApiKeyQuery {
  page: number
  pageSize: number
  /** `published` | `archived`, or empty for every status. */
  status: string
}

export const DEFAULT_API_KEY_QUERY: ApiKeyQuery = {
  page: 1,
  pageSize: 25,
  status: '',
}

export async function fetchApiKeys(client: Flexprice, query: ApiKeyQuery): Promise<ApiKeyPage> {
  const offset = (query.page - 1) * query.pageSize
  const response = await call(() =>
    // Positional, and the third argument must be `undefined` rather than `''`
    // for "any status": an empty string is a value the backend would filter on.
    client.secrets.listApiKeys(query.pageSize, offset, query.status || undefined),
  )

  return {
    keys: (response.items ?? []).map((item) => toApiKey(item as ApiKeyWire)),
    total: response.pagination?.total ?? 0,
  }
}

export function useApiKeys(query: ApiKeyQuery = DEFAULT_API_KEY_QUERY) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.apiKeys.list({ ...query }),
    queryFn: () => fetchApiKeys(client, query),
    placeholderData: (previous) => previous,
  })
}

/**
 * The create request.
 *
 * `expiresAt` is a `Date` on the wire model and is omitted entirely when the
 * key never expires: sending `null` is not the same as not sending it, and the
 * SDK's zod schema would reject the null. `serviceAccountId` is likewise
 * omitted rather than sent empty: present, it issues the key against a machine
 * identity; absent, against the signed-in person.
 */
export function toCreateApiKeyRequest(draft: CreateApiKey): Record<string, unknown> {
  return {
    name: draft.name,
    type: draft.type,
    ...(draft.expiresAt ? { expiresAt: new Date(draft.expiresAt) } : {}),
    ...(draft.serviceAccountId ? { serviceAccountId: draft.serviceAccountId } : {}),
  }
}

/** The create response: `{apiKey, secret}`: the material and the record. */
export interface CreateApiKeyWire {
  apiKey?: string | undefined
  secret?: ApiKeyWire | undefined
}

export function toCreatedApiKey(wire: CreateApiKeyWire): CreatedApiKey {
  return {
    secret: wire.apiKey ?? '',
    key: toApiKey(wire.secret ?? {}),
  }
}

/**
 * Issue an API key.
 *
 * **The returned `secret` is the only copy.** It is on the create response and
 * on nothing else: the list endpoint returns a `displayId` prefix, there is no
 * "reveal" route, and re-reading the key after this mutation resolves returns a
 * record with no key material in it. A caller must surface `data.secret` to the
 * person at the moment this settles: once the component holding it unmounts,
 * the secret is unrecoverable and the only remedy is deleting the key and
 * issuing another.
 *
 * It is deliberately *not* written into the query cache for the same reason
 * `ApiKey` has no field for it: a secret sitting in a cache is a secret that
 * outlives the dialog that was supposed to be its only home.
 */
export function useCreateApiKey() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draft: CreateApiKey): Promise<CreatedApiKey> => {
      const wire = await call(() =>
        client.secrets.createApiKey(toCreateApiKeyRequest(draft) as never),
      )
      return toCreatedApiKey(wire as CreateApiKeyWire)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all() })
    },
  })
}

/**
 * Revoke a key. `DELETE /secrets/api/keys/{id}`.
 *
 * Immediate and irreversible from the console: there is no update route to
 * put one back, so a revoked key is replaced rather than restored.
 */
export function useDeleteApiKey() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.secrets.deleteApiKey(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all() })
    },
  })
}

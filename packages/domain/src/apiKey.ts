/**
 * API keys.
 *
 * Three operations and no fourth: list, create, delete. There is no update:
 * matching V1, and matching the API, which has no route for it. A key's name
 * is fixed at creation; renaming one means issuing a new key and deleting the
 * old.
 *
 * The rule that shapes every screen here: **the secret is returned once**. The
 * create response carries the key material; every subsequent read carries only
 * a `displayId` prefix. If the UI does not show it at that moment, it is gone
 * and the only remedy is another key. That is why `CreatedApiKey` is a separate
 * type from `ApiKey`: the two are not interchangeable, and a component that
 * takes an `ApiKey` must not be reachable with a secret in hand.
 */
import { z } from 'zod'

/**
 * What the key can do at the transport level.
 *
 * A private key is server-side and carries the caller's roles; a publishable
 * key is safe in a browser. `integration` also exists on the wire but belongs
 * to connector configuration, not to a person issuing a key, so it is not
 * offered by the create form.
 */
export const ApiKeyType = {
  Private: 'private_key',
  Publishable: 'publishable_key',
  Integration: 'integration',
} as const
export type ApiKeyType = (typeof ApiKeyType)[keyof typeof ApiKeyType]

export const API_KEY_TYPE_LABEL: Record<ApiKeyType, string> = {
  [ApiKeyType.Private]: 'Secret key',
  [ApiKeyType.Publishable]: 'Publishable key',
  [ApiKeyType.Integration]: 'Integration key',
}

/** The types a person may actually issue from the Settings screen. */
export const ISSUABLE_API_KEY_TYPES: ApiKeyType[] = [ApiKeyType.Private, ApiKeyType.Publishable]

export const ApiKeyStatus = {
  Published: 'published',
  Archived: 'archived',
  Deleted: 'deleted',
} as const
export type ApiKeyStatus = (typeof ApiKeyStatus)[keyof typeof ApiKeyStatus]

export const API_KEY_STATUS_LABEL: Record<ApiKeyStatus, string> = {
  [ApiKeyStatus.Published]: 'Active',
  [ApiKeyStatus.Archived]: 'Revoked',
  [ApiKeyStatus.Deleted]: 'Deleted',
}

/** The read model the keys table renders. The secret is *not* in it. */
export interface ApiKey {
  id: string
  name: string
  /**
   * The only part of the key ever shown after creation: a prefix the API
   * keeps so a person can tell two keys apart. Never the whole secret.
   */
  displayId: string
  type: ApiKeyType
  status: ApiKeyStatus
  /** RBAC roles the key carries. */
  roles: string[]
  /** The owning principal. A key can belong to a person or a service account. */
  ownerId: string
  /** Set when the key belongs to a service account; empty for a person's key. */
  serviceAccountName: string
  createdAt: Date | null
  updatedAt: Date | null
  expiresAt: Date | null
  /** Null when the key has never been used: a useful "safe to delete" signal. */
  lastUsedAt: Date | null
}

export function isExpired(key: ApiKey, now: Date = new Date()): boolean {
  return key.expiresAt !== null && key.expiresAt.getTime() <= now.getTime()
}

export function isActive(key: ApiKey, now: Date = new Date()): boolean {
  return key.status === ApiKeyStatus.Published && !isExpired(key, now)
}

/**
 * A newly created key: the secret, and the record it belongs to.
 *
 * **`secret` exists exactly once, in the create mutation's result.** It is not
 * persisted anywhere, is not on `ApiKey`, and cannot be re-fetched. A screen
 * that receives one must show it immediately and must treat dismissing the
 * dialog as discarding it.
 */
export interface CreatedApiKey {
  /** The full key material. Shown once, never retrievable again. */
  secret: string
  /** The listable record, the same shape every later read returns. */
  key: ApiKey
}

/**
 * Creating a key.
 *
 * `expiresAt` is optional: a key with no expiry never expires. A
 * `serviceAccountId` issues the key against a machine identity instead of the
 * signed-in person, which is how a service account gets credentials at all.
 */
export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  type: z.enum([ApiKeyType.Private, ApiKeyType.Publishable]),
  /** ISO date string, or empty for a key that never expires. */
  expiresAt: z.string().trim().optional(),
  /** Issue against this service account rather than the signed-in person. */
  serviceAccountId: z.string().trim().optional(),
})

export type CreateApiKey = z.infer<typeof createApiKeySchema>

export function emptyApiKey(): CreateApiKey {
  return { name: '', type: ApiKeyType.Private, expiresAt: '', serviceAccountId: '' }
}

import { describe, expect, it } from 'vitest'
import { ApiKeyStatus, ApiKeyType, isActive, isExpired } from '@fp/domain'
import { toApiKey, toCreateApiKeyRequest, toCreatedApiKey } from './apiKeys'

/** A `SecretResponse` row as `GET /secrets/api/keys` returns it, camelCased. */
const keyWire = {
  id: 'secret_01J000000000000000000000',
  name: 'CI deploy key',
  displayId: 'sk_live_a1b2',
  type: 'private_key',
  provider: 'flexprice',
  status: 'published',
  roles: ['all_writer'],
  userId: '9451e6c3-15ed-44f9-a3ab-37f400e10c45',
  userType: 'user',
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
}

describe('toApiKey', () => {
  it('maps a key row, carrying only the display prefix', () => {
    const key = toApiKey(keyWire)
    expect(key.id).toBe('secret_01J000000000000000000000')
    expect(key.name).toBe('CI deploy key')
    expect(key.displayId).toBe('sk_live_a1b2')
    expect(key.type).toBe(ApiKeyType.Private)
    expect(key.status).toBe(ApiKeyStatus.Published)
    expect(key.ownerId).toBe('9451e6c3-15ed-44f9-a3ab-37f400e10c45')
  })

  it('has no field the secret could be put in', () => {
    // The whole point of the type: a listed key cannot carry key material,
    // because there is nowhere on it to put any.
    expect(Object.keys(toApiKey(keyWire)).sort()).toEqual([
      'createdAt',
      'displayId',
      'expiresAt',
      'id',
      'lastUsedAt',
      'name',
      'ownerId',
      'roles',
      'serviceAccountName',
      'status',
      'type',
      'updatedAt',
    ])
  })

  it('names the owning service account when the key belongs to one', () => {
    const key = toApiKey({
      ...keyWire,
      userType: 'service_account',
      serviceAccountName: 'ingest-worker',
    })
    expect(key.serviceAccountName).toBe('ingest-worker')
  })

  it('keeps a missing expiry and a never-used key as null, not as a date', () => {
    const key = toApiKey(keyWire)
    expect(key.expiresAt).toBeNull()
    expect(key.lastUsedAt).toBeNull()
  })

  it('falls back to the safer label for an unknown type', () => {
    expect(toApiKey({ ...keyWire, type: 'quantum_key' }).type).toBe(ApiKeyType.Private)
  })

  it('is total for an empty record', () => {
    const key = toApiKey({})
    expect(key.id).toBe('')
    expect(key.name).toBe('Untitled key')
    expect(key.roles).toEqual([])
  })
})

describe('toCreateApiKeyRequest', () => {
  it('omits an empty expiry rather than sending null', () => {
    expect(
      toCreateApiKeyRequest({
        name: 'CI',
        type: ApiKeyType.Private,
        expiresAt: '',
        serviceAccountId: '',
      }),
    ).toEqual({ name: 'CI', type: 'private_key' })
  })

  it('sends an expiry as a Date, which the SDK serialises', () => {
    const request = toCreateApiKeyRequest({
      name: 'CI',
      type: ApiKeyType.Publishable,
      expiresAt: '2027-01-01T00:00:00.000Z',
    })
    expect(request['type']).toBe('publishable_key')
    expect(request['expiresAt']).toEqual(new Date('2027-01-01T00:00:00.000Z'))
  })

  it('issues against a service account when one is named', () => {
    expect(
      toCreateApiKeyRequest({
        name: 'ingest',
        type: ApiKeyType.Private,
        serviceAccountId: 'sa_1',
      }),
    ).toMatchObject({ serviceAccountId: 'sa_1' })
  })
})

describe('toCreatedApiKey', () => {
  it('separates the once-only secret from the listable record', () => {
    const created = toCreatedApiKey({ apiKey: 'sk_live_full_secret_value', secret: keyWire })
    expect(created.secret).toBe('sk_live_full_secret_value')
    expect(created.key.displayId).toBe('sk_live_a1b2')
    // The record beside it still carries no secret: only the prefix.
    expect(JSON.stringify(created.key)).not.toContain('sk_live_full_secret_value')
  })

  it('is total when the API omits the key material', () => {
    expect(toCreatedApiKey({}).secret).toBe('')
    expect(toCreatedApiKey({}).key.name).toBe('Untitled key')
  })
})

describe('isExpired / isActive', () => {
  const now = new Date('2026-09-29T00:00:00Z')

  it('a key with no expiry never expires', () => {
    const key = toApiKey(keyWire)
    expect(isExpired(key, now)).toBe(false)
    expect(isActive(key, now)).toBe(true)
  })

  it('an expiry in the past expires the key', () => {
    const key = toApiKey({ ...keyWire, expiresAt: new Date('2026-01-01T00:00:00Z') })
    expect(isExpired(key, now)).toBe(true)
    expect(isActive(key, now)).toBe(false)
  })

  it('a revoked key is inactive even before its expiry', () => {
    const key = toApiKey({
      ...keyWire,
      status: 'archived',
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    })
    expect(isExpired(key, now)).toBe(false)
    expect(isActive(key, now)).toBe(false)
  })
})

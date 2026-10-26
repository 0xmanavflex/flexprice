import { describe, expect, it } from 'vitest'
import { MemberType, matchesMemberQuery, type Member, type MemberQuery } from '@fp/domain'
import {
  toCreateServiceAccountRequest,
  toInviteMemberRequest,
  toMember,
  toMemberFilter,
} from './users'

/**
 * The person `POST /users/search` returned live for `type: 'user'`, after the
 * SDK camelCased it. Kept whole so the mapper is tested against a real
 * response rather than a guess at one.
 */
const userWire = {
  id: '9451e6c3-15ed-44f9-a3ab-37f400e10c45',
  email: 'dkinsh123@gmail.com',
  type: 'user',
  roles: ['super_admin'],
  metadata: { locale: 'en-US', signup_method: 'email' },
  tenant: {
    id: 'tenant_01KVSNYVMBNGWZZQGBQG0G7M2V',
    name: 'testing',
    status: 'published',
  },
}

/** The same record as a service account: named, no email, machine roles. */
const serviceAccountWire = {
  id: 'sa_01J000000000000000000000',
  email: '',
  name: 'ingest-worker',
  type: 'service_account',
  roles: ['event_ingestor'],
  tenant: { id: 'tenant_01KVSNYVMBNGWZZQGBQG0G7M2V', name: 'testing' },
}

describe('toMember', () => {
  it('maps a person from the live response shape', () => {
    expect(toMember(userWire)).toEqual({
      id: '9451e6c3-15ed-44f9-a3ab-37f400e10c45',
      name: '',
      email: 'dkinsh123@gmail.com',
      type: MemberType.User,
      roles: ['super_admin'],
      tenantId: 'tenant_01KVSNYVMBNGWZZQGBQG0G7M2V',
      tenantName: 'testing',
    })
  })

  it('maps a service account, which has a name and no email', () => {
    const member = toMember(serviceAccountWire)
    expect(member.type).toBe(MemberType.ServiceAccount)
    expect(member.name).toBe('ingest-worker')
    expect(member.email).toBe('')
    expect(member.roles).toEqual(['event_ingestor'])
  })

  it('splits the two on the type discriminator alone', () => {
    // Same endpoint, same record shape: only `type` separates the Team screen
    // from the Service Accounts screen.
    expect(toMember(userWire).type).toBe(MemberType.User)
    expect(toMember(serviceAccountWire).type).toBe(MemberType.ServiceAccount)
  })

  it('treats an unknown type as a person', () => {
    expect(toMember({ ...userWire, type: 'robot_overlord' }).type).toBe(MemberType.User)
    expect(toMember({ id: 'u_1' }).type).toBe(MemberType.User)
  })

  it('normalizes roles on the way in, so super admin is never shown twice over', () => {
    expect(toMember({ ...userWire, roles: ['all_reader', 'super_admin'] }).roles).toEqual([
      'super_admin',
    ])
  })

  it('is total for an all-but-empty record', () => {
    expect(toMember({})).toEqual({
      id: '',
      name: '',
      email: '',
      type: MemberType.User,
      roles: [],
      tenantId: '',
      tenantName: '',
    })
  })
})

describe('toMemberFilter', () => {
  const query: MemberQuery = {
    page: 2,
    pageSize: 25,
    type: MemberType.ServiceAccount,
    search: 'ingest',
    roles: ['event_ingestor'],
  }

  it('always sends a type, because the endpoint returns nothing without one', () => {
    expect(toMemberFilter(query)).toHaveProperty('type', MemberType.ServiceAccount)
  })

  it('turns a 1-based page into an offset', () => {
    expect(toMemberFilter(query)).toEqual({ type: 'service_account', limit: 25, offset: 25 })
    expect(toMemberFilter({ ...query, page: 1 })).toMatchObject({ offset: 0 })
  })

  it('sends neither search nor roles: the endpoint ignores both', () => {
    // Verified live: a `contains` filter for "zzzznomatch" returned the row it
    // cannot match, and roles:['event_reader'] returned a super_admin-only
    // user. Sending them would make the search box appear to work.
    const filter = toMemberFilter(query)
    expect(filter).not.toHaveProperty('filters')
    expect(filter).not.toHaveProperty('roles')
    expect(filter).not.toHaveProperty('status')
  })
})

describe('matchesMemberQuery', () => {
  const base: MemberQuery = {
    page: 1,
    pageSize: 25,
    type: MemberType.User,
    search: '',
    roles: [],
  }
  const person = toMember({ ...userWire, name: 'Dinesh K' })
  const account = toMember(serviceAccountWire)

  it('matches everything when nothing is asked for', () => {
    expect(matchesMemberQuery(person, base)).toBe(true)
    expect(matchesMemberQuery(account, base)).toBe(true)
  })

  it('searches name and email, case-insensitively', () => {
    expect(matchesMemberQuery(person, { ...base, search: 'dinesh' })).toBe(true)
    expect(matchesMemberQuery(person, { ...base, search: 'DKINSH123' })).toBe(true)
    expect(matchesMemberQuery(person, { ...base, search: 'zzzznomatch' })).toBe(false)
  })

  it('matches a service account by name even though it has no email', () => {
    expect(matchesMemberQuery(account, { ...base, search: 'ingest-worker' })).toBe(true)
    expect(matchesMemberQuery(account, { ...base, search: '@' })).toBe(false)
  })

  it('narrows by any of the given roles', () => {
    expect(matchesMemberQuery(person, { ...base, roles: ['super_admin'] })).toBe(true)
    expect(matchesMemberQuery(person, { ...base, roles: ['event_reader'] })).toBe(false)
    expect(matchesMemberQuery(person, { ...base, roles: ['event_reader', 'super_admin'] })).toBe(
      true,
    )
  })
})

describe('toInviteMemberRequest', () => {
  it('always names the type, and omits the empty optionals', () => {
    expect(toInviteMemberRequest({ email: 'a@b.com', name: '', roles: [] })).toEqual({
      type: 'user',
      email: 'a@b.com',
    })
  })

  it('sends roles when chosen, normalized', () => {
    expect(
      toInviteMemberRequest({
        email: 'a@b.com',
        name: 'Ada',
        roles: ['all_reader', 'super_admin'],
      }),
    ).toEqual({ type: 'user', email: 'a@b.com', name: 'Ada', roles: ['super_admin'] })
  })
})

describe('toCreateServiceAccountRequest', () => {
  it('sends a name and roles, and never an email', () => {
    const request = toCreateServiceAccountRequest({
      name: 'ingest-worker',
      roles: ['event_ingestor'],
    })
    expect(request).toEqual({
      type: 'service_account',
      name: 'ingest-worker',
      roles: ['event_ingestor'],
    })
    expect(request).not.toHaveProperty('email')
  })

  it('applies super-admin exclusivity at the network boundary', () => {
    // The rule holds even if the picker that produced the list did not apply it.
    expect(
      toCreateServiceAccountRequest({ name: 'root', roles: ['event_reader', 'super_admin'] }),
    ).toMatchObject({ roles: ['super_admin'] })
  })
})

describe('the member domain model', () => {
  it('is what a hook returns: no transport type reaches a component', () => {
    const member: Member = toMember(userWire)
    expect(Object.keys(member).sort()).toEqual([
      'email',
      'id',
      'name',
      'roles',
      'tenantId',
      'tenantName',
      'type',
    ])
  })
})

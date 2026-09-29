import { describe, expect, it } from 'vitest'
import { SUPER_ADMIN_ROLE_ID } from '@fp/domain'
import { toRole, toRoleDetail, toRoleList } from './roles'

/** `GET /rbac/roles` exactly as it came back live: a `{roles: [...]}` envelope. */
const listResponse = {
  roles: [
    {
      id: 'super_admin',
      name: 'Super Admin',
      description:
        'Provides unrestricted access to all resources, operations, and administrative settings.',
      permissions: { '*': ['*'] },
    },
    {
      id: 'all_writer',
      name: 'All Writer',
      description:
        'Provides read and write access to all resources and operations, excluding user, role, and administrative management.',
      permissions: { '*': ['read', 'write'] },
    },
    {
      id: 'event_reader',
      name: 'Event Reader',
      description: 'Provides read-only access to events.',
      permissions: { event: ['read'] },
    },
  ],
}

describe('toRoleList', () => {
  it('unwraps the {roles} envelope, which is not the usual {items, pagination}', () => {
    const roles = toRoleList(listResponse)
    expect(roles).toHaveLength(3)
    expect(roles.map((r) => r.id)).toEqual(['super_admin', 'all_writer', 'event_reader'])
  })

  it('returns nothing rather than throwing on an unexpected body', () => {
    expect(toRoleList({})).toEqual([])
    expect(toRoleList(null)).toEqual([])
    expect(toRoleList({ items: [] })).toEqual([])
  })

  it('includes super_admin, the role the exclusivity rule is about', () => {
    expect(toRoleList(listResponse).some((r) => r.id === SUPER_ADMIN_ROLE_ID)).toBe(true)
  })
})

describe('toRoleDetail', () => {
  it('unwraps the {role} envelope the detail route returns', () => {
    const role = toRoleDetail({ role: listResponse.roles[0] })
    expect(role?.id).toBe('super_admin')
    expect(role?.name).toBe('Super Admin')
  })

  it('is null when the body carries no role', () => {
    expect(toRoleDetail({})).toBeNull()
    expect(toRoleDetail(null)).toBeNull()
  })
})

describe('toRole', () => {
  it('turns the resource-keyed permissions object into a list', () => {
    expect(toRole({ id: 'event_reader', permissions: { event: ['read'] } }).permissions).toEqual([
      { resource: 'event', actions: ['read'] },
    ])
  })

  it('puts the wildcard resource first, as the widest grant', () => {
    const role = toRole({
      id: 'mixed',
      permissions: { event: ['read'], '*': ['read'], wallet: ['write'] },
    })
    expect(role.permissions.map((p) => p.resource)).toEqual(['*', 'event', 'wallet'])
  })

  it('falls back to the id when a role has no display name', () => {
    expect(toRole({ id: 'event_reader' }).name).toBe('event_reader')
  })

  it('is total for a role with no permissions block', () => {
    expect(toRole({ id: 'x' }).permissions).toEqual([])
    expect(toRole({}).id).toBe('')
  })
})

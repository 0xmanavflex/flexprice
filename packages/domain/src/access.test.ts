import { describe, expect, it } from 'vitest'
import {
  RBAC_ENTITY,
  canAccess,
  canDeleteMember,
  canEditMemberRoles,
  canRemoveMember,
  isSuperAdmin,
  meetsRequirement,
  resolveGrants,
} from './access'
import type { Role } from './role'

const role = (id: string, permissions: Record<string, string[]>): Role => ({
  id,
  name: id,
  description: '',
  permissions: Object.entries(permissions).map(([resource, actions]) => ({ resource, actions })),
})

const CATALOGUE = [
  role('super_admin', { '*': ['*'] }),
  role('all_reader', { '*': ['read'] }),
  role('plan_writer', { plan: ['write'] }),
  role('event_ingestor', { event: ['write'] }),
  role('price_all', { price: ['*'] }),
]

describe('canAccess (as V1)', () => {
  it('honours the entity and action wildcards', () => {
    const admin = resolveGrants(['super_admin'], CATALOGUE)
    expect(canAccess(admin, RBAC_ENTITY.Invoice, 'write')).toBe(true)
    const reader = resolveGrants(['all_reader'], CATALOGUE)
    expect(canAccess(reader, RBAC_ENTITY.Invoice, 'read')).toBe(true)
    expect(canAccess(reader, RBAC_ENTITY.Invoice, 'write')).toBe(false)
    const prices = resolveGrants(['price_all'], CATALOGUE)
    expect(canAccess(prices, RBAC_ENTITY.Price, 'write')).toBe(true)
    expect(canAccess(prices, RBAC_ENTITY.Plan, 'read')).toBe(false)
  })

  it('unions every held role', () => {
    const both = resolveGrants(['all_reader', 'plan_writer'], CATALOGUE)
    expect(canAccess(both, RBAC_ENTITY.Plan, 'write')).toBe(true)
    expect(canAccess(both, RBAC_ENTITY.Customer, 'write')).toBe(false)
  })

  it('does not let write imply read', () => {
    const writer = resolveGrants(['plan_writer'], CATALOGUE)
    expect(canAccess(writer, RBAC_ENTITY.Plan, 'read')).toBe(false)
    expect(meetsRequirement(writer, { entity: RBAC_ENTITY.Plan, action: ['read', 'write'] })).toBe(
      true,
    )
  })

  it('denies roles the catalogue does not know, and no roles at all', () => {
    expect(canAccess(resolveGrants(['ghost'], CATALOGUE), RBAC_ENTITY.Plan, 'read')).toBe(false)
    expect(canAccess(resolveGrants([], CATALOGUE), RBAC_ENTITY.Plan, 'read')).toBe(false)
  })

  it('requires super admin when asked, on top of the permission', () => {
    const reader = resolveGrants(['all_reader'], CATALOGUE)
    expect(
      meetsRequirement(reader, { entity: RBAC_ENTITY.Setting, action: 'read', superAdmin: true }),
    ).toBe(false)
    const admin = resolveGrants(['super_admin'], CATALOGUE)
    expect(
      meetsRequirement(admin, { entity: RBAC_ENTITY.Setting, action: 'write', superAdmin: true }),
    ).toBe(true)
    expect(isSuperAdmin(['all_reader', 'super_admin'])).toBe(true)
  })
})

describe('member rules (as V1)', () => {
  const admin = { id: 'u1', roles: ['super_admin'] }
  const writer = { id: 'u2', roles: ['all_writer'] }

  it('lets only a super admin edit roles, and never their own', () => {
    expect(canEditMemberRoles({ id: 'u3' }, admin)).toBe(true)
    expect(canEditMemberRoles({ id: 'u1' }, admin)).toBe(false)
    expect(canEditMemberRoles({ id: 'u3' }, writer)).toBe(false)
  })

  it('never removes the last member', () => {
    expect(canRemoveMember({ id: 'u3' }, admin, 2)).toBe(true)
    expect(canRemoveMember({ id: 'u3' }, admin, 1)).toBe(false)
  })

  it('deletes only service accounts', () => {
    expect(canDeleteMember({ type: 'service_account' })).toBe(true)
    expect(canDeleteMember({ type: 'user' })).toBe(false)
  })
})

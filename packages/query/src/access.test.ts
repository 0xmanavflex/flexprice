import { describe, expect, it } from 'vitest'
import type { CurrentUser } from '@fp/api'
import type { Role } from '@fp/domain'
import { toAccessControl } from './access'

const user = (roles: string[]): CurrentUser => ({
  id: 'u1',
  email: 'a@b.c',
  roles,
  type: 'user',
  tenantId: 't',
  tenantName: 'T',
})
const catalogue: Role[] = [
  {
    id: 'all_reader',
    name: '',
    description: '',
    permissions: [{ resource: '*', actions: ['read'] }],
  },
  {
    id: 'super_admin',
    name: '',
    description: '',
    permissions: [{ resource: '*', actions: ['*'] }],
  },
]
const base = { hasToken: true, userFailed: false, catalogueFailed: false }

describe('toAccessControl', () => {
  it('is loading, and denies, until both the user and the catalogue are in', () => {
    const access = toAccessControl({ ...base, user: user(['all_reader']), catalogue: undefined })
    expect(access.status).toBe('loading')
    expect(access.can('plan', 'read')).toBe(false)
  })

  it('answers from the held roles once ready', () => {
    const access = toAccessControl({ ...base, user: user(['all_reader']), catalogue })
    expect(access.status).toBe('ready')
    expect(access.can('plan', 'read')).toBe(true)
    expect(access.can('plan', 'write')).toBe(false)
    expect(access.isSuperAdmin).toBe(false)
  })

  it('knows a super admin', () => {
    const access = toAccessControl({ ...base, user: user(['super_admin']), catalogue })
    expect(access.isSuperAdmin).toBe(true)
    expect(access.meets({ entity: 'setting', action: 'write', superAdmin: true })).toBe(true)
  })

  it('fails closed when a read fails', () => {
    const access = toAccessControl({
      ...base,
      user: user(['super_admin']),
      catalogue: undefined,
      catalogueFailed: true,
    })
    expect(access.status).toBe('error')
    expect(access.can('plan', 'read')).toBe(false)
  })

  it('is unrestricted without a session token (API-key dev builds)', () => {
    const access = toAccessControl({
      ...base,
      hasToken: false,
      user: undefined,
      catalogue: undefined,
    })
    expect(access.status).toBe('unrestricted')
    expect(access.can('plan', 'write')).toBe(true)
  })
})

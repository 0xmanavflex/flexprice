import { describe, expect, it } from 'vitest'
import {
  SUPER_ADMIN_ROLE_ID,
  grantsEverything,
  normalizeRoleSelection,
  summarizePermissions,
  toggleRole,
} from './role'
import type { Role } from './role'

const role = (id: string, permissions: Role['permissions']): Role => ({
  id,
  name: id,
  description: '',
  permissions,
})

describe('normalizeRoleSelection', () => {
  it('drops every other role when super admin is held', () => {
    expect(normalizeRoleSelection(['all_reader', SUPER_ADMIN_ROLE_ID, 'event_reader'])).toEqual([
      SUPER_ADMIN_ROLE_ID,
    ])
  })

  it('leaves a selection without super admin alone, minus duplicates', () => {
    expect(normalizeRoleSelection(['all_reader', 'event_reader', 'all_reader'])).toEqual([
      'all_reader',
      'event_reader',
    ])
  })

  it('is idempotent', () => {
    const once = normalizeRoleSelection(['all_writer', SUPER_ADMIN_ROLE_ID])
    expect(normalizeRoleSelection(once)).toEqual(once)
  })

  it('handles an empty selection', () => {
    expect(normalizeRoleSelection([])).toEqual([])
  })
})

describe('toggleRole', () => {
  it('selecting super admin clears every other role', () => {
    expect(toggleRole(['all_reader', 'event_reader'], SUPER_ADMIN_ROLE_ID)).toEqual([
      SUPER_ADMIN_ROLE_ID,
    ])
  })

  it('selecting another role while super admin is held replaces it', () => {
    // Not "adds to it": normalizing the union would drop the role just ticked,
    // and a checkbox that appears to do nothing is the bug this prevents.
    expect(toggleRole([SUPER_ADMIN_ROLE_ID], 'all_reader')).toEqual(['all_reader'])
  })

  it('adds an ordinary role alongside other ordinary roles', () => {
    expect(toggleRole(['all_reader'], 'event_reader')).toEqual(['all_reader', 'event_reader'])
  })

  it('deselects a held role, including super admin', () => {
    expect(toggleRole(['all_reader', 'event_reader'], 'all_reader')).toEqual(['event_reader'])
    expect(toggleRole([SUPER_ADMIN_ROLE_ID], SUPER_ADMIN_ROLE_ID)).toEqual([])
  })

  it('never produces a selection that normalizing would change', () => {
    const roles = ['all_reader', 'all_writer', 'event_reader', SUPER_ADMIN_ROLE_ID]
    let selected: string[] = []
    for (const id of [...roles, ...roles, ...[...roles].reverse()]) {
      selected = toggleRole(selected, id)
      expect(normalizeRoleSelection(selected)).toEqual(selected)
    }
  })
})

describe('grantsEverything', () => {
  it('is true only for a wildcard resource with a wildcard action', () => {
    expect(grantsEverything(role('super_admin', [{ resource: '*', actions: ['*'] }]))).toBe(true)
    expect(grantsEverything(role('all_reader', [{ resource: '*', actions: ['read'] }]))).toBe(false)
    expect(grantsEverything(role('event_reader', [{ resource: 'event', actions: ['read'] }]))).toBe(
      false,
    )
  })
})

describe('summarizePermissions', () => {
  it('summarises the live roles the API returns', () => {
    expect(summarizePermissions(role('super_admin', [{ resource: '*', actions: ['*'] }]))).toBe(
      'Full access',
    )
    expect(
      summarizePermissions(role('all_writer', [{ resource: '*', actions: ['read', 'write'] }])),
    ).toBe('all: read, write')
    expect(
      summarizePermissions(role('event_ingestor', [{ resource: 'event', actions: ['write'] }])),
    ).toBe('event: write')
  })

  it('says so when a role permits nothing', () => {
    expect(summarizePermissions(role('empty', []))).toBe('No permissions')
  })
})

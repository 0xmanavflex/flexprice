import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_GROUP_QUERY, GroupEntityType, GroupStatus } from '@fp/domain'
import { toGroup, toGroupFilter, withGroupMembers, type GroupWire } from './groups'

describe('toGroup', () => {
  it('counts the members from the entityIds array, and keeps the ids', () => {
    const group = toGroup({
      id: 'group_1',
      name: 'Storage prices',
      lookupKey: 'storage',
      entityType: 'price',
      entityIds: ['price_1', 'price_2', 'price_3'],
      status: 'published',
    })

    expect(group.entityType).toBe(GroupEntityType.Price)
    expect(group.entityCount).toBe(3)
    // The ids are kept as well as counted: the detail page names each member
    // from them. They used to be dropped, and the count was all a caller got.
    expect(group.entityIds).toEqual(['price_1', 'price_2', 'price_3'])
  })

  it('reports zero members when the group is empty or absent', () => {
    expect(toGroup({ entityType: 'feature' }).entityCount).toBe(0)
    expect(toGroup({ entityType: 'feature', entityIds: [] }).entityCount).toBe(0)
  })

  it('falls back to safe defaults for unknown enum values', () => {
    const group = toGroup({ entityType: 'mystery', status: 'deleted' } as GroupWire)
    expect(group.entityType).toBe(GroupEntityType.Price)
    expect(group.status).toBe(GroupStatus.Published)
    expect(group.name).toBe('Untitled group')
  })

  it('reads the feature kind and a published status', () => {
    const group = toGroup({ entityType: 'feature', status: 'archived' })
    expect(group.entityType).toBe(GroupEntityType.Feature)
    expect(group.status).toBe(GroupStatus.Archived)
  })
})

describe('toGroupFilter', () => {
  it('maps a domain sort field to its wire name and computes the offset', () => {
    const filter = toGroupFilter({
      ...DEFAULT_GROUP_QUERY,
      page: 3,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    })
    expect(filter).toMatchObject({
      limit: 25,
      offset: 50,
      sort: [
        { field: 'updated_at', direction: 'desc' },
        { field: 'id', direction: 'desc' },
      ],
    })
  })

  it('omits the name key when the query has no search term', () => {
    expect(toGroupFilter(DEFAULT_GROUP_QUERY)).not.toHaveProperty('name')
    expect(toGroupFilter({ ...DEFAULT_GROUP_QUERY, search: 'storage' })).toHaveProperty(
      'name',
      'storage',
    )
  })
})

describe('withGroupMembers', () => {
  it('counts members from the features and prices that carry the group, one search per type', async () => {
    const search = vi.fn(async (entityType: GroupEntityType) =>
      entityType === GroupEntityType.Feature
        ? [
            { id: 'feat_1', groupId: 'grp_f' },
            { id: 'feat_2', groupId: 'grp_f' },
          ]
        : [{ id: 'price_1', groupId: 'grp_p' }],
    )

    const wires = await withGroupMembers(
      [
        // The API sends `entity_ids: null` for every group.
        { id: 'grp_f', entityType: 'feature' },
        { id: 'grp_p', entityType: 'price' },
        { id: 'grp_empty', entityType: 'feature' },
      ],
      search,
    )

    expect(search).toHaveBeenCalledTimes(2)
    expect(search).toHaveBeenCalledWith(GroupEntityType.Feature, ['grp_f', 'grp_empty'], 0, 1000)
    expect(wires.map((wire) => toGroup(wire).entityCount)).toEqual([2, 1, 0])
  })

  it('leaves alone a group the API already sent members for', async () => {
    const search = vi.fn(async () => [])
    const [wire] = await withGroupMembers(
      [{ id: 'grp', entityType: 'feature', entityIds: ['feat_1'] }],
      search,
    )
    expect(search).not.toHaveBeenCalled()
    expect(wire?.entityIds).toEqual(['feat_1'])
  })
})

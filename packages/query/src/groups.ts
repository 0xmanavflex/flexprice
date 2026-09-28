import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type Group,
  type GroupQuery,
  GroupEntityType,
  GroupSortField,
  GroupStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Groups: the translation between product vocabulary and the API.
 *
 * Reached through `client.groups.queryGroup`, the same search shape features,
 * plans and add-ons use. The wire sends the members as an `entityIds` array;
 * the list only ever shows how many there are, so the domain carries the count
 * and drops the array — no screen enumerates it.
 */

/**
 * The wire shape this reads, after the SDK camelCases the response.
 *
 * `createdAt`/`updatedAt` arrive as `Date` (the SDK parses them).
 */
export interface GroupWire {
  id?: string | undefined
  name?: string | undefined
  lookupKey?: string | undefined
  entityType?: string | undefined
  entityIds?: string[] | undefined
  status?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

const GROUP_STATUSES = new Set<string>(Object.values(GroupStatus))
const GROUP_ENTITY_TYPES = new Set<string>(Object.values(GroupEntityType))

export function toGroup(wire: GroupWire): Group {
  const status = GROUP_STATUSES.has(wire.status ?? '')
    ? (wire.status as GroupStatus)
    : GroupStatus.Published
  const entityType = GROUP_ENTITY_TYPES.has(wire.entityType ?? '')
    ? (wire.entityType as GroupEntityType)
    : GroupEntityType.Price

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled group',
    lookupKey: wire.lookupKey ?? '',
    entityType,
    entityCount: wire.entityIds?.length ?? 0,
    status,
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

const SORT_FIELD: Record<GroupSortField, string> = {
  [GroupSortField.Name]: 'name',
  [GroupSortField.CreatedAt]: 'created_at',
  [GroupSortField.UpdatedAt]: 'updated_at',
}

export function toGroupFilter(query: GroupQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: [{ field: SORT_FIELD[query.sortBy], direction: query.sortDirection }],
    ...(query.search ? { name: query.search } : {}),
  }
}

export interface GroupPage {
  groups: Group[]
  total: number
}

export async function fetchGroups(client: Flexprice, query: GroupQuery): Promise<GroupPage> {
  const response = await call(() => client.groups.queryGroup(toGroupFilter(query) as never))
  const groups = (response.items ?? []).map((item) => toGroup(item as GroupWire))

  return {
    // Status is not a server-side filter here, so it is applied on the page —
    // the same split add-ons and coupons use.
    groups:
      query.statuses.length > 0
        ? groups.filter((group) => query.statuses.includes(group.status))
        : groups,
    total: response.pagination?.total ?? 0,
  }
}

export function useGroups(query: GroupQuery) {
  const client = useFlexprice()

  // `view` is a layout, not a filter: it must not miss the cache on a toggle.
  const { view: _view, ...key } = query

  return useQuery({
    queryKey: queryKeys.groups.list({ ...key, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchGroups(client, query),
    placeholderData: (previous) => previous,
  })
}

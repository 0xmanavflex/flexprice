import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type Charge,
  type CreateGroup,
  type Group,
  type GroupQuery,
  GroupEntityType,
  GroupSortField,
  GroupStatus,
  GROUP_FILTERS,
} from '@fp/domain'
import { toCharge, type ChargeWire } from './prices'
import { queryKeys } from './keys'
import { statusFilterField, toFilterConditions } from './search'
import { useFlexprice } from './provider'
import { sortWithTieBreak } from './listSort'

/**
 * Groups: the translation between product vocabulary and the API.
 *
 * Reached through `client.groups.queryGroup`, the same search shape features,
 * plans and add-ons use. The wire sends the members as an `entityIds` array;
 * the list only ever shows how many there are, so the domain carries the count
 * and drops the array: no screen enumerates it.
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
    entityIds: wire.entityIds ?? [],
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
    /*
     * Status, server-side.
     *
     * It used to narrow the fetched page in the browser, which is a different
     * and wrong thing: the request returns one page, rows are dropped from
     * *that* page, and the pager still reports the server's unfiltered total.
     * `status` is a declared field on this filter model and a real column the
     * backend accepts, so there was never a reason not to send it.
     */
    ...statusFilterField(query.statuses, Object.values(GroupStatus)),
    sort: sortWithTieBreak(SORT_FIELD[query.sortBy], query.sortDirection),
    ...(query.search ? { name: query.search } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...((query.filters?.length ?? 0) > 0
      ? { filters: toFilterConditions(query.filters ?? [], GROUP_FILTERS) }
      : {}),
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
    groups,
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

/** One group, fetched by id through `GET /groups/{id}`. */
export function useGroup(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.groups.detail(id),
    queryFn: async () => {
      const response = await call(() => client.groups.getGroup(id))
      return toGroup(response as GroupWire)
    },
    enabled: id.length > 0,
  })
}

/** Domain draft out, `CreateGroupRequest` in. There is no group update route. */
export function toCreateGroupRequest(draft: CreateGroup): Record<string, unknown> {
  return { name: draft.name, lookupKey: draft.lookupKey, entityType: draft.entityType }
}

export function useCreateGroup() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Group created', error: 'Could not create the group.' } },
    mutationFn: (draft: CreateGroup) =>
      call(() => client.groups.createGroup(toCreateGroupRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all() })
    },
  })
}

/** Delete: `DELETE` by id. Takes the record id. */
export function useDeleteGroup() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.groups.deleteGroup(id)),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all() })
      void queryClient.removeQueries({ queryKey: queryKeys.groups.detail(id) })
      // Members are filed by group id, so their lists can now be stale.
      void queryClient.invalidateQueries({ queryKey: queryKeys.features.all() })
    },
  })
}

/** One thing a group holds, named for the members table. */
export interface GroupMemberRow {
  charge?: Charge
  id: string
  name: string
  detail: string
}

/**
 * What a group holds, by name: its `entityIds` read back through the feature
 * or price search, which both filter by id. Ids the search no longer returns
 * (deleted since) are listed by id so the count still adds up.
 */
export function useGroupMembers(group: Group | undefined) {
  const client = useFlexprice()
  const ids = group?.entityIds ?? []

  return useQuery({
    queryKey: [...queryKeys.groups.detail(group?.id ?? ''), 'members', ids],
    enabled: group !== undefined,
    queryFn: async ({ signal }): Promise<GroupMemberRow[]> => {
      if (!group || ids.length === 0) return []
      const found = new Map<string, GroupMemberRow>()
      if (group.entityType === GroupEntityType.Feature) {
        const response = await call(
          (options) =>
            client.features.queryFeature({ featureIds: ids, limit: ids.length } as never, options),
          signal,
        )
        for (const item of (response.items ?? []) as Array<{
          id?: string
          name?: string
          type?: string
        }>) {
          if (!item.id) continue
          const type = item.type ?? ''
          found.set(item.id, {
            id: item.id,
            name: item.name || item.id,
            detail: type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : 'Feature',
          })
        }
      } else {
        const response = await call(
          (options) =>
            client.prices.queryPrice({ priceIds: ids, limit: ids.length } as never, options),
          signal,
        )
        for (const item of (response.items ?? []) as ChargeWire[]) {
          if (!item.id) continue
          found.set(item.id, {
            id: item.id,
            name: item.displayName || item.meter?.name || item.lookupKey || item.id,
            detail: item.type === 'USAGE' ? 'Usage price' : 'Fixed price',
            charge: toCharge(item),
          })
        }
      }
      return ids.map((id) => found.get(id) ?? { id, name: id, detail: 'Not found' })
    },
  })
}

/** The account's price groups, as choices for a charge: the first 100, by name. */
export function usePriceGroupOptions() {
  const groups = useGroups({
    page: 1,
    pageSize: 100,
    search: '',
    // Only live tags are offered: an archived one cannot take a new price.
    statuses: [GroupStatus.Published],
    sortBy: GroupSortField.Name,
    sortDirection: 'asc',
    view: 'table' as GroupQuery['view'],
    filters: [{ field: 'entity_type', op: 'in', value: [GroupEntityType.Price] }],
  })
  return (groups.data?.groups ?? [])
    .filter(
      (group) =>
        group.entityType === GroupEntityType.Price && group.status === GroupStatus.Published,
    )
    .map((group) => ({ value: group.id, label: group.name }))
}

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, listActivity } from '@fp/api'
import { activityTitle, type ActivityEntry } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

export interface ActivityFilter {
  customerId?: string
  entityType?: string
  entityId?: string
  limit?: number
}

interface ActivityWire {
  id?: string
  action?: string
  occurred_at?: string
  source?: string
  entity?: { id?: string; label?: string; type?: string }
  actor?: { id?: string; label?: string; type?: string }
  state?: Record<string, unknown>
}

export function toActivityEntry(item: ActivityWire): ActivityEntry {
  const entityId = item.entity?.id ?? ''
  const entityLabel = item.entity?.label?.trim() ?? ''
  const occurredAt = item.occurred_at ? new Date(item.occurred_at) : null
  return {
    id: item.id ?? '',
    action: item.action ?? '',
    title: activityTitle(item.action ?? ''),
    occurredAt: occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt : null,
    entityType: item.entity?.type ?? '',
    entityId,
    entityLabel,
    actorType: item.actor?.type ?? '',
    actorId: item.actor?.id ?? '',
    actorLabel: item.actor?.label ?? '',
    source: item.source ?? '',
    ...(item.state && Object.keys(item.state).length > 0 ? { state: item.state } : {}),
  }
}

function canQuery(filter: ActivityFilter): boolean {
  return Boolean(filter.customerId || (filter.entityType && filter.entityId))
}

/** How long to keep looking after a change. The log is written just after the API returns. */
const AWAIT_MS = 8_000
const AWAIT_EVERY_MS = 1_000

/**
 * The audit trail for one customer, or for one entity, including each
 * entity's state just after the change.
 *
 * Entries arrive newest first and are written asynchronously, so a successful
 * change starts a short wait. `isAwaiting` stays true until a newer row
 * appears, or the wait runs out.
 */
export function useActivityLog(filter: ActivityFilter) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()
  const enabled = canQuery(filter)
  const [isAwaiting, setAwaiting] = useState(false)
  const baseline = useRef<string | undefined>(undefined)
  const seenMutations = useRef(new Set<number>())

  const query = useQuery({
    queryKey: queryKeys.activity.list({ ...filter, expand: 'state' }),
    queryFn: async ({ signal }): Promise<ActivityEntry[]> => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to read activity.')
      if (signal?.aborted) throw new ApiError(ErrorKind.Cancelled, 'Cancelled.')
      const body = await listActivity(serverURL, token, environmentId ?? '', filter)
      const items = (body as { items?: ActivityWire[] } | null)?.items ?? []
      return items.filter((item) => item.id).map(toActivityEntry)
    },
    enabled,
    staleTime: 10_000,
  })

  const latestId = query.data?.[0]?.id
  const refetch = query.refetch

  useEffect(() => {
    if (!enabled) return
    const cache = queryClient.getMutationCache()
    return cache.subscribe((event) => {
      if (event.type !== 'updated' || event.mutation.state.status !== 'success') return
      if (seenMutations.current.has(event.mutation.mutationId)) return
      seenMutations.current.add(event.mutation.mutationId)
      baseline.current = latestId
      setAwaiting(true)
    })
  }, [enabled, latestId, queryClient])

  useEffect(() => {
    if (!isAwaiting) return
    if (latestId && latestId !== baseline.current) {
      setAwaiting(false)
      return
    }
    const started = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - started >= AWAIT_MS) {
        setAwaiting(false)
        return
      }
      void refetch()
    }, AWAIT_EVERY_MS)
    void refetch()
    return () => clearInterval(timer)
  }, [isAwaiting, latestId, refetch])

  return { ...query, isAwaiting }
}

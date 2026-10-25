/**
 * Where a settings query is, in terms a panel can branch on.
 *
 *   `ready`    data is on screen: always wins over a spinner or an error
 *   `loading`  a request is actually running (or paused offline and will resume)
 *   `idle`     nothing is running and nothing will: the query is disabled
 *
 * `isPending` alone is not this. A disabled query is `isPending` for ever with
 * `fetchStatus: 'idle'`, so `isPending ? skeleton : …` is a skeleton that never
 * resolves. `idle` is the state that deserves its own screen.
 */
export type QueryPhase = 'ready' | 'loading' | 'idle'

export function queryPhase(query: {
  data?: unknown
  fetchStatus: 'fetching' | 'paused' | 'idle'
}): QueryPhase {
  if (query.data !== undefined && query.data !== null) return 'ready'
  return query.fetchStatus === 'idle' ? 'idle' : 'loading'
}

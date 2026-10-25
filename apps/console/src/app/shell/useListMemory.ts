import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  DEFAULT_ADDON_QUERY,
  DEFAULT_COST_SHEET_QUERY,
  DEFAULT_COUPON_QUERY,
  DEFAULT_CREDIT_NOTE_QUERY,
  DEFAULT_CUSTOMER_QUERY,
  DEFAULT_DATA_EXPORT_QUERY,
  DEFAULT_FEATURE_QUERY,
  DEFAULT_GROUP_QUERY,
  DEFAULT_INVOICE_QUERY,
  DEFAULT_PAYMENT_QUERY,
  DEFAULT_PLAN_QUERY,
  DEFAULT_PRICE_UNIT_QUERY,
  DEFAULT_RAW_EVENT_QUERY,
  DEFAULT_SUBSCRIPTION_QUERY,
  DEFAULT_TAX_RATE_QUERY,
  DEFAULT_USAGE_SYNC_QUERY,
  DEFAULT_WORKFLOW_QUERY,
} from '@fp/domain'
import { rememberQuery, rememberedQuery, restoreTarget } from '../listMemory'
import { useSession } from '../session/SessionProvider'

/**
 * Which paths are lists, and what "no query" means for each.
 *
 * Written out rather than derived from the router so that remembering is a
 * decision per surface, not something that quietly happens to any route with
 * search params. Adding a list here is the whole opt-in; the defaults must be
 * the same object the route strips from the URL, or a bare URL would not read
 * as bare.
 */
// The query types are interfaces without index signatures, which is right:
// they are shapes, not bags. Read as plain records only here, where the
// comparison is structural and the keys are not known ahead of time.
const LISTS: Record<string, Readonly<object>> = {
  '/customers': DEFAULT_CUSTOMER_QUERY,
  '/features': DEFAULT_FEATURE_QUERY,
  '/plans': DEFAULT_PLAN_QUERY,
  '/addons': DEFAULT_ADDON_QUERY,
  '/coupons': DEFAULT_COUPON_QUERY,
  '/price-units': DEFAULT_PRICE_UNIT_QUERY,
  '/groups': DEFAULT_GROUP_QUERY,
  '/cost-sheets': DEFAULT_COST_SHEET_QUERY,
  '/contracts': DEFAULT_SUBSCRIPTION_QUERY,
  '/invoices': DEFAULT_INVOICE_QUERY,
  '/payments': DEFAULT_PAYMENT_QUERY,
  '/credit-memos': DEFAULT_CREDIT_NOTE_QUERY,
  '/usage-syncs': DEFAULT_USAGE_SYNC_QUERY,
  '/workflows': DEFAULT_WORKFLOW_QUERY,
  '/exports': DEFAULT_DATA_EXPORT_QUERY,
  '/taxes': DEFAULT_TAX_RATE_QUERY,
  '/events': DEFAULT_RAW_EVENT_QUERY,
}

/**
 * Remembers each list's query, and restores it when that list is reopened bare.
 *
 * Mounted once in the shell rather than wired into eighteen route components:
 * every list already keeps its query in the URL under the same `validateSearch`
 * and `stripSearchParams` pair, so the location is all this needs. See
 * `listMemory.ts` for the rules it follows and why.
 */
export function useListMemory(): void {
  const navigate = useNavigate()
  const { environmentId } = useSession()
  const pathname = useLocation({ select: (location) => location.pathname })
  const search = useLocation({ select: (location) => location.search }) as Record<string, unknown>

  /*
   * Which list this hook has already tried to restore.
   *
   * Restoring is a once-per-arrival decision. Without this, clearing every
   * filter would be undone on the next render: the URL goes bare again, and a
   * hook that re-checked would put the old query straight back.
   */
  const restoredFor = useRef<string | null>(null)

  useEffect(() => {
    const defaults = LISTS[pathname] as Record<string, unknown> | undefined
    if (!defaults) {
      // Left the lists. The next arrival gets a fresh restore.
      restoredFor.current = null
      return
    }

    /*
     * No environment, nothing to remember against.
     *
     * The id resolves a moment after the first paint: a fresh tab has none
     * until the picker defaults one. Writing during that window files the
     * query under `null` and the read a second later, with the real id, finds
     * nothing: filters that looked remembered would be dropped at random.
     * Waiting costs nothing, because the effect re-runs when the id arrives.
     */
    if (environmentId === null) return

    if (restoredFor.current !== pathname) {
      restoredFor.current = pathname
      const target = restoreTarget(
        rememberedQuery(globalThis.sessionStorage, environmentId, pathname),
        search,
        defaults,
      )
      if (target) {
        // `replace`, so Back leaves the list rather than stepping through the
        // restore: the restore is not a place the person navigated to.
        void navigate({ to: pathname, search: target as never, replace: true })
        return
      }
    }

    rememberQuery(globalThis.sessionStorage, environmentId, pathname, search)
  }, [pathname, search, environmentId, navigate])
}

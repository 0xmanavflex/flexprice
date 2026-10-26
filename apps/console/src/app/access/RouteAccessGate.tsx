import type { ReactNode } from 'react'
import { useMatches } from '@tanstack/react-router'
import { AccessScope, RequireAccess } from '@fp/ui/compositions'
import { CreatingPausedScreen } from '@fp/ui/pages'
import { useAccountLock } from '@/app/selfBilling/AccountLock'
import { routeAccessFor } from './routeAccess'

/**
 * Enforces `ROUTE_ACCESS` for whatever route is showing, as V1's
 * `RouteGuard`: a loader while access loads, "Access denied" in place when the
 * route's requirement is not met, and otherwise the page inside the
 * `AccessScope` its controls write to.
 *
 * A locked (read-only) account opening a page that only writes: a create or
 * edit page: sees "Creating is paused" instead of a form that cannot save.
 */
export function RouteAccessGate({ children }: { children: ReactNode }) {
  const matches = useMatches()
  const lock = useAccountLock()
  const leaf = matches[matches.length - 1]
  const access = routeAccessFor(leaf?.fullPath)
  if (lock.locked && lock.summary && access.require?.action === 'write') {
    return (
      <CreatingPausedScreen
        summary={lock.summary}
        today={lock.today}
        onViewDetails={lock.viewDetails}
        onUpgrade={lock.upgrade}
      />
    )
  }
  const page = access.writes ? (
    <AccessScope entity={access.writes}>{children}</AccessScope>
  ) : (
    children
  )
  return <RequireAccess requirement={access.require}>{page}</RequireAccess>
}

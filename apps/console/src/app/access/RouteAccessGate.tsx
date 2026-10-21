import type { ReactNode } from 'react'
import { useMatches } from '@tanstack/react-router'
import { AccessScope, RequireAccess } from '@fp/ui/compositions'
import { routeAccessFor } from './routeAccess'

/**
 * Enforces `ROUTE_ACCESS` for whatever route is showing, as V1's
 * `RouteGuard`: a loader while access loads, "Access denied" in place when the
 * route's requirement is not met, and otherwise the page inside the
 * `AccessScope` its controls write to.
 */
export function RouteAccessGate({ children }: { children: ReactNode }) {
  const matches = useMatches()
  const leaf = matches[matches.length - 1]
  const access = routeAccessFor(leaf?.fullPath)
  const page = access.writes ? (
    <AccessScope entity={access.writes}>{children}</AccessScope>
  ) : (
    children
  )
  return <RequireAccess requirement={access.require}>{page}</RequireAccess>
}

import { useEffect } from 'react'
import { useCurrentUser } from '@fp/query'
import { useSession } from '@/app/session'
import { identifyUser } from './posthog'

/**
 * Identifies the signed-in person to analytics once `/users/me` answers, as
 * V1's `MainLayout` does. Draws nothing; does nothing when analytics is off.
 */
export function AnalyticsIdentity() {
  const { session } = useSession()
  const user = useCurrentUser(session?.token ?? null).data

  // Primitives, not the `user` object: a refetch returns a fresh reference.
  const id = user?.id
  const email = user?.email
  const tenantId = user?.tenantId
  const tenantName = user?.tenantName

  useEffect(() => {
    if (!id || !email) return
    identifyUser({ id, email, tenantId, tenantName })
  }, [id, email, tenantId, tenantName])

  return null
}

import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { RBAC_ENTITY, isTenantOnboarded } from '@fp/domain'
import { useCurrentUser, useTenant } from '@fp/query'
import { useWriteAccess } from '@fp/ui/compositions'
import { useSession } from '@/app/session'

/**
 * Sends a signed-in user whose tenant has not finished onboarding to
 * `/onboarding`. Used on Home, which is where V1 made the same check (its
 * default route) and where sign-in and sign-up land.
 *
 * Waits for the tenant to load: a tenant still loading, or one that failed to
 * load, is not "not onboarded", and bouncing an existing customer into the form
 * because a request was slow would be worse than not asking. An API-key session
 * has no user, so it is never gated.
 *
 * Only a member who can write the tenant is sent: the answers are a tenant
 * write. A reader (or a locked account) would land on a form it cannot submit,
 * so it stays on Home until someone who can answers.
 */
export function useOnboardingGate() {
  const navigate = useNavigate()
  const { session } = useSession()
  const user = useCurrentUser(session?.token ?? null).data
  const tenant = useTenant(user?.tenantId ?? '').data
  // Not allowed while access is still loading, so this waits for it too.
  const canAnswer = useWriteAccess(RBAC_ENTITY.Tenant).allowed

  const needsOnboarding = canAnswer && tenant !== undefined && !isTenantOnboarded(tenant)

  useEffect(() => {
    if (needsOnboarding) void navigate({ to: '/onboarding', replace: true })
  }, [needsOnboarding, navigate])
}

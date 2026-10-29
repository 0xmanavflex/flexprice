import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { type TenantOnboarding, isTenantOnboarded, onboardedMetadata } from '@fp/domain'
import { ApiError, ErrorKind, useCurrentUser, useTenant, useUpdateTenantMetadata } from '@fp/query'
import { OnboardingScreen, toast } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { recordOnboarding } from '@/app/onboarding/recordOnboarding'

export function messageForOnboardingError(error: unknown): string {
  if (!(error instanceof ApiError)) return "We couldn't save your workspace. Try again."
  switch (error.kind) {
    case ErrorKind.Network:
      return 'Could not reach Flexprice. Check your connection and try again.'
    case ErrorKind.Timeout:
      return 'Saving your workspace took too long. Try again.'
    case ErrorKind.Server:
      return 'Flexprice is having trouble right now. Try again in a moment.'
    default:
      return error.message || "We couldn't save your workspace. Try again."
  }
}

/**
 * Tenant onboarding (`/onboarding`): the three questions, then Home.
 *
 * Saves as V1 does: `PUT /tenants/update` with the organization name and the
 * tenant's metadata plus `onboarding_completed`, `onboarding_referral_source`
 * and `onboarding_organization_url`. Then, without waiting, appends the answers
 * to the onboarding sheet: that call never throws and never blocks Home.
 */
export function OnboardingPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const user = useCurrentUser(session?.token ?? null).data
  const tenantId = user?.tenantId ?? ''
  const tenant = useTenant(tenantId)
  const update = useUpdateTenantMetadata()
  const [failure, setFailure] = useState<string | null>(null)

  // Onboarded already (in V1, or on another device): nothing left to ask.
  const done = tenant.data !== undefined && isTenantOnboarded(tenant.data)
  useEffect(() => {
    if (done && !update.isPending && !update.isSuccess) void navigate({ to: '/', replace: true })
  }, [done, update.isPending, update.isSuccess, navigate])

  const submit = (answers: TenantOnboarding) => {
    // Metadata is replaced whole, so the tenant's current keys must be in hand.
    if (!tenant.data) {
      setFailure("Your workspace hasn't finished loading. Try again in a moment.")
      return
    }
    setFailure(null)
    update.mutate(
      { name: answers.orgName, metadata: onboardedMetadata(tenant.data.metadata, answers) },
      {
        onSuccess: () => {
          void recordOnboarding({
            orgName: answers.orgName,
            orgUrl: answers.orgUrl,
            referralSource: answers.referralSource,
            userEmail: user?.email ?? '',
            tenantId,
            timestamp: new Date().toISOString(),
          })
          toast.success("You're all set!")
          void navigate({ to: '/', replace: true })
        },
        onError: (error) => setFailure(messageForOnboardingError(error)),
      },
    )
  }

  return (
    <main className="bg-background min-h-svh">
      <OnboardingScreen onSubmit={submit} isSubmitting={update.isPending} error={failure} />
    </main>
  )
}

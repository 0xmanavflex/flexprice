import { useState } from 'react'
import { AccountState, type CheckoutDetails, CheckoutStatus, toUpdateTenantDraft } from '@fp/domain'
import {
  selfBillingToday,
  useSelfBillingSummary,
  useStartSelfBillingCheckout,
  useUpdateTenant,
} from '@fp/query'
import { PageLoadingState } from '@fp/ui/compositions'
import { UpgradeView } from '@fp/ui/pages'
import { mutationMessage } from '../settings/panelKit'
import {
  checkoutDefaults,
  differsFromOrganization,
  hasOrganizationDetails,
  rememberCheckout,
  useOrganization,
} from './organization'

/**
 * Upgrade: the billing details, then Stripe Checkout.
 *
 * The company and address are written back to Settings → Organization first —
 * the first time, so they are not typed again, and after a change made here.
 * A locked account cannot write Organization (the API refuses every write but
 * paying), so it sends them with the checkout only. The checkout id waits in
 * session storage for the page Stripe returns to.
 */
export function UpgradePage({
  onBack,
  onAlreadyPaid,
}: {
  onBack: () => void
  /** The account was already paid for: the return page shows it as live. */
  onAlreadyPaid: () => void
}) {
  const summary = useSelfBillingSummary()
  const organization = useOrganization()
  const updateTenant = useUpdateTenant()
  const checkout = useStartSelfBillingCheckout()
  const [redirecting, setRedirecting] = useState(false)

  if (summary.isPending || organization.isPending) return <PageLoadingState />

  const state = summary.data?.state ?? AccountState.Trialing
  const tenant = organization.tenant
  const locked = state === AccountState.Suspended

  const submit = async (details: CheckoutDetails) => {
    if (tenant && !locked && differsFromOrganization(tenant, details)) {
      const draft = toUpdateTenantDraft(tenant)
      await updateTenant.mutateAsync({
        ...draft,
        name: details.name,
        billingEmail: details.email,
        address: {
          line1: details.line1,
          line2: details.line2,
          city: details.city,
          state: details.state,
          postalCode: details.postalCode,
          country: details.country,
        },
      })
    }
    const started = await checkout.mutateAsync(details)
    if (started.status === CheckoutStatus.Completed && started.terminal) {
      onAlreadyPaid()
      return
    }
    if (started.checkoutId) rememberCheckout(started.checkoutId)
    setRedirecting(true)
    window.location.assign(started.url)
  }

  const error =
    mutationMessage(updateTenant.error, 'Your organization details could not be saved.') ??
    mutationMessage(checkout.error, 'Checkout could not be opened. Try again.')

  return (
    <UpgradeView
      state={state}
      eventCap={summary.data?.events?.cap ?? null}
      defaultValues={checkoutDefaults(tenant)}
      fromOrganization={hasOrganizationDetails(tenant)}
      today={selfBillingToday()}
      submitting={updateTenant.isPending || checkout.isPending || redirecting}
      submitError={error}
      onBack={onBack}
      onSubmit={(details) => void submit(details).catch(() => undefined)}
    />
  )
}

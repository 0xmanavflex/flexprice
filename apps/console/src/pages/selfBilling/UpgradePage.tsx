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
  differsInName,
  hasOrganizationDetails,
  rememberCheckout,
  useOrganization,
} from './organization'

/**
 * Upgrade: the billing details, then Stripe Checkout.
 *
 * The checkout itself saves the address to Settings → Organization (and to the
 * Flexprice Cloud customer), locked or not, and the billing email to the
 * Flexprice Cloud customer only: Organization's billing email is what the
 * workspace's own customers see, so it is never touched here. A changed company
 * name is written to Organization first: except on a locked account, whose
 * writes the API refuses. The checkout id waits in
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
    if (tenant && !locked && differsInName(tenant, details)) {
      const draft = toUpdateTenantDraft(tenant)
      await updateTenant.mutateAsync({
        ...draft,
        name: details.name,
      })
    }
    const started = await checkout.mutateAsync(details)
    if (started.status === CheckoutStatus.Completed && started.terminal) {
      onAlreadyPaid()
      return
    }
    if (started.checkoutId) rememberCheckout(started.checkoutId, details.email)
    setRedirecting(true)
    window.location.assign(started.url)
  }

  const error =
    mutationMessage(updateTenant.error, 'Your organization details could not be saved.') ??
    mutationMessage(checkout.error, 'Checkout could not be opened. Try again.')

  return (
    <UpgradeView
      state={state}
      plan={summary.data?.plan ?? null}
      eventCap={summary.data?.events?.cap ?? null}
      defaultValues={checkoutDefaults(tenant, organization.userEmail)}
      fromOrganization={hasOrganizationDetails(tenant)}
      today={selfBillingToday()}
      submitting={updateTenant.isPending || checkout.isPending || redirecting}
      submitError={error}
      onBack={onBack}
      onSubmit={(details) => void submit(details).catch(() => undefined)}
    />
  )
}

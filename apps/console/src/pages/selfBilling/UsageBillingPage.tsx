import {
  useSelfBillingPortalSession,
  useSelfBillingStatus,
  useSelfBillingSummary,
  selfBillingToday,
} from '@fp/query'
import { UsageBillingView } from '@fp/ui/pages'
import {
  Panel,
  PanelError,
  PanelLoading,
  PanelUnavailable,
  mutationMessage,
  toFailure,
} from '../settings/panelKit'
import { useOrganization } from './organization'

/**
 * Settings → Usage & billing: the tenant's own Flexprice account. The billing
 * portal opens in a new tab, for paying an invoice or changing the card.
 */
export function UsageBillingPage({ onUpgrade }: { onUpgrade: () => void }) {
  const status = useSelfBillingStatus()
  const summary = useSelfBillingSummary({ enabled: Boolean(status.data?.enabled) })
  const organization = useOrganization()
  const portal = useSelfBillingPortalSession()

  const failure = toFailure(status.error ?? summary.error, 'your Flexprice billing')
  if (failure) {
    return (
      <Panel>
        <PanelError
          failure={failure}
          onRetry={() => {
            void status.refetch()
            void summary.refetch()
          }}
        />
      </Panel>
    )
  }
  if (status.isPending) return <PanelLoading rows={6} />
  if (!status.data?.enabled) {
    return (
      <PanelUnavailable
        reason="unavailable"
        title="Usage & billing is not available"
        description="This deployment does not bill its workspaces through Flexprice."
      />
    )
  }
  if (summary.isPending || !summary.data) return <PanelLoading rows={6} />

  return (
    <Panel>
      <UsageBillingView
        summary={summary.data}
        today={selfBillingToday()}
        billingEmail={organization.tenant?.billingEmail ?? ''}
        onUpgrade={onUpgrade}
        onOpenPortal={() =>
          portal.mutate(undefined, {
            onSuccess: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
          })
        }
        portalPending={portal.isPending}
        portalError={mutationMessage(portal.error, 'The billing portal could not be opened.')}
      />
    </Panel>
  )
}

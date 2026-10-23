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

/**
 * Settings → Usage & billing: the tenant's own Flexprice account. The billing
 * portal opens in a new tab, for paying an invoice or changing the card.
 */
export function UsageBillingPage({ onUpgrade }: { onUpgrade: () => void }) {
  const status = useSelfBillingStatus()
  const summary = useSelfBillingSummary({ enabled: Boolean(status.data?.enabled) })
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
  if (summary.isPending) return <PanelLoading rows={6} />
  // On, but no account yet: the summary answers 404 until this workspace has a
  // Flexprice Cloud customer (signup provisions it in the background, and a
  // workspace from before self-billing gets one on the hourly sync).
  if (!summary.data) {
    return (
      <PanelUnavailable
        reason="unavailable"
        title="Your billing account is being set up"
        description="Usage & billing appears here once your Flexprice account is ready. Check back in a few minutes."
      />
    )
  }

  return (
    <Panel>
      <UsageBillingView
        summary={summary.data}
        today={selfBillingToday()}
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

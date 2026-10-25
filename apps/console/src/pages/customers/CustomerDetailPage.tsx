import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CustomerStatus, SubscriptionStatus, type TenantFeatureUsage } from '@fp/domain'
import {
  useCustomer,
  useCustomerIntegrationLinks,
  useIntegrations,
  useLinkCustomerIntegration,
  useUnlinkCustomerIntegration,
  usePushCustomerToIntegrations,
  useCustomerInvoices,
  useCustomerPayments,
  useCustomerSubscriptions,
  useActivityLog,
  useCustomerUsageSummary,
  useDeleteCustomer,
  useGenerateSampleEvents,
  useUpdateCustomer,
  SAMPLE_EVENT_DURATION_SECONDS,
} from '@fp/query'
import {
  CUSTOMER_TABS,
  CustomerDetail,
  CustomerEntitlementUsage,
  toast,
  type CustomerTab,
} from '@fp/ui/pages'
import { useEnvironments } from '@/app/shell/useEnvironments'
import { useCustomerPortal } from '@/app/customerPortal/useCustomerPortal'
import { CustomerAnalyticsPanel } from '@/pages/customers/CustomerAnalyticsPanel'
import { CustomerEventsPanel } from '@/pages/customers/CustomerEventsPanel'
import { CustomerTaxPanel } from '@/pages/customers/CustomerTaxPanel'
import { CustomerWalletPanel } from '@/pages/customers/CustomerWalletPanel'
import { ConfirmDialog, EmptyState, Section } from '@fp/ui/compositions'
import { toActivityLogEntry } from '@/pages/shared/activityLog'
import { detailGate } from '@/pages/shared/detailGate'
import { useInvoiceRowActions } from '@/pages/invoices/useInvoiceRowActions'

/**
 * Turns whatever is in `?tab=` into a real section, defaulting to Overview.
 *
 * Exported so the route can validate its search param against the same list the
 * page renders: one source of truth for which sections exist. The retired
 * `?tab=subscriptions` is not in that list, so it lands on Overview, where the
 * contracts now live.
 */
export function parseCustomerTab(value: unknown): CustomerTab {
  return typeof value === 'string' && (CUSTOMER_TABS as readonly string[]).includes(value)
    ? (value as CustomerTab)
    : 'overview'
}

export interface CustomerDetailPageProps {
  customerId: string
  tab: CustomerTab
  onTabChange: (tab: CustomerTab) => void
  onNavigateToList: () => void
  /** Open the full Edit page. */
  onEdit: (customerId: string) => void
}

/**
 * The wiring layer for a customer's detail page.
 *
 * Reads the customer, then: because the subscription and invoice endpoints are
 * keyed by the *external* id: scopes those to what the customer record reports.
 * The two scoped hooks are gated on that id, so they sit idle until it is known
 * rather than fetching the whole book. All presentation is `CustomerDetail`'s;
 * this only fetches, maps an error to a sentence, and hands over the data.
 */
export function CustomerDetailPage({
  customerId,
  tab,
  onTabChange,
  onNavigateToList,
  onEdit,
}: CustomerDetailPageProps) {
  const customer = useCustomer(customerId)
  const portal = useCustomerPortal()
  const activity = useActivityLog({ customerId })
  const integrationLinks = useCustomerIntegrationLinks(customerId)
  const integrations = useIntegrations()
  const linkIntegration = useLinkCustomerIntegration(customerId)
  const unlinkIntegration = useUnlinkCustomerIntegration(customerId)
  const pushCustomer = usePushCustomerToIntegrations(customerId)
  // The providers a push reaches: connected, with customer sync on outbound.
  const pushTargets = (integrations.data ?? [])
    .filter((integration) => integration.connection?.syncConfig.customer?.outbound)
    .map((integration) => integration.name)
  const externalId = customer.data?.externalId ?? ''
  const subscriptions = useCustomerSubscriptions(externalId)
  const invoices = useCustomerInvoices(externalId)
  // No customer filter on the payments API: read the payments of the most recent invoices.
  const payments = useCustomerPayments(
    (invoices.data?.invoices ?? []).slice(0, 10).map((invoice) => invoice.id),
  )
  // Keyed on the *internal* id: `GET /customers/usage` takes that, unlike the
  // subscription and invoice reads above, which are scoped by the external one.
  const usage = useCustomerUsageSummary(customerId)
  const update = useUpdateCustomer()
  const remove = useDeleteCustomer()
  const [archiving, setArchiving] = useState(false)
  const environments = useEnvironments()
  const sampleEvents = useGenerateSampleEvents()
  /*
   * Sample events are for trying the product out, so, as in V1, they are only
   * offered outside production, and only for a subscription that can bill
   * them. The first live one is used; V1 asks for exactly one as well.
   */
  const streamTarget =
    environments.current.kind === 'sandbox' && environments.current.id
      ? (subscriptions.data ?? []).find(
          (subscription) =>
            subscription.status === SubscriptionStatus.Active ||
            subscription.status === SubscriptionStatus.Trialing,
        )
      : undefined
  const streamEvents = (subscriptionId: string, planName: string) => {
    sampleEvents.mutate(subscriptionId, {
      onSuccess: () =>
        toast.success('Streaming sample events', {
          description: `For the next ${SAMPLE_EVENT_DURATION_SECONDS} seconds, on ${planName}. They show in Events as they are ingested.`,
          action: { label: 'View events', onClick: () => onTabChange('events') },
        }),
      onError: (cause) =>
        toast.error(cause instanceof Error ? cause.message : 'Could not start streaming events.'),
    })
  }
  const navigate = useNavigate()
  // The customer is already on screen, so the menu leaves out "View customer".
  const invoiceRows = useInvoiceRowActions({
    onRecordPayment: (invoiceId) =>
      void navigate({ to: '/payments/new', search: { invoice: invoiceId } }),
    onIssueCreditNote: (invoiceId) =>
      void navigate({ to: '/credit-memos/new', search: { invoice: invoiceId } }),
    onEditInvoice: (invoiceId) =>
      void navigate({ to: '/invoices/$invoiceId/edit', params: { invoiceId } }),
    onOpenContract: (subscriptionId) =>
      void navigate({ to: '/contracts/$subscriptionId', params: { subscriptionId } }),
  })

  if (!customer.data) {
    return detailGate(customer, {
      noun: 'this customer',
      listName: 'customers',
      onBack: onNavigateToList,
      recordPath: `/customers/${encodeURIComponent(customerId)}`,
    })
  }

  // An archived customer is read-only (CustomerDetail shows why). The page's
  // own write handlers are withheld too, so controls that do not consult the
  // access scope: inline edits, metadata, integration links, the wallet and
  // tax panels: cannot write either.
  const archived = customer.data.status === CustomerStatus.Archived

  return (
    <>
      <CustomerDetail
        {...(!archived && integrationLinks.isSuccess && integrations.isSuccess
          ? {
              integrationControls: {
                links: integrationLinks.data,
                linkable: integrations.data
                  .filter(
                    (integration) =>
                      integration.connection &&
                      !integrationLinks.data.some(
                        (link) => link.providerType === integration.providerType,
                      ),
                  )
                  .map(({ providerType, name }) => ({ providerType, name })),
                onLink: (input: { providerType: string; providerEntityId: string }) =>
                  linkIntegration.mutateAsync(input),
                onUnlink: (input: { providerType: string }) => unlinkIntegration.mutateAsync(input),
                ...(pushTargets.length > 0
                  ? {
                      pushProviders: pushTargets,
                      onPush: () =>
                        pushCustomer.mutate(undefined, {
                          onSuccess: () =>
                            toast.success(`Pushing customer to ${pushTargets.join(', ')}`, {
                              description:
                                'The provider record is created or updated in the background.',
                            }),
                          onError: (cause) =>
                            toast.error(
                              cause instanceof Error
                                ? cause.message
                                : 'Could not push this customer.',
                            ),
                        }),
                    }
                  : {}),
              },
            }
          : {})}
        customer={customer.data}
        activity={
          activity.data
            ? activity.data.map((entry) => {
                const row = toActivityLogEntry(entry)
                if (entry.entityType !== 'customer' || !customer.data.name) return row
                return { ...row, record: customer.data.name }
              })
            : []
        }
        activityLoading={activity.isPending}
        activityError={activity.isError}
        activityAwaiting={activity.isAwaiting}
        subscriptions={subscriptions.data ?? []}
        invoices={invoices.data?.invoices ?? []}
        tab={tab}
        onTabChange={onTabChange}
        onBack={onNavigateToList}
        onCreateInvoice={() =>
          void navigate({ to: '/invoices/new', search: { customer: customerId } })
        }
        onCreateContract={() =>
          void navigate({
            to: '/customers/$customerId/contracts/new',
            params: { customerId: customer.data.id },
          })
        }
        onEdit={() => onEdit(customer.data.id)}
        onArchive={() => setArchiving(true)}
        onCopyPortalLink={() => void portal.copy({ externalId: customer.data?.externalId })}
        {...(streamTarget && !sampleEvents.isPending
          ? { onStreamEvents: () => streamEvents(streamTarget.id, streamTarget.planName) }
          : {
              streamEventsReason:
                environments.current.kind !== 'sandbox' || !environments.current.id
                  ? 'Sample events are only available in a sandbox.'
                  : subscriptions.isPending
                    ? "Checking this customer's contracts."
                    : sampleEvents.isPending
                      ? 'A sample stream is already starting.'
                      : 'Needs an active or trialing contract.',
            })}
        onOpenInvoice={(invoiceId) =>
          void navigate({ to: '/invoices/$invoiceId', params: { invoiceId } })
        }
        invoiceActions={invoiceRows.actionsFor}
        onViewAllPayments={() => void navigate({ to: '/payments', search: {} as never })}
        onOpenPlan={(planId) =>
          void navigate({ to: '/plans/$planId', params: { planId }, search: {} as never })
        }
        onOpenContract={(subscriptionId) =>
          void navigate({
            to: '/contracts/$subscriptionId',
            params: { subscriptionId },
            search: {} as never,
          })
        }
        {...(archived
          ? {}
          : {
              onUpdateField: (patch: { name?: string; email?: string; phone?: string }) =>
                update.mutateAsync({
                  id: customer.data.id,
                  draft: {
                    externalId: customer.data.externalId,
                    name: customer.data.name,
                    ...patch,
                  },
                }),
              onUpdateMetadata: (metadata: Record<string, string>) =>
                update.mutateAsync({
                  id: customer.data.id,
                  draft: {
                    externalId: customer.data.externalId,
                    name: customer.data.name,
                    metadata,
                  },
                }),
            })}
        entitlements={usage.data?.features ?? []}
        entitlementsLoading={usage.isLoading}
        entitlementsError={usage.isError && !usage.data}
        onRetryEntitlements={() => void usage.refetch()}
        subscriptionsLoading={subscriptions.isLoading}
        subscriptionsError={subscriptions.isError && !subscriptions.data}
        onRetrySubscriptions={() => void subscriptions.refetch()}
        invoicesLoading={invoices.isLoading}
        invoicesError={invoices.isError && !invoices.data}
        onRetryInvoices={() => void invoices.refetch()}
        payments={invoices.data ? payments.payments : undefined}
        paymentsLoading={invoices.isLoading || payments.isLoading}
        paymentsError={payments.isError}
        onRetryPayments={payments.refetch}
        events={
          customer.data.externalId ? (
            <CustomerEventsPanel externalId={customer.data.externalId} />
          ) : (
            <EmptyState
              scene="customers"
              title="No external ID"
              description="Events are matched to a customer by external ID, and this customer has none."
            />
          )
        }
        // Read-only, not disabled wholesale: switching between wallets still works.
        wallet={<CustomerWalletPanel customerId={customer.data.id} readOnly={archived} />}
        taxes={
          <fieldset disabled={archived} className="contents">
            <CustomerTaxPanel customerId={customer.data.id} />
          </fieldset>
        }
        usage={
          <div className="flex flex-col gap-8">
            {customer.data.externalId ? (
              <CustomerAnalyticsPanel externalId={customer.data.externalId} />
            ) : (
              <Section title="Analytics">
                <EmptyState
                  scene="customers"
                  size="inline"
                  title="No external ID"
                  description="Usage is matched to a customer by external ID, and this customer has none. Allowances and consumption are below."
                />
              </Section>
            )}
            <UsageSection
              features={usage.data?.features ?? []}
              isLoading={usage.isLoading}
              failed={usage.error !== null}
              onRetry={() => void usage.refetch()}
            />
          </div>
        }
      />
      <ConfirmDialog
        open={archiving}
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(false)
            remove.reset()
          }
        }}
        title={`Archive ${customer.data.name}?`}
        description="The customer is removed from your billing. This cannot be undone."
        confirmLabel="Archive customer"
        onConfirm={() =>
          remove.mutate(customer.data.id, {
            onSuccess: () => {
              setArchiving(false)
              onNavigateToList()
            },
          })
        }
        isPending={remove.isPending}
        destructive
        error={remove.error ? 'Could not archive the customer. Try again.' : null}
      />
      {invoiceRows.dialogs}
    </>
  )
}

/**
 * A customer's entitlement quotas, one table row per entitled feature: the
 * table V1 shows, in place of the cards this used to draw.
 *
 * Reads `GET /customers/usage`, the only endpoint that answers "how much of
 * this allowance has been used" per feature. Source, mode and measure (V1's
 * other columns) are not on `TenantFeatureUsage`, and units are not kept
 * either, so the readings are bare counts rather than invented nouns.
 */
function UsageSection({
  features,
  isLoading,
  failed,
  onRetry,
}: {
  features: TenantFeatureUsage[]
  isLoading: boolean
  failed: boolean
  onRetry: () => void
}) {
  return (
    <CustomerEntitlementUsage
      rows={features.map((feature) => ({
        id: feature.featureId,
        name: feature.featureName || feature.featureId,
        type: feature.featureType,
        used: toCount(feature.currentUsage),
        limit: feature.isUnlimited ? null : feature.limit,
        isEnabled: feature.isEnabled,
        resetsOn: feature.nextUsageResetAt,
      }))}
      isLoading={isLoading}
      error={failed ? 'Usage could not be loaded.' : null}
      onRetry={onRetry}
    />
  )
}

/**
 * A decimal string the API sent, as a number for display.
 *
 * These are counts: events, seats, calls: not money, so reading them as
 * numbers is display formatting rather than the arithmetic `money.ts` forbids.
 * `undefined` for anything unparseable, which renders as a dash rather than a
 * zero: "the API sent something we could not read" is not "nothing was used".
 */
function toCount(value: string): number | undefined {
  if (value === '') return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  BillingEntityMode,
  CARD_SETUP_PROVIDERS,
  CustomerStatus,
  SubscriptionStatus,
  connectionForEntity,
  effectiveEntityId,
  type Integration,
} from '@fp/domain'
import {
  useBillingEntities,
  useBillingEntityStatus,
  useCustomer,
  useCustomerIntegrationLinks,
  useConnections,
  useLinkCustomerIntegration,
  useUnlinkCustomerIntegration,
  usePushCustomerToIntegrations,
  useAddCustomerCard,
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
  ActivityEventSheet,
  AddCardDialog,
  CUSTOMER_TABS,
  CustomerDetail,
  toast,
  type CustomerTab,
} from '@fp/ui/pages'
import { useEnvironments } from '@/app/shell/useEnvironments'
import { useCustomerPortal } from '@/app/customerPortal/useCustomerPortal'
import { CustomerAnalyticsPanel } from '@/pages/customers/CustomerAnalyticsPanel'
import { CustomerEventsPanel } from '@/pages/customers/CustomerEventsPanel'
import { CustomerTaxPanel } from '@/pages/customers/CustomerTaxPanel'
import { FxRatesPanel } from '@/pages/forex/FxRatesPanel'
import { CustomerWalletPanel } from '@/pages/customers/CustomerWalletPanel'
import { useSyncWatch } from '@/pages/integrations/useSyncWatch'
import { ConfirmDialog, EmptyState, Section } from '@fp/ui/compositions'
import { toActivityLogEntry } from '@/pages/shared/activityLog'
import { CustomerActivityPanel, toActivityRow } from './CustomerActivityPanel'
import type { ActivitySearch } from './activitySearch'
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
  /** The Activity tab's filters, from the URL. */
  activitySearch?: ActivitySearch | undefined
  onActivitySearchChange?: ((next: ActivitySearch) => void) | undefined
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
  activitySearch,
  onActivitySearchChange,
}: CustomerDetailPageProps) {
  const customer = useCustomer(customerId)
  const portal = useCustomerPortal()
  // The most the API returns with state expanded: one contract create alone
  // writes several rows (contract, invoice, payment), so 20 could push the
  // contract itself off the rail.
  const activity = useActivityLog({ customerId, limit: 50 })
  // The overview card's event open in the details drawer.
  const [openActivityId, setOpenActivityId] = useState<string | null>(null)
  const openActivity = activity.data?.find((entry) => entry.id === openActivityId) ?? null
  const integrationLinks = useCustomerIntegrationLinks(customerId)
  const integrations = useConnections()
  const linkIntegration = useLinkCustomerIntegration(customerId)
  const unlinkIntegration = useUnlinkCustomerIntegration(customerId)
  const pushCustomer = usePushCustomerToIntegrations(customerId)
  // A push only starts the provider syncs; this follows them to their end.
  const syncWatch = useSyncWatch('customer', customerId, () => {
    void integrationLinks.refetch()
  })
  const entitiesOn = useBillingEntityStatus().data === BillingEntityMode.Enabled
  const entities = useBillingEntities()
  // With entities on, a push reaches the customer's entity's connection.
  const pushEntityId =
    entitiesOn && customer.data && entities.data
      ? effectiveEntityId(customer.data, entities.data)
      : null
  // The customer's connection to a provider: its entity's while entities are on.
  const customerConnection = (integration: Integration) =>
    pushEntityId !== null
      ? connectionForEntity(integration, pushEntityId, entities.data ?? [])
      : integration.connections[0]
  // The providers a push reaches: connected, with customer sync on outbound.
  const pushTargets = (integrations.data ?? [])
    .filter((integration) => customerConnection(integration)?.syncConfig.customer?.outbound)
    .map((integration) => integration.name)
  // Where a card can be saved: the connected providers with a hosted setup page.
  const cardProviders = (integrations.data ?? [])
    .filter(
      (integration) =>
        customerConnection(integration) &&
        (CARD_SETUP_PROVIDERS as readonly string[]).includes(integration.providerType),
    )
    .map(({ providerType, name }) => ({ providerType, name }))
  const addCard = useAddCustomerCard(customerId)
  const [addingCard, setAddingCard] = useState(false)
  // By internal id, so an archived customer's contracts and invoices still load.
  const subscriptions = useCustomerSubscriptions(customerId)
  const invoices = useCustomerInvoices(customerId)
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
  const entityId = entitiesOn ? effectiveEntityId(customer.data, entities.data ?? []) : ''
  const entity = entities.data?.find((item) => item.id === entityId)

  return (
    <>
      <CustomerDetail
        {...(entity
          ? {
              billingEntity: {
                name: entity.name,
                onOpen: () =>
                  void navigate({
                    to: '/settings/billing-entities/$entityId',
                    params: { entityId: entity.id },
                    search: {} as never,
                  }),
              },
            }
          : {})}
        {...(!archived && integrationLinks.isSuccess && integrations.isSuccess
          ? {
              integrationControls: {
                links: integrationLinks.data,
                linkable: integrations.data
                  .filter(
                    (integration) =>
                      integration.connections.length > 0 &&
                      !integrationLinks.data.some(
                        (link) => link.providerType === integration.providerType,
                      ),
                  )
                  .map(({ providerType, name }) => ({ providerType, name })),
                onLink: (input: { providerType: string; providerEntityId: string }) =>
                  linkIntegration.mutateAsync(input),
                onUnlink: (input: { providerType: string }) => unlinkIntegration.mutateAsync(input),
                syncing: pushCustomer.isPending,
                syncRuns: syncWatch.runs,
                ...(pushTargets.length > 0
                  ? {
                      pushProviders: pushTargets,
                      onPush: () =>
                        pushCustomer.mutate(undefined, {
                          onSuccess: () => {
                            syncWatch.watch()
                            toast(`Pushing customer to ${pushTargets.join(', ')}`, {
                              description: 'You are told here when each provider has it.',
                            })
                          },
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
                const row = {
                  ...toActivityLogEntry(entry),
                  onSelect: () => setOpenActivityId(entry.id),
                }
                // On its own page the customer is the subject already: the
                // line is its state ("Taxable · Active"), not its name.
                if (entry.entityType === 'customer' && entry.entityId === customerId) {
                  const { record: _record, ...rest } = row
                  return rest
                }
                return row
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
        {...(!archived && cardProviders.length > 0 ? { onAddCard: () => setAddingCard(true) } : {})}
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
        activityTab={
          <CustomerActivityPanel
            customerId={customerId}
            customerName={customer.data.name}
            search={activitySearch ?? {}}
            onSearchChange={onActivitySearchChange ?? (() => undefined)}
          />
        }
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
        fxOverrides={
          <FxRatesPanel
            owner={{ scope: 'customer', scopeId: customer.data.id }}
            emptyDescription="This customer uses the global forex rates."
            readOnly={archived}
          />
        }
        usage={
          customer.data.externalId ? (
            <CustomerAnalyticsPanel externalId={customer.data.externalId} />
          ) : (
            <Section title="Analytics">
              <EmptyState
                scene="customers"
                size="inline"
                title="No external ID"
                description="Usage is matched to a customer by external ID, and this customer has none."
              />
            </Section>
          )
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
      <AddCardDialog
        open={addingCard}
        onOpenChange={setAddingCard}
        customerName={customer.data.name}
        providers={cardProviders}
        onCreateLink={({ provider, setDefault }) =>
          addCard.mutateAsync({ provider, setDefault, returnUrl: window.location.href })
        }
      />
      {invoiceRows.dialogs}
      <ActivityEventSheet
        row={openActivity ? toActivityRow(openActivity, customer.data.name) : null}
        onClose={() => setOpenActivityId(null)}
        onNavigate={(href) => void navigate({ to: href })}
      />
    </>
  )
}

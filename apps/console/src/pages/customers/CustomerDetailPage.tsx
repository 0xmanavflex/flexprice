import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { TenantFeatureUsage } from '@fp/domain'
import {
  useCustomer,
  useCustomerInvoices,
  useCustomerPayments,
  useCustomerSubscriptions,
  useCustomerUsageSummary,
  useDeleteCustomer,
  useUpdateCustomer,
} from '@fp/query'
import { CUSTOMER_TABS, CustomerDetail, QuotaCard, type CustomerTab } from '@fp/ui/pages'
import { CustomerEventsPanel } from '@/pages/customers/CustomerEventsPanel'
import { CustomerTaxPanel } from '@/pages/customers/CustomerTaxPanel'
import { CustomerWalletPanel } from '@/pages/customers/CustomerWalletPanel'
import { AppFailure, ConfirmDialog, EmptyState, LoadingRows, Section } from '@fp/ui/compositions'
import { detailGate } from '@/pages/shared/detailGate'

/**
 * Turns whatever is in `?tab=` into a real section, defaulting to Overview.
 *
 * Exported so the route can validate its search param against the same list the
 * page renders — one source of truth for which sections exist. The retired
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
 * Reads the customer, then — because the subscription and invoice endpoints are
 * keyed by the *external* id — scopes those to what the customer record reports.
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
  const navigate = useNavigate()

  if (!customer.data) {
    return detailGate(customer, {
      noun: 'this customer',
      listName: 'customers',
      onBack: onNavigateToList,
    })
  }

  return (
    <>
      <CustomerDetail
        customer={customer.data}
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
            to: '/customers/$customerId/subscriptions/new',
            params: { customerId: customer.data.id },
          })
        }
        onEdit={() => onEdit(customer.data.id)}
        onArchive={() => setArchiving(true)}
        onOpenInvoice={(invoiceId) =>
          void navigate({ to: '/invoices/$invoiceId', params: { invoiceId } })
        }
        onViewAllPayments={() => void navigate({ to: '/payments', search: {} as never })}
        onOpenPlan={(planId) =>
          void navigate({ to: '/plans/$planId', params: { planId }, search: {} as never })
        }
        onOpenContract={(subscriptionId) =>
          void navigate({
            to: '/subscriptions/$subscriptionId',
            params: { subscriptionId },
            search: {} as never,
          })
        }
        onUpdateField={(patch) =>
          update.mutateAsync({
            id: customer.data.id,
            draft: { externalId: customer.data.externalId, name: customer.data.name, ...patch },
          })
        }
        onUpdateMetadata={(metadata) =>
          update.mutateAsync({
            id: customer.data.id,
            draft: { externalId: customer.data.externalId, name: customer.data.name, metadata },
          })
        }
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
        wallet={<CustomerWalletPanel customerId={customer.data.id} />}
        taxes={<CustomerTaxPanel customerId={customer.data.id} />}
        usage={
          <div className="flex flex-col gap-8">
            <Section title="Analytics">
              <EmptyState
                scene="customers"
                size="inline"
                title="Revenue and cost by feature are not available yet"
                description="Flexprice does not report revenue or cost per feature for a customer, so none is shown. Allowances and consumption are below."
              />
            </Section>
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
    </>
  )
}

/**
 * A customer's entitlement quotas, one `QuotaCard` per entitled feature.
 *
 * Reads `GET /customers/usage`, the only endpoint that answers "how much of
 * this allowance has been used" per feature. Four of the six readings the
 * design asks for come straight off it — used quantity, included quantity,
 * percent used and the reset date — and `remaining` is the difference of two
 * counts the same response carried.
 *
 * The sixth, **overage, has no source**, and this is deliberate rather than
 * unfinished. `FeatureUsageSummary` carries `is_soft_limit` (whether going over
 * is billed or blocked) but no overage figure; the only overage in the API is
 * the monetary commitment overage on `GET /subscriptions/usage`, which is keyed
 * by meter and line item, not by entitlement, and is a different concept. A
 * priced one cannot be computed here either — `money.ts` forbids client-side
 * money arithmetic. So the card's cost slot stays a dash with the reason
 * printed beside it.
 *
 * Units are absent for the same kind of reason: the wire sends `unit_plural`
 * but `TenantFeatureUsage` does not keep it, so the readings are bare counts
 * rather than invented nouns.
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
  if (features.length === 0 && isLoading) {
    return (
      <Section title="Usage">
        <LoadingRows />
      </Section>
    )
  }

  if (features.length === 0 && failed) {
    return (
      <Section title="Usage">
        <AppFailure
          title="Usage could not be loaded"
          detail="The rest of this customer's record still works."
          onRetry={onRetry}
        />
      </Section>
    )
  }

  if (features.length === 0) {
    return (
      <Section title="Usage">
        <EmptyState
          scene="customers"
          size="inline"
          title="No entitlements yet"
          description="Quotas appear here once this customer is on a plan that grants a feature."
        />
      </Section>
    )
  }

  return (
    <Section title="Usage">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => (
          <QuotaCard
            key={feature.featureId}
            feature={feature.featureName || feature.featureId}
            label={`${feature.featureName || 'Feature'} used this period`}
            used={toCount(feature.currentUsage)}
            included={feature.isUnlimited ? null : feature.limit}
            {...(feature.isUnlimited ? {} : { percentUsed: toCount(feature.usagePercent) })}
            resetsOn={feature.nextUsageResetAt}
          />
        ))}
      </div>
      {/*
        Said once for the grid rather than once per card. Every card labels its
        own empty Overage slot, so this explains the dashes without repeating
        itself five times down the page.
      */}
      <p role="status" className="text-muted-foreground mt-3 text-xs">
        Overage is shown as — for every feature: Flexprice reports whether a limit is soft or hard,
        but does not report an overage quantity or price it per feature.
      </p>
    </Section>
  )
}

/**
 * A decimal string the API sent, as a number for display.
 *
 * These are counts — events, seats, calls — not money, so reading them as
 * numbers is display formatting rather than the arithmetic `money.ts` forbids.
 * `undefined` for anything unparseable, which renders as a dash rather than a
 * zero: "the API sent something we could not read" is not "nothing was used".
 */
function toCount(value: string): number | undefined {
  if (value === '') return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

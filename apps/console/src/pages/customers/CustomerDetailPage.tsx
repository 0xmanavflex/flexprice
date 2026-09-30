import type { TenantFeatureUsage } from '@fp/domain'
import {
  ApiError,
  useCustomer,
  useCustomerInvoices,
  useCustomerSubscriptions,
  useCustomerUsageSummary,
} from '@fp/query'
import { CUSTOMER_TABS, CustomerDetail, QuotaCard, type CustomerTab } from '@fp/ui/pages'
import { AppFailure, EmptyState, LoadingRows, PageBody, Section } from '@fp/ui/compositions'

/**
 * Turns whatever is in `?tab=` into a real section, defaulting to Overview.
 *
 * Exported so the route can validate its search param against the same list the
 * page renders — one source of truth for which sections exist.
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
  onCreateSubscription: () => void
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
  onCreateSubscription,
}: CustomerDetailPageProps) {
  const customer = useCustomer(customerId)
  const externalId = customer.data?.externalId ?? ''
  const subscriptions = useCustomerSubscriptions(externalId)
  const invoices = useCustomerInvoices(externalId)
  // Keyed on the *internal* id: `GET /customers/usage` takes that, unlike the
  // subscription and invoice reads above, which are scoped by the external one.
  const usage = useCustomerUsageSummary(customerId)

  if (customer.isPending) {
    return (
      <div className="p-6">
        <LoadingRows />
      </div>
    )
  }

  if (customer.error) {
    return (
      <PageBody>
        <AppFailure
          title={failureTitle(customer.error)}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={() => void customer.refetch()}
        />
      </PageBody>
    )
  }

  if (!customer.data) {
    return (
      <PageBody>
        <AppFailure
          title="This customer no longer exists"
          detail="It may have been deleted. Everything else in billing still works."
          onRetry={onNavigateToList}
        />
      </PageBody>
    )
  }

  return (
    <CustomerDetail
      customer={customer.data}
      subscriptions={subscriptions.data ?? []}
      invoices={invoices.data?.invoices ?? []}
      tab={tab}
      onTabChange={onTabChange}
      onBack={onNavigateToList}
      onCreateSubscription={onCreateSubscription}
      subscriptionsLoading={subscriptions.isLoading}
      invoicesLoading={invoices.isLoading}
      usage={
        <UsageSection
          features={usage.data?.features ?? []}
          isLoading={usage.isLoading}
          failed={usage.error !== null}
          onRetry={() => void usage.refetch()}
        />
      }
    />
  )
}

/** An API error, as a sentence a person can act on. */
function failureTitle(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return 'You do not have access to this customer'
      case 'unauthorized':
        return 'Your session has expired. Sign in again.'
      case 'network':
        return 'Could not reach Flexprice'
      default:
        return 'This customer could not be loaded'
    }
  }
  return 'This customer could not be loaded'
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
  if (isLoading) {
    return (
      <Section title="Usage" description="What this customer has used of each entitlement.">
        <LoadingRows />
      </Section>
    )
  }

  if (failed) {
    return (
      <Section title="Usage" description="What this customer has used of each entitlement.">
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
      <Section title="Usage" description="What this customer has used of each entitlement.">
        <EmptyState
          size="inline"
          title="No entitlements yet"
          description="Quotas appear here once this customer is on a plan that grants a feature."
        />
      </Section>
    )
  }

  return (
    <Section
      title="Usage"
      description="What this customer has used of each entitlement, this billing period."
    >
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
        Overage is shown as — for every feature: Flexprice reports whether a limit is soft or
        hard, but does not report an overage quantity or price it per feature.
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

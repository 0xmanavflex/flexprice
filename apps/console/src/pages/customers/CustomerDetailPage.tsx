import { ApiError, useCustomer, useCustomerInvoices, useCustomerSubscriptions } from '@fp/query'
import { CUSTOMER_TABS, CustomerDetail, type CustomerTab } from '@fp/ui/flexprice'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'

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

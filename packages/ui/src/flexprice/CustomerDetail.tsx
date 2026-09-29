import { PlusIcon } from 'lucide-react'
import {
  type CustomerDetail as CustomerDetailModel,
  CUSTOMER_TAX_TREATMENT_LABEL,
  type Invoice,
  type Subscription,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/primitives/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/primitives/table'
import { DetailShell } from '@ui/compositions/DetailShell'
import { ResourceNavigation } from '@ui/compositions/ResourceNavigation'
import type { ResourceNavItem } from '@ui/compositions/ResourceNavigation'
import { Section } from '@ui/compositions/Section'
import { DetailList } from '@ui/compositions/DetailList'
import type { DetailItem } from '@ui/compositions/DetailList'
import { EmptyState } from '@ui/compositions/EmptyState'
import { LoadingRows } from '@ui/compositions/States'
import { Money } from './Money'
import { CatalogStatusBadge } from './StatusBadge'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'
import { InvoiceStatusBadge } from './StatusBadge'
import { provenance } from '@ui/provenance'

/**
 * A customer's detail page.
 *
 * The reference for the V2 detail pattern: `DetailShell` for the header,
 * `ResourceNavigation` for the section strip, `Section` for each region. It is
 * presentational — the page fetches the customer, its subscriptions and its
 * invoices and hands them here, so what each section shows is testable without a
 * network.
 *
 * It shows only what the API actually has. A customer record carries no plan,
 * currency or payment method — those live on its subscriptions and wallets — so
 * the header does not invent them, and the sections with no read model yet
 * (wallet balances, per-feature usage) say so plainly rather than drawing an
 * empty chart.
 */
export const CustomerDetailProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/detail-shell',
    'ui/resource-navigation',
    'ui/section',
    'ui/detail-list',
    'flexprice/Money',
  ],
  note: 'Reference detail page: DetailShell + ResourceNavigation + Section, wired to the real customer/subscriptions/invoices.',
})

export type CustomerTab =
  | 'overview'
  | 'subscriptions'
  | 'invoices'
  | 'wallet'
  | 'usage'
  | 'information'

export const CUSTOMER_TABS = [
  'overview',
  'subscriptions',
  'invoices',
  'wallet',
  'usage',
  'information',
] as const satisfies readonly CustomerTab[]

export interface CustomerDetailProps {
  customer: CustomerDetailModel
  subscriptions: Subscription[]
  invoices: Invoice[]
  tab: CustomerTab
  onTabChange: (tab: CustomerTab) => void
  /** Back to the customer list. */
  onBack: () => void
  /** The header's primary action. */
  onCreateSubscription: () => void
  subscriptionsLoading?: boolean
  invoicesLoading?: boolean
  locale?: string
}

function useDateFormat(locale?: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return (date: Date | null) => (date ? formatter.format(date) : '—')
}

export function CustomerDetail({
  customer,
  subscriptions,
  invoices,
  tab,
  onTabChange,
  onBack,
  onCreateSubscription,
  subscriptionsLoading = false,
  invoicesLoading = false,
  locale,
}: CustomerDetailProps) {
  const formatDate = useDateFormat(locale)

  const items: ResourceNavItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'subscriptions', label: 'Subscriptions', count: subscriptions.length },
    { id: 'invoices', label: 'Invoices', count: invoices.length },
    { id: 'wallet', label: 'Wallet' },
    { id: 'usage', label: 'Usage' },
    { id: 'information', label: 'Information' },
  ]

  // The subtitle answers "who is this": how to reach them, since when, and where.
  const since = customer.createdAt ? `Customer since ${formatDate(customer.createdAt)}` : null
  const subtitle = [customer.email || null, since, customer.addressCountry || null]
    .filter(Boolean)
    .join(' · ')

  // The plan the customer is on, drawn from their subscription — the header's own
  // "which plan", the way the mockup carries it beside the name.
  const primaryPlan = subscriptions[0]?.planName
  const planBadge = primaryPlan && primaryPlan !== '—' ? primaryPlan : null

  return (
    <DetailShell
      // A real trail, not a back button: names the list and the customer, and the
      // list is one click away. The customer's id is already in the URL.
      trail={[{ label: 'Customers', onClick: onBack }, { label: customer.name }]}
      title={customer.name}
      badges={
        <>
          {customer.externalId ? (
            <span className="rounded-md border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {customer.externalId}
            </span>
          ) : null}
          {planBadge ? <Badge variant="secondary">{planBadge}</Badge> : null}
          <CatalogStatusBadge status={customer.status} />
        </>
      }
      {...(subtitle ? { description: subtitle } : {})}
      actions={
        <Button onClick={onCreateSubscription}>
          <PlusIcon aria-hidden />
          Create subscription
        </Button>
      }
    >
      <ResourceNavigation items={items} value={tab} onChange={(id) => onTabChange(id as CustomerTab)} label="Customer sections" />

      {tab === 'overview' ? (
        <OverviewTab
          customer={customer}
          subscriptions={subscriptions}
          invoices={invoices}
          invoicesLoading={invoicesLoading}
          onViewInvoices={() => onTabChange('invoices')}
          onCreateSubscription={onCreateSubscription}
          formatDate={formatDate}
        />
      ) : null}

      {tab === 'subscriptions' ? (
        <SubscriptionsTab
          subscriptions={subscriptions}
          isLoading={subscriptionsLoading}
          onCreateSubscription={onCreateSubscription}
          formatDate={formatDate}
        />
      ) : null}

      {tab === 'invoices' ? (
        <InvoicesTab invoices={invoices} isLoading={invoicesLoading} formatDate={formatDate} />
      ) : null}

      {tab === 'wallet' ? (
        <EmptyState
          title="No wallet connected"
          description="A customer's credit balance, top-ups and transactions will appear here once a wallet is set up."
        />
      ) : null}

      {tab === 'usage' ? (
        <EmptyState
          title="No usage to show yet"
          description="Metered events for this customer appear here as they are ingested, so a charge can be traced to what caused it."
        />
      ) : null}

      {tab === 'information' ? (
        <InformationTab customer={customer} formatDate={formatDate} />
      ) : null}
    </DetailShell>
  )
}

function SubscriptionSummary({
  subscription,
  formatDate,
}: {
  subscription: Subscription
  formatDate: (date: Date | null) => string
}) {
  const renews = subscription.currentPeriodEnd
    ? `renews ${formatDate(subscription.currentPeriodEnd)}`
    : null
  const line = [subscription.planName, subscription.billingPeriodLabel, renews]
    .filter((part) => part && part !== '—')
    .join(' · ')

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{subscription.planName}</span>
        <span className="truncate text-xs text-muted-foreground">{line}</span>
      </div>
      <SubscriptionStatusBadge status={subscription.status} />
    </div>
  )
}

function OverviewTab({
  customer,
  subscriptions,
  invoices,
  invoicesLoading,
  onViewInvoices,
  onCreateSubscription,
  formatDate,
}: {
  customer: CustomerDetailModel
  subscriptions: Subscription[]
  invoices: Invoice[]
  invoicesLoading: boolean
  onViewInvoices: () => void
  onCreateSubscription: () => void
  formatDate: (date: Date | null) => string
}) {
  const recent = invoices.slice(0, 5)
  const primary = subscriptions[0]

  const details: DetailItem[] = [
    { label: 'Customer ID', value: <span className="font-mono text-xs">{customer.id}</span> },
    ...(customer.externalId
      ? [
          {
            label: 'External ID',
            value: <span className="font-mono text-xs">{customer.externalId}</span>,
          },
        ]
      : []),
    { label: 'Billing email', value: customer.email || '—' },
    { label: 'Country', value: customer.addressCountry || '—' },
    { label: 'Timezone', value: customer.timezone || '—' },
    {
      label: 'Tax',
      value: customer.taxTreatment ? CUSTOMER_TAX_TREATMENT_LABEL[customer.taxTreatment] : '—',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-5 lg:col-span-2">
        <Section title="Subscription" description="The plan this customer is billed on.">
          {primary ? (
            <SubscriptionSummary subscription={primary} formatDate={formatDate} />
          ) : (
            <EmptyState
              size="inline"
              title="No active subscription"
              description="Subscribe this customer to a plan to start billing."
              action={<Button onClick={onCreateSubscription}>Create subscription</Button>}
            />
          )}
        </Section>

        <Section
          title="Recent invoices"
          description="History and current collection state."
          actions={
            recent.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={onViewInvoices}>
                View all
              </Button>
            ) : null
          }
        >
          {invoicesLoading ? (
            <LoadingRows />
          ) : recent.length > 0 ? (
            <InvoiceTable invoices={recent} formatDate={formatDate} />
          ) : (
            <EmptyState
              size="inline"
              title="No invoices yet"
              description="Invoices are created automatically from subscriptions, or raised by hand."
            />
          )}
        </Section>
      </div>

      <Section title="Details" description="How this customer is set up." className="lg:col-span-1">
        <DetailList items={details} columns={1} />
      </Section>
    </div>
  )
}

function SubscriptionsTab({
  subscriptions,
  isLoading,
  onCreateSubscription,
  formatDate,
}: {
  subscriptions: Subscription[]
  isLoading: boolean
  onCreateSubscription: () => void
  formatDate: (date: Date | null) => string
}) {
  return (
    <Section title="Subscriptions" description="Every plan this customer is on.">
      {isLoading ? (
        <LoadingRows />
      ) : subscriptions.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Renews</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((subscription) => (
              <TableRow key={subscription.id}>
                <TableCell className="font-medium">{subscription.planName}</TableCell>
                <TableCell>
                  <SubscriptionStatusBadge status={subscription.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {subscription.billingPeriodLabel}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(subscription.currentPeriodEnd)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(subscription.startDate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          size="inline"
          title="No subscriptions yet"
          description="Subscribe this customer to a plan to start billing."
          action={<Button onClick={onCreateSubscription}>Create subscription</Button>}
        />
      )}
    </Section>
  )
}

function InvoicesTab({
  invoices,
  isLoading,
  formatDate,
}: {
  invoices: Invoice[]
  isLoading: boolean
  formatDate: (date: Date | null) => string
}) {
  return (
    <Section title="Invoices" description="Every invoice raised for this customer.">
      {isLoading ? (
        <LoadingRows />
      ) : invoices.length > 0 ? (
        <InvoiceTable invoices={invoices} formatDate={formatDate} />
      ) : (
        <EmptyState
          size="inline"
          title="No invoices yet"
          description="Invoices are created automatically from subscriptions, or raised by hand."
        />
      )}
    </Section>
  )
}

function InvoiceTable({
  invoices,
  formatDate,
}: {
  invoices: Invoice[]
  formatDate: (date: Date | null) => string
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => {
          const period =
            invoice.periodStart && invoice.periodEnd
              ? `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
              : '—'
          return (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">{invoice.number}</TableCell>
              <TableCell className="text-muted-foreground">{period}</TableCell>
              <TableCell>
                <InvoiceStatusBadge status={invoice.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(invoice.dueDate)}</TableCell>
              <TableCell className="text-right">
                <Money value={invoice.total} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function InformationTab({
  customer,
  formatDate,
}: {
  customer: CustomerDetailModel
  formatDate: (date: Date | null) => string
}) {
  const address = [
    customer.addressLine1,
    customer.addressLine2,
    [customer.addressCity, customer.addressState, customer.addressPostalCode]
      .filter(Boolean)
      .join(', '),
    customer.addressCountry,
  ]
    .filter(Boolean)
    .join('\n')

  const items: DetailItem[] = [
    { label: 'Name', value: customer.name },
    { label: 'External ID', value: <span className="font-mono text-xs">{customer.externalId || '—'}</span> },
    { label: 'Email', value: customer.email || '—' },
    { label: 'Phone', value: customer.phone || '—' },
    { label: 'Timezone', value: customer.timezone || '—' },
    {
      label: 'Tax treatment',
      value: customer.taxTreatment ? CUSTOMER_TAX_TREATMENT_LABEL[customer.taxTreatment] : '—',
    },
    { label: 'Created', value: formatDate(customer.createdAt) },
    { label: 'Updated', value: formatDate(customer.updatedAt) },
    {
      label: 'Address',
      value: address ? <span className="whitespace-pre-line">{address}</span> : '—',
      full: true,
    },
  ]

  const metadata = Object.entries(customer.metadata)

  return (
    <div className="flex flex-col gap-5">
      <Section title="Information" description="The full customer record.">
        <DetailList items={items} columns={2} />
      </Section>

      {metadata.length > 0 ? (
        <Section title="Metadata" description="Keys your own system attached to this customer.">
          <DetailList
            items={metadata.map(([key, value]) => ({
              label: key,
              value: <span className="font-mono text-xs">{value}</span>,
            }))}
            columns={2}
          />
        </Section>
      ) : null}
    </div>
  )
}

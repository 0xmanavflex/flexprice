import { type ReactNode } from 'react'
import { MoreHorizontalIcon, PlusIcon } from 'lucide-react'
import {
  type CustomerDetail as CustomerDetailModel,
  CUSTOMER_TAX_TREATMENT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  type Invoice,
  type Subscription,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { ScrollArea } from '@ui/components/primitives/scroll-area'
import { AccountActivityRail } from '@ui/components/blocks/solution-billing-4/components/account-activity-rail'
import { MENU_CONTENT, MENU_ITEM } from '@ui/compositions/shell/menuSurface'
import { DetailTabs, SimpleTable } from '@ui/compositions/DetailKit'
import { Section } from '@ui/compositions/Section'
import { ContextualSection } from '@ui/compositions/ContextualSection'
import { EditableCard } from '@ui/compositions/EditableCard'
import { EmptyState } from '@ui/compositions/EmptyState'
import { LoadingRows } from '@ui/compositions/States'
import { Money } from '../shared/Money'
import { CatalogStatusBadge, InvoiceStatusBadge } from '../shared/StatusBadge'
import { EntityHeader } from '../shared/EntityHeader'
import { provenance } from '@ui/provenance'
import { CustomerEventsGrid, DEMO_CUSTOMER_EVENTS } from './CustomerEventsGrid'
import { EntityLink } from '../shared/cells'
import { CustomerSubscriptionCards } from './CustomerSubscriptionCards'

/**
 * A customer's detail page: an avatar-tile `EntityHeader` (name, status badge,
 * id chip, ⋯ menu) over `DetailTabs`, each tab built from ReUI blocks and shared
 * compositions. It is presentational: the page fetches and hands data in.
 *
 * It shows only what the API has. A customer record carries no plan, currency or
 * payment method, so the header does not invent them; sections with no read model
 * yet (wallet, per-feature analytics, events) render demo data until wired.
 */
export const CustomerDetailProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/shared/EntityHeader',
    'ui/detail-kit',
    'ui/section',
    'ui/editable-card',
    'blocks/solution-billing-4',
    'pages/shared/Money',
  ],
  note: 'Customer detail: EntityHeader + DetailTabs; Overview from solution-billing-4, Information as single-pencil EditableCards.',
})

export type CustomerTab =
  'overview' | 'subscriptions' | 'invoices' | 'wallet' | 'usage' | 'events' | 'information'

export const CUSTOMER_TABS = [
  'overview',
  'subscriptions',
  'invoices',
  'wallet',
  'usage',
  'events',
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
  /** Open the stepped Edit page: address and billing configuration. */
  onEdit?: () => void
  /**
   * Save one of the simple fields in place (name, email, phone). Omitted, the
   * Information tab is read-only. Resolve to commit; reject with an Error to
   * show its message beside the field.
   */
  onUpdateField?: (patch: { name?: string; email?: string; phone?: string }) => Promise<unknown>
  /** Open an invoice from a row action. */
  onOpenInvoice?: (invoiceId: string) => void
  onOpenPlan?: (planId: string) => void
  /**
   * The stepped create-subscription form. While present, the Subscriptions
   * section shows it in place of the table; the customer, its header and the
   * open tab stay put.
   */
  subscriptionForm?: ReactNode
  /** The way back out of `subscriptionForm`. */
  onCancelSubscriptionCreate?: () => void
  subscriptionsLoading?: boolean
  invoicesLoading?: boolean
  /**
   * The Usage section's contents — the per-feature quota cards.
   *
   * A slot rather than a data prop because the quota read is a separate
   * endpoint (`GET /customers/usage`) with its own loading and failure states,
   * and this component does not fetch. Omitted, the section keeps the empty
   * state it has always had, so nothing about it changes for a caller that has
   * no quota data to hand.
   */
  usage?: ReactNode
  /** The Wallet section's contents; omitted, the empty state shows. */
  wallet?: ReactNode
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
  onEdit,
  onUpdateField,
  onOpenInvoice,
  onOpenPlan,
  subscriptionForm,
  onCancelSubscriptionCreate,
  subscriptionsLoading = false,
  invoicesLoading = false,
  usage,
  wallet,
  locale,
}: CustomerDetailProps) {
  const formatDate = useDateFormat(locale)
  const since = customer.createdAt ? `Customer since ${formatDate(customer.createdAt)}` : null
  const subtitle = [customer.email || null, since].filter(Boolean).join(' · ')
  const initials =
    customer.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EntityHeader
        trail={[{ label: 'Customers', onClick: onBack }, { label: customer.name }]}
        icon={<span className="text-xs font-medium">{initials}</span>}
        title={customer.name}
        badge={<CatalogStatusBadge status={customer.status} />}
        {...(subtitle ? { subtitle } : {})}
        id={customer.externalId || customer.id}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" aria-label="Customer actions" />}
            >
              <MoreHorizontalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className={MENU_CONTENT}>
              <DropdownMenuGroup>
                {onEdit ? (
                  <DropdownMenuItem className={MENU_ITEM} onClick={onEdit}>
                    {onUpdateField ? 'Edit billing details' : 'Edit customer'}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem className={MENU_ITEM} onClick={onCreateSubscription}>
                  Create subscription
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="px-6 pb-10">
        <DetailTabs
          value={tab}
          onValueChange={(next) => onTabChange(next as CustomerTab)}
          tabs={[
            {
              value: 'overview',
              label: 'Overview',
              content: (
                <OverviewTab
                  subscriptions={subscriptions}
                  invoices={invoices}
                  invoicesLoading={invoicesLoading}
                  onViewInvoices={() => onTabChange('invoices')}
                  onViewSubscriptions={() => onTabChange('subscriptions')}
                  onCreateSubscription={onCreateSubscription}
                  formatDate={formatDate}
                  onOpenInvoice={onOpenInvoice}
                  onOpenPlan={onOpenPlan}
                />
              ),
            },
            {
              value: 'subscriptions',
              label: 'Subscriptions',
              count: subscriptions.length,
              content: (
                <SubscriptionsTab
                  subscriptions={subscriptions}
                  isLoading={subscriptionsLoading}
                  onCreateSubscription={onCreateSubscription}
                  form={subscriptionForm}
                  onCancelCreate={onCancelSubscriptionCreate}
                  formatDate={formatDate}
                  onOpenPlan={onOpenPlan}
                />
              ),
            },
            {
              value: 'invoices',
              label: 'Invoices',
              count: invoices.length,
              content: (
                <Section
                  title="Invoices"
                  description="Every invoice raised for this customer"
                  actions={
                    <Button variant="outline" size="sm">
                      <PlusIcon aria-hidden /> New invoice
                    </Button>
                  }
                >
                  <InvoicesGrid
                    invoices={invoices}
                    isLoading={invoicesLoading}
                    formatDate={formatDate}
                    onOpenInvoice={onOpenInvoice}
                  />
                </Section>
              ),
            },
            {
              value: 'wallet',
              label: 'Wallet',
              content: wallet ?? (
                <EmptyState
                  title="No wallet connected"
                  description="A customer's credit balance, top-ups and transactions will appear here once a wallet is set up."
                />
              ),
            },
            {
              value: 'usage',
              label: 'Analytics',
              content: usage ?? (
                <EmptyState
                  title="No usage to show yet"
                  description="Metered events for this customer appear here as they are ingested, so a charge can be traced to what caused it."
                />
              ),
            },
            {
              value: 'events',
              label: 'Events',
              content: <CustomerEventsGrid events={DEMO_CUSTOMER_EVENTS} />,
            },
            {
              value: 'information',
              label: 'Information',
              content: (
                <InformationTab
                  customer={customer}
                  formatDate={formatDate}
                  onUpdateField={onUpdateField}
                  onEdit={onEdit}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

/** Demo activity feed for the Overview timeline. */
const DEMO_ACTIVITY = [
  {
    id: 6,
    title: 'Usage threshold reached',
    at: 'Today, 09:14',
    status: 'issue',
    summary: '80% of the monthly API calls allowance used.',
    source: 'api_call',
  },
  {
    id: 5,
    title: 'Invoice finalized',
    at: 'Yesterday',
    status: 'completed',
    summary: 'Invoice sent to the billing contact.',
    source: 'billing',
  },
  {
    id: 4,
    title: 'Payment received',
    at: 'Sep 28',
    status: 'completed',
    summary: 'Card payment settled.',
    source: 'payments',
  },
  {
    id: 3,
    title: 'Wallet top-up',
    at: 'Sep 20',
    status: 'completed',
    summary: 'Credits added to the prepaid wallet.',
    source: 'wallet',
  },
  {
    id: 2,
    title: 'Subscription renewed',
    at: 'Sep 1',
    status: 'completed',
    summary: 'Billing period rolled over.',
    source: 'subscription',
  },
  {
    id: 1,
    title: 'Customer created',
    at: 'Aug 12',
    status: 'completed',
    summary: 'Record created in Flexprice.',
    source: 'customer',
  },
]

function OverviewTab({
  subscriptions,
  invoices,
  invoicesLoading,
  onViewInvoices,
  onViewSubscriptions,
  onCreateSubscription,
  formatDate,
  onOpenInvoice,
  onOpenPlan,
}: {
  subscriptions: Subscription[]
  invoices: Invoice[]
  invoicesLoading: boolean
  onViewInvoices: () => void
  onViewSubscriptions: () => void
  onCreateSubscription: () => void
  formatDate: (date: Date | null) => string
  onOpenInvoice: ((invoiceId: string) => void) | undefined
  onOpenPlan: ((planId: string) => void) | undefined
}) {
  const recent = invoices.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Section
            title="Subscriptions"
            description="The plans this customer is billed on"
            actions={
              <Button variant="outline" size="sm" onClick={onCreateSubscription}>
                <PlusIcon aria-hidden /> Create subscription
              </Button>
            }
          >
            {subscriptions.length > 0 ? (
              <CustomerSubscriptionCards
                subscriptions={subscriptions}
                formatDate={formatDate}
                onViewAll={onViewSubscriptions}
                onOpenPlan={onOpenPlan}
              />
            ) : (
              <EmptyState
                size="inline"
                title="No active subscription"
                description="Subscribe this customer to a plan to start billing."
              />
            )}
          </Section>

          <Section
            title="Recent invoices"
            description="History and current collection state"
            actions={
              recent.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={onViewInvoices}>
                  View all
                </Button>
              ) : null
            }
          >
            <InvoicesGrid
              invoices={recent}
              isLoading={invoicesLoading}
              formatDate={formatDate}
              onOpenInvoice={onOpenInvoice}
            />
          </Section>
        </div>

        <Section title="Recent activity" description="Demo data">
          <ScrollArea className="h-[560px]">
            <div className="pr-3">
              <AccountActivityRail
                events={DEMO_ACTIVITY.map((e) => ({ ...e, labels: [] })) as never}
              />
            </div>
          </ScrollArea>
        </Section>
      </div>
    </div>
  )
}

function SubscriptionsTab({
  subscriptions,
  isLoading,
  onCreateSubscription,
  form,
  onCancelCreate,
  formatDate,
  onOpenPlan,
}: {
  subscriptions: Subscription[]
  isLoading: boolean
  onCreateSubscription: () => void
  form: ReactNode | undefined
  onCancelCreate: (() => void) | undefined
  formatDate: (date: Date | null) => string
  onOpenPlan: ((planId: string) => void) | undefined
}) {
  return (
    <ContextualSection
      title="Subscriptions"
      description="Every subscription this customer has had"
      actions={
        <Button variant="outline" size="sm" onClick={onCreateSubscription}>
          <PlusIcon aria-hidden /> Create subscription
        </Button>
      }
      formTitle="Create subscription"
      formDescription="Set up a plan for this customer. Nothing is created until the last step."
      backLabel="Subscriptions"
      {...(form ? { form } : {})}
      {...(onCancelCreate ? { onBack: onCancelCreate } : {})}
    >
      {isLoading ? (
        <LoadingRows />
      ) : (
        <SimpleTable
          rows={subscriptions}
          getRowId={(s) => s.id}
          columns={[
            {
              key: 'plan',
              header: 'Plan',
              cell: (s) =>
                onOpenPlan ? (
                  <EntityLink label={s.planName} onOpen={() => onOpenPlan(s.planId)} />
                ) : (
                  <span className="font-medium">{s.planName}</span>
                ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (s) => (
                <Badge variant="outline" className="font-normal">
                  {SUBSCRIPTION_STATUS_LABEL[s.status]}
                </Badge>
              ),
            },
            { key: 'billing', header: 'Billing', cell: (s) => s.billingPeriodLabel },
            {
              key: 'period',
              header: 'Current period',
              cell: (s) => (
                <span className="text-muted-foreground">
                  {s.currentPeriodStart && s.currentPeriodEnd
                    ? `${formatDate(s.currentPeriodStart)} – ${formatDate(s.currentPeriodEnd)}`
                    : '—'}
                </span>
              ),
            },
            {
              key: 'fixed',
              header: 'Fixed amount',
              cell: () => <span className="text-muted-foreground">—</span>,
            },
            {
              key: 'id',
              header: 'ID',
              cell: (s) => <span className="text-muted-foreground font-mono text-xs">{s.id}</span>,
            },
          ]}
          empty={
            <EmptyState
              size="inline"
              title="No subscriptions yet"
              description="Subscribe this customer to a plan to start billing."
              action={<Button onClick={onCreateSubscription}>Create subscription</Button>}
            />
          }
        />
      )}
    </ContextualSection>
  )
}

function InvoicesGrid({
  invoices,
  isLoading,
  formatDate,
  onOpenInvoice,
}: {
  invoices: Invoice[]
  isLoading: boolean
  formatDate: (date: Date | null) => string
  onOpenInvoice: ((invoiceId: string) => void) | undefined
}) {
  if (isLoading) return <LoadingRows />
  return (
    <SimpleTable
      rows={invoices}
      getRowId={(invoice) => invoice.id}
      {...(onOpenInvoice ? { onRowClick: (invoice: Invoice) => onOpenInvoice(invoice.id) } : {})}
      columns={[
        {
          key: 'number',
          header: 'Invoice',
          cell: (i) => <span className="font-medium">{i.number}</span>,
        },
        {
          key: 'period',
          header: 'Period',
          cell: (i) => (
            <span className="text-muted-foreground">
              {i.periodStart && i.periodEnd
                ? `${formatDate(i.periodStart)} – ${formatDate(i.periodEnd)}`
                : '—'}
            </span>
          ),
        },
        { key: 'status', header: 'Payment', cell: (i) => <InvoiceStatusBadge status={i.status} /> },
        {
          key: 'due',
          header: 'Due',
          cell: (i) => <span className="text-muted-foreground">{formatDate(i.dueDate)}</span>,
        },
        {
          key: 'total',
          header: 'Total',
          className: 'text-right',
          cell: (i) => <Money value={i.total} />,
        },
      ]}
      empty={
        <EmptyState
          size="inline"
          title="No invoices yet"
          description="Invoices are created automatically from subscriptions, or raised by hand."
        />
      }
    />
  )
}

/** The update patches, so a blank is omitted and cannot clear a stored value. */
const CLEAR_UNSUPPORTED = 'Clearing this value is not supported; enter a new one.'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function InformationTab({
  customer,
  formatDate,
  onUpdateField,
  onEdit,
}: {
  customer: CustomerDetailModel
  formatDate: (date: Date | null) => string
  onUpdateField: CustomerDetailProps['onUpdateField']
  onEdit: (() => void) | undefined
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

  const metadata = Object.entries(customer.metadata)

  return (
    <div className="flex flex-col gap-5">
      <EditableCard
        title="Customer"
        description="Who this customer is and how to reach them"
        locked={!onUpdateField}
        fields={[
          { key: 'name', label: 'Name', value: customer.name, required: true },
          {
            key: 'email',
            label: 'Email',
            value: customer.email,
            placeholder: 'No email',
            validate: (next) =>
              next === ''
                ? customer.email
                  ? CLEAR_UNSUPPORTED
                  : null
                : EMAIL_PATTERN.test(next)
                  ? null
                  : 'Enter a valid email address.',
          },
          {
            key: 'phone',
            label: 'Phone',
            value: customer.phone,
            placeholder: 'No phone',
            validate: (next) => (next === '' && customer.phone ? CLEAR_UNSUPPORTED : null),
          },
          { key: 'externalId', label: 'External ID', value: customer.externalId, readOnly: true },
        ]}
        onSave={(changes) => onUpdateField?.(changes)}
      />

      <EditableCard
        title="Billing"
        description="Tax, timezone and address. Edited on its own page."
        locked
        fields={[
          { key: 'timezone', label: 'Timezone', value: customer.timezone || '', readOnly: true },
          {
            key: 'tax',
            label: 'Tax treatment',
            value: customer.taxTreatment ? CUSTOMER_TAX_TREATMENT_LABEL[customer.taxTreatment] : '',
            readOnly: true,
          },
          {
            key: 'created',
            label: 'Created',
            value: formatDate(customer.createdAt),
            readOnly: true,
          },
          {
            key: 'updated',
            label: 'Updated',
            value: formatDate(customer.updatedAt),
            readOnly: true,
          },
          { key: 'address', label: 'Address', value: address, multiline: true, readOnly: true },
        ]}
        onSave={() => undefined}
      >
        {onEdit ? (
          <Button variant="outline" size="sm" className="self-start" onClick={onEdit}>
            Edit billing details
          </Button>
        ) : null}
      </EditableCard>

      {metadata.length > 0 ? (
        <Section title="Metadata" description="Keys your own system attached to this customer">
          <SimpleTable
            rows={metadata}
            getRowId={([key]) => key}
            columns={[
              {
                key: 'key',
                header: 'Key',
                cell: ([key]) => <span className="font-mono text-xs">{key}</span>,
              },
              {
                key: 'value',
                header: 'Value',
                cell: ([, value]) => <span className="font-mono text-xs">{value}</span>,
              },
            ]}
          />
        </Section>
      ) : null}
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import { MoreHorizontalIcon } from 'lucide-react'
import {
  type CustomerDetail as CustomerDetailModel,
  CUSTOMER_TAX_TREATMENT_LABEL,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/components/primitives/table'
import { DetailShell } from '@ui/compositions/DetailShell'
import { DetailTabs, SimpleTable } from '@ui/compositions/DetailKit'
import { Section } from '@ui/compositions/Section'
import { ContextualSection } from '@ui/compositions/ContextualSection'
import { EditableFields } from '@ui/compositions/EditableFields'
import { DetailList } from '@ui/compositions/DetailList'
import type { DetailItem } from '@ui/compositions/DetailList'
import { EmptyState } from '@ui/compositions/EmptyState'
import { LoadingRows } from '@ui/compositions/States'
import { Money } from '../shared/Money'
import { CatalogStatusBadge } from '../shared/StatusBadge'
import { InvoiceStatusBadge } from '../shared/StatusBadge'
import { provenance } from '@ui/provenance'
import { CustomerSubscriptionCards } from './CustomerSubscriptionCards'

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
    'ui/detail-kit',
    'ui/section',
    'ui/detail-list',
    'pages/shared/Money',
  ],
  note: 'Reference detail page: DetailShell + DetailTabs + Section, wired to the real customer/subscriptions/invoices.',
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
  subscriptionForm,
  onCancelSubscriptionCreate,
  subscriptionsLoading = false,
  invoicesLoading = false,
  usage,
  wallet,
  locale,
}: CustomerDetailProps) {
  const formatDate = useDateFormat(locale)
  const [editing, setEditing] = useState(false)

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
            <Badge variant="outline" className="text-muted-foreground font-mono font-normal">
              {customer.externalId}
            </Badge>
          ) : null}
          {planBadge ? <Badge variant="secondary">{planBadge}</Badge> : null}
          <CatalogStatusBadge status={customer.status} />
        </>
      }
      {...(subtitle ? { description: subtitle } : {})}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon" aria-label="Customer actions" />}
          >
            <MoreHorizontalIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {onUpdateField ? (
                <DropdownMenuItem
                  disabled={editing}
                  onClick={() => {
                    onTabChange('information')
                    setEditing(true)
                  }}
                >
                  Edit
                </DropdownMenuItem>
              ) : null}
              {onEdit ? (
                <DropdownMenuItem onClick={onEdit}>
                  {onUpdateField ? 'Edit billing details' : 'Edit customer'}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={onCreateSubscription}>Create subscription</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
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
              />
            ),
          },
          {
            value: 'invoices',
            label: 'Invoices',
            count: invoices.length,
            content: (
              <InvoicesTab invoices={invoices} isLoading={invoicesLoading} formatDate={formatDate} />
            ),
          },
          {
            value: 'wallet',
            label: 'Wallet',
            content:
              wallet ?? (
                <EmptyState
                  title="No wallet connected"
                  description="A customer's credit balance, top-ups and transactions will appear here once a wallet is set up."
                />
              ),
          },
          {
            value: 'usage',
            label: 'Analytics',
            content:
              usage ?? (
                <EmptyState
                  title="No usage to show yet"
                  description="Metered events for this customer appear here as they are ingested, so a charge can be traced to what caused it."
                />
              ),
          },
          {
            value: 'events',
            label: 'Events',
            content: <EventsTab events={DEMO_CUSTOMER_EVENTS} />,
          },
          {
            value: 'information',
            label: 'Information',
            content: (
              <InformationTab
                customer={customer}
                formatDate={formatDate}
                onUpdateField={onUpdateField}
                editing={editing}
                onEditingChange={setEditing}
              />
            ),
          },
        ]}
      />
    </DetailShell>
  )
}

/** Demo activity: no customer event feed is wired yet. */
interface CustomerEvent {
  id: number
  title: string
  at: string
  status: 'completed' | 'active' | 'pending' | 'issue'
  summary: string
  source: string
}

export const DEMO_CUSTOMER_EVENTS: CustomerEvent[] = [
  { id: 6, title: 'Usage threshold reached', at: 'Today, 09:14', status: 'issue', summary: '80% of the monthly API calls allowance used.', source: 'api_call' },
  { id: 5, title: 'Invoice finalized', at: 'Yesterday', status: 'completed', summary: 'Invoice sent to the billing contact.', source: 'billing' },
  { id: 4, title: 'Payment received', at: 'Sep 28', status: 'completed', summary: 'Card payment settled.', source: 'payments' },
  { id: 3, title: 'Wallet top-up', at: 'Sep 20', status: 'completed', summary: 'Credits added to the prepaid wallet.', source: 'wallet' },
  { id: 2, title: 'Subscription renewed', at: 'Sep 1', status: 'completed', summary: 'Billing period rolled over.', source: 'subscription' },
  { id: 1, title: 'Customer created', at: 'Aug 12', status: 'completed', summary: 'Record created in Flexprice.', source: 'customer' },
]

function EventsTab({ events }: { events: CustomerEvent[] }) {
  return (
    <SimpleTable
      rows={events}
      getRowId={(event) => String(event.id)}
      columns={[
        { key: 'title', header: 'Event', cell: (e) => <span className="font-medium">{e.title}</span> },
        { key: 'source', header: 'Source', cell: (e) => <span className="font-mono text-xs">{e.source}</span> },
        { key: 'summary', header: 'Details', cell: (e) => <span className="text-muted-foreground">{e.summary}</span> },
        { key: 'at', header: 'When', cell: (e) => <span className="text-muted-foreground">{e.at}</span> },
      ]}
      empty={
        <EmptyState
          size="inline"
          title="No events yet"
          description="Events ingested for this customer appear here as they arrive."
        />
      }
    />
  )
}

function OverviewTab({
  subscriptions,
  invoices,
  invoicesLoading,
  onViewInvoices,
  onViewSubscriptions,
  onCreateSubscription,
  formatDate,
}: {
  subscriptions: Subscription[]
  invoices: Invoice[]
  invoicesLoading: boolean
  onViewInvoices: () => void
  onViewSubscriptions: () => void
  onCreateSubscription: () => void
  formatDate: (date: Date | null) => string
}) {
  const recent = invoices.slice(0, 5)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-6">
        <Section title="Subscriptions" description="The plans this customer is billed on.">
          {subscriptions.length > 0 ? (
            <CustomerSubscriptionCards
              subscriptions={subscriptions}
              formatDate={formatDate}
              onViewAll={onViewSubscriptions}
            />
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

      <Section title="Activity" description="Recent events. Demo data.">
        <ScrollArea className="h-[560px]">
          <div className="pr-3">
            <AccountActivityRail
              events={DEMO_CUSTOMER_EVENTS.map((e) => ({ ...e, labels: [] })) as never}
            />
          </div>
        </ScrollArea>
      </Section>
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
}: {
  subscriptions: Subscription[]
  isLoading: boolean
  onCreateSubscription: () => void
  form: ReactNode | undefined
  onCancelCreate: (() => void) | undefined
  formatDate: (date: Date | null) => string
}) {
  return (
    <ContextualSection
      title="Subscriptions"
      description="Every plan this customer is on."
      formTitle="Create subscription"
      formDescription="Set up a plan for this customer. Nothing is created until the last step."
      backLabel="Subscriptions"
      {...(form ? { form } : {})}
      {...(onCancelCreate ? { onBack: onCancelCreate } : {})}
    >
      {isLoading ? (
        <LoadingRows />
      ) : subscriptions.length > 0 ? (
        <CustomerSubscriptionCards subscriptions={subscriptions} formatDate={formatDate} />
      ) : (
        <EmptyState
          size="inline"
          title="No subscriptions yet"
          description="Subscribe this customer to a plan to start billing."
          action={<Button onClick={onCreateSubscription}>Create subscription</Button>}
        />
      )}
    </ContextualSection>
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

/** The update patches, so a blank is omitted and cannot clear a stored value. */
const CLEAR_UNSUPPORTED = 'Clearing this value is not supported; enter a new one.'

function InformationTab({
  customer,
  formatDate,
  onUpdateField,
  editing,
  onEditingChange,
}: {
  editing: boolean
  onEditingChange: (editing: boolean) => void
  customer: CustomerDetailModel
  formatDate: (date: Date | null) => string
  onUpdateField: CustomerDetailProps['onUpdateField']
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
    ...(onUpdateField
      ? []
      : [
          { label: 'Name', value: customer.name },
          { label: 'Email', value: customer.email || '—' },
          { label: 'Phone', value: customer.phone || '—' },
        ]),
    {
      label: 'External ID',
      value: <span className="font-mono text-xs">{customer.externalId || '—'}</span>,
    },
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
      <Section
        title="Information"
        description={
          onUpdateField
            ? 'The full customer record. Use the pencil, or Edit above, to change name, email or phone in place.'
            : 'The full customer record.'
        }
      >
        {onUpdateField ? (
          <EditableFields
            className="mb-5"
            editing={editing}
            onEditingChange={onEditingChange}
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
                    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)
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
            ]}
            onSave={(changes) => onUpdateField(changes)}
          />
        ) : null}
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

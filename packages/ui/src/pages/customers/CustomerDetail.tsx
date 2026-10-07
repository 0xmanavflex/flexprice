import { type ReactNode } from 'react'
import { SectionEmpty } from '@ui/compositions/SectionEmpty'
import { CopyIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, WalletIcon } from 'lucide-react'
import {
  type CustomerDetail as CustomerDetailModel,
  CUSTOMER_TAX_TREATMENT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  SubscriptionStatus,
  type Invoice,
  InvoiceStatus,
  PaymentStatus,
  compareMoney,
  isZeroMoney,
  type Subscription,
} from '@fp/domain'
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
import type { ActivityEvent } from '@ui/components/blocks/solution-billing-4/components/data'
import { DetailTabs, Properties } from '@ui/compositions/DetailKit'
import { Section } from '@ui/compositions/Section'
import { EditableCard } from '@ui/compositions/EditableCard'
import { EmptyState } from '@ui/compositions/EmptyState'
import { LoadingRows } from '@ui/compositions/States'
import { Money } from '../shared/Money'
import { EntityHeader } from '../shared/EntityHeader'
import { provenance } from '@ui/provenance'
import { CustomerEventsGrid, DEMO_CUSTOMER_EVENTS } from './CustomerEventsGrid'
import { EntityLink, Pill, Status, type PillTone } from '../shared/cells'
import { cn } from '@ui/lib/cn'
import { CustomerSubscriptionCards } from './CustomerSubscriptionCards'
import { DetailTable } from '../shared/DetailTable'

/**
 * A customer's detail page: an avatar-tile `EntityHeader` (name, id chip, ⋯ menu)
 * over line `DetailTabs`; the active tab renders as reference-style sections. It is presentational: the page fetches and hands data in.
 *
 * It shows only what the API has. A customer record carries no plan, currency or
 * payment method, so the header does not invent them; sections with no read model
 * yet (wallet, per-feature analytics, events) render demo data until wired.
 */
export const CustomerDetailProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityHeader', 'blocks/solution-billing-4', 'pages/shared/Money'],
  note: 'Customer detail: EntityHeader + DetailTabs; Overview from solution-billing-4, Information as single-pencil EditableCards. Lineage: ui/detail-kit, ui/section, ui/editable-card.',
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
  /** The Taxes section on the Information tab; omitted, it is not shown. */
  taxes?: ReactNode
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

type FormatDate = (date: Date | null) => string

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
)

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
  subscriptionsLoading = false,
  invoicesLoading = false,
  usage,
  wallet,
  taxes,
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

  const addButton = (
    <Button size="sm" className="h-9 px-3" onClick={onCreateSubscription}>
      <PlusIcon aria-hidden="true" />
      Create subscription
    </Button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EntityHeader
        trail={[{ label: 'Customers', onClick: onBack }, { label: customer.name }]}
        icon={<span className="text-xs font-medium">{initials}</span>}
        title={customer.name}
        {...(subtitle ? { subtitle } : {})}
        id={customer.externalId || customer.id}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Customer actions"
                />
              }
            >
              <MoreHorizontalIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={onCreateSubscription}>
                  <PlusIcon className="text-muted-foreground" aria-hidden="true" />
                  Create subscription
                </DropdownMenuItem>
                {onEdit ? (
                  <DropdownMenuItem onClick={onEdit}>
                    <PencilIcon className="text-muted-foreground" aria-hidden="true" />
                    {onUpdateField ? 'Edit billing details' : 'Edit customer'}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => onTabChange('wallet')}>
                  <WalletIcon className="text-muted-foreground" aria-hidden="true" />
                  Top up wallet
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    void navigator.clipboard?.writeText(customer.externalId || customer.id)
                  }
                >
                  <CopyIcon className="text-muted-foreground" aria-hidden="true" />
                  Copy customer ID
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="flex flex-col gap-6 px-6 pb-10">
        <DetailTabs
          value={tab}
          onValueChange={(next) => onTabChange(next as CustomerTab)}
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'subscriptions', label: 'Subscriptions', count: subscriptions.length },
            { value: 'invoices', label: 'Invoices', count: invoices.length },
            { value: 'wallet', label: 'Wallet' },
            { value: 'usage', label: 'Analytics' },
            { value: 'events', label: 'Events' },
            { value: 'information', label: 'Information' },
          ]}
        />

        {tab === 'overview' ? (
          <OverviewTab
            subscriptions={subscriptions}
            subscriptionsLoading={subscriptionsLoading}
            invoices={invoices}
            invoicesLoading={invoicesLoading}
            addButton={addButton}
            onViewInvoices={() => onTabChange('invoices')}
            onViewSubscriptions={() => onTabChange('subscriptions')}
            formatDate={formatDate}
            onOpenInvoice={onOpenInvoice}
            onOpenPlan={onOpenPlan}
          />
        ) : null}

        {tab === 'subscriptions' ? (
          <SubscriptionsTab
            subscriptions={subscriptions}
            isLoading={subscriptionsLoading}
            addButton={addButton}
            formatDate={formatDate}
            onOpenPlan={onOpenPlan}
          />
        ) : null}

        {tab === 'invoices' ? (
          <Section title="Invoices" flush bare>
            <InvoiceTable
              action={
                <Button size="sm" className="h-9 px-3">
                  <PlusIcon aria-hidden="true" />
                  New invoice
                </Button>
              }
              invoices={invoices}
              isLoading={invoicesLoading}
              formatDate={formatDate}
              onOpenInvoice={onOpenInvoice}
            />
          </Section>
        ) : null}

        {tab === 'wallet'
          ? (wallet ?? (
              <EmptyState
                title="No wallet connected"
                description="A customer's credit balance, top-ups and transactions will appear here once a wallet is set up."
              />
            ))
          : null}

        {tab === 'usage'
          ? (usage ?? (
              <EmptyState
                title="No usage to show yet"
                description="Metered events for this customer appear here as they are ingested, so a charge can be traced to what caused it."
              />
            ))
          : null}

        {tab === 'events' ? <CustomerEventsGrid events={DEMO_CUSTOMER_EVENTS} /> : null}

        {tab === 'information' ? (
          <InformationTab
            customer={customer}
            formatDate={formatDate}
            onUpdateField={onUpdateField}
            onEdit={onEdit}
            taxes={taxes}
          />
        ) : null}
      </div>
    </div>
  )
}

/** Demo activity feed for the Overview timeline. */
const DEMO_ACTIVITY: ActivityEvent[] = [
  {
    id: 6,
    title: 'Usage threshold reached',
    at: 'Today, 09:14',
    status: 'issue',
    summary: '80% of the monthly API calls allowance used.',
    labels: [{ id: 'a', label: 'Feature', hint: 'api_call', variant: 'secondary' }],
  },
  {
    id: 5,
    title: 'Invoice finalized',
    at: 'Yesterday',
    status: 'completed',
    summary: 'Invoice sent to the billing contact.',
    labels: [],
  },
  {
    id: 4,
    title: 'Payment received',
    at: 'Sep 28',
    status: 'completed',
    summary: 'Card payment settled.',
    labels: [],
  },
  {
    id: 3,
    title: 'Wallet top-up',
    at: 'Sep 20',
    status: 'completed',
    summary: 'Credits added to the prepaid wallet.',
    labels: [],
  },
  {
    id: 2,
    title: 'Subscription renewed',
    at: 'Sep 1',
    status: 'completed',
    summary: 'Billing period rolled over.',
    labels: [],
  },
  {
    id: 1,
    title: 'Customer created',
    at: 'Aug 12',
    status: 'completed',
    summary: 'Record created in Flexprice.',
    labels: [],
  },
]

function OverviewTab({
  subscriptions,
  subscriptionsLoading,
  invoices,
  invoicesLoading,
  addButton,
  onViewInvoices,
  onViewSubscriptions,
  formatDate,
  onOpenInvoice,
  onOpenPlan,
}: {
  subscriptions: Subscription[]
  subscriptionsLoading: boolean
  invoices: Invoice[]
  invoicesLoading: boolean
  addButton: ReactNode
  onViewInvoices: () => void
  onViewSubscriptions: () => void
  formatDate: FormatDate
  onOpenInvoice: ((invoiceId: string) => void) | undefined
  onOpenPlan: ((planId: string) => void) | undefined
}) {
  const running = subscriptions.filter((s) => s.status !== SubscriptionStatus.Cancelled)

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-8">
        <section aria-labelledby="customer-subscriptions" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="customer-subscriptions" className="text-sm font-medium">
              Active subscriptions{' '}
              <span className="text-muted-foreground ml-1 tabular-nums">{running.length}</span>
            </h2>
            {addButton}
          </div>
          {subscriptionsLoading ? (
            <LoadingRows rows={2} columns={3} />
          ) : running.length > 0 ? (
            <CustomerSubscriptionCards
              subscriptions={running}
              formatDate={formatDate}
              onViewAll={onViewSubscriptions}
              onOpenPlan={onOpenPlan}
            />
          ) : (
            <div className="rounded-xl border border-dashed">
              <SectionEmpty
                title="No active subscriptions"
                description="Create one to start billing this customer."
              />
            </div>
          )}
        </section>

        <Section title="Recent invoices" flush bare>
          <InvoiceTable
            action={
              <Button variant="outline" className="h-9 px-3" onClick={onViewInvoices}>
                View all
              </Button>
            }
            invoices={invoices.slice(0, 5)}
            isLoading={invoicesLoading}
            formatDate={formatDate}
            onOpenInvoice={onOpenInvoice}
          />
        </Section>
      </div>
      <Section title="Activity" flush className="xl:sticky xl:top-6">
        <ScrollArea className="h-[560px]">
          <div className="p-5">
            <AccountActivityRail events={DEMO_ACTIVITY} />
          </div>
        </ScrollArea>
      </Section>
    </div>
  )
}

function SubscriptionsTab({
  subscriptions,
  isLoading,
  addButton,
  formatDate,
  onOpenPlan,
}: {
  subscriptions: Subscription[]
  isLoading: boolean
  addButton: ReactNode
  formatDate: FormatDate
  onOpenPlan: ((planId: string) => void) | undefined
}) {
  return (
    <Section title="Subscriptions" flush bare>
      {isLoading ? (
        <div className="p-4">
          <LoadingRows />
        </div>
      ) : (
        <DetailTable
          label="Subscriptions"
          action={addButton}
          facet={{ label: 'Status', value: (s) => SUBSCRIPTION_STATUS_LABEL[s.status] }}
          noun="subscriptions"
          rows={subscriptions}
          getRowId={(s) => s.id}
          columns={[
            {
              key: 'plan',
              header: 'Plan',
              sortBy: (s) => s.planName,
              cell: (s) =>
                onOpenPlan ? (
                  <span className="font-medium">
                    <EntityLink label={s.planName} onOpen={() => onOpenPlan(s.planId)} />
                  </span>
                ) : (
                  <span className="font-medium">{s.planName}</span>
                ),
            },
            {
              key: 'status',
              header: 'Status',
              sortBy: (s) => SUBSCRIPTION_STATUS_LABEL[s.status],
              cell: (s) => <Status value={SUBSCRIPTION_STATUS_LABEL[s.status]} />,
            },
            {
              key: 'billing',
              header: 'Billing',
              sortBy: (s) => s.billingPeriodLabel,
              cell: (s) => <Muted>{s.billingPeriodLabel}</Muted>,
            },
            {
              key: 'period',
              header: 'Current period',
              sortBy: (s) => Number(new Date(s.currentPeriodStart ?? 0)),
              cell: (s) => (
                <Muted>
                  {s.currentPeriodStart && s.currentPeriodEnd
                    ? `${formatDate(s.currentPeriodStart)} – ${formatDate(s.currentPeriodEnd)}`
                    : '—'}
                </Muted>
              ),
            },
            {
              key: 'fixed',
              header: 'Fixed amount',
              cell: () => <Muted>—</Muted>,
            },
            {
              key: 'id',
              header: 'ID',
              cell: (s) => <span className="text-muted-foreground font-mono text-xs">{s.id}</span>,
            },
          ]}
          empty="No subscriptions yet. Subscribe this customer to a plan to start billing."
        />
      )}
    </Section>
  )
}

/** The collection state of an invoice as a simple chip. */
function invoicePayment(invoice: Invoice): { label: string; tone: PillTone } {
  if (invoice.status === InvoiceStatus.Paid) return { label: 'Paid', tone: 'success' }
  if (invoice.status === InvoiceStatus.Void) return { label: 'Void', tone: 'neutral' }
  if (invoice.status === InvoiceStatus.Skipped) return { label: 'Skipped', tone: 'neutral' }
  if (invoice.status === InvoiceStatus.Overdue) return { label: 'Overdue', tone: 'danger' }
  const partial =
    !isZeroMoney(invoice.amountRemaining) &&
    compareMoney(invoice.amountRemaining, invoice.amountDue) < 0
  if (partial) return { label: 'Partially Paid', tone: 'warning' }
  if (invoice.paymentStatus === PaymentStatus.Failed) return { label: 'Failed', tone: 'danger' }
  if (invoice.paymentStatus === PaymentStatus.Succeeded) return { label: 'Paid', tone: 'success' }
  return { label: 'Pending', tone: 'warning' }
}

/** The invoices table, edge to edge inside a flush section. */
function InvoiceTable({
  action,
  invoices,
  isLoading,
  formatDate,
  onOpenInvoice,
}: {
  action?: ReactNode
  invoices: Invoice[]
  isLoading: boolean
  formatDate: FormatDate
  onOpenInvoice: ((invoiceId: string) => void) | undefined
}) {
  if (isLoading) {
    return (
      <div className="p-4">
        <LoadingRows />
      </div>
    )
  }
  return (
    <DetailTable
      label="Invoices"
      {...(action ? { action } : {})}
      facet={{ label: 'Payment', value: (invoice) => invoicePayment(invoice).label }}
      noun="invoices"
      rows={invoices}
      {...(onOpenInvoice ? { onRowClick: (invoice: Invoice) => onOpenInvoice(invoice.id) } : {})}
      empty="No invoices yet. Invoices are created automatically from subscriptions, or raised by hand."
      columns={[
        {
          key: 'number',
          header: 'Invoice',
          sortBy: (invoice) => invoice.number,
          cell: (invoice) => (
            <span className={cn(invoice.status === InvoiceStatus.Draft && 'text-muted-foreground')}>
              {invoice.status === InvoiceStatus.Draft ? 'Draft' : invoice.number}
            </span>
          ),
        },
        {
          key: 'period',
          header: 'Period',
          sortBy: (invoice) => Number(new Date(invoice.periodStart ?? 0)),
          cell: (invoice) => (
            <Muted>
              {invoice.periodStart && invoice.periodEnd
                ? `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
                : '—'}
            </Muted>
          ),
        },
        {
          key: 'payment',
          header: 'Payment',
          sortBy: (invoice) => invoicePayment(invoice).label,
          cell: (invoice) => {
            const payment = invoicePayment(invoice)
            return <Pill tone={payment.tone}>{payment.label}</Pill>
          },
        },
        {
          key: 'due',
          header: 'Due',
          sortBy: (invoice) => Number(new Date(invoice.dueDate ?? 0)),
          cell: (invoice) => <Muted>{formatDate(invoice.dueDate)}</Muted>,
        },
        {
          key: 'total',
          header: 'Total',
          sortBy: (invoice) => Number(invoice.total.amount),
          cell: (invoice) => <Money value={invoice.total} />,
        },
      ]}
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
  taxes,
}: {
  customer: CustomerDetailModel
  formatDate: FormatDate
  onUpdateField: CustomerDetailProps['onUpdateField']
  onEdit: (() => void) | undefined
  taxes: ReactNode
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
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="flex flex-col gap-5 xl:col-span-2">
        <EditableCard
          title="Customer details"
          locked={!onUpdateField}
          fields={[
            { key: 'name', label: 'Name', value: customer.name, required: true },
            { key: 'externalId', label: 'External ID', value: customer.externalId, readOnly: true },
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
            {
              key: 'created',
              label: 'Created',
              value: formatDate(customer.createdAt),
              readOnly: true,
            },
            { key: 'id', label: 'Customer ID', value: customer.id, readOnly: true },
          ]}
          onSave={(changes) => onUpdateField?.(changes)}
        />

        <EditableCard
          title="Billing address"
          locked
          fields={[
            { key: 'address', label: 'Address', value: address, multiline: true, readOnly: true },
            { key: 'timezone', label: 'Timezone', value: customer.timezone || '', readOnly: true },
            {
              key: 'tax',
              label: 'Tax treatment',
              value: customer.taxTreatment
                ? CUSTOMER_TAX_TREATMENT_LABEL[customer.taxTreatment]
                : '',
              readOnly: true,
            },
            {
              key: 'updated',
              label: 'Updated',
              value: formatDate(customer.updatedAt),
              readOnly: true,
            },
          ]}
          onSave={() => undefined}
        >
          {onEdit ? (
            <Button variant="outline" size="sm" className="h-8 self-start px-3" onClick={onEdit}>
              Edit billing details
            </Button>
          ) : null}
        </EditableCard>

        {taxes}
      </div>

      <div className="flex flex-col gap-5">
        <Section title="Metadata">
          {metadata.length > 0 ? (
            <Properties
              columns={2}
              items={metadata.map(([key, value]) => ({ label: key, value }))}
            />
          ) : (
            <p className="text-muted-foreground text-[13px]">No metadata on this customer.</p>
          )}
        </Section>
      </div>
    </div>
  )
}

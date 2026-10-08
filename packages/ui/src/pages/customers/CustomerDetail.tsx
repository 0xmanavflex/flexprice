import { type ReactNode } from 'react'
import { MoreHorizontalIcon, PencilIcon, PlusIcon, ReceiptIcon, WalletIcon } from 'lucide-react'
import {
  type CustomerDetail as CustomerDetailModel,
  CUSTOMER_TAX_TREATMENT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  type Invoice,
  InvoiceStatus,
  PaymentStatus,
  compareMoney,
  isZeroMoney,
  SubscriptionStatus,
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
import { DetailTabs } from '@ui/compositions/DetailKit'
import { Section } from '@ui/compositions/Section'
import { EditableCard } from '@ui/compositions/EditableCard'
import { MetadataCard } from '@ui/compositions/MetadataCard'
import { EmptyState } from '@ui/compositions/EmptyState'
import { LoadingRows } from '@ui/compositions/States'
import { Money } from '../shared/Money'
import { EntityHeader } from '../shared/EntityHeader'
import { provenance } from '@ui/provenance'
import { CustomerEventsGrid, DEMO_CUSTOMER_EVENTS } from './CustomerEventsGrid'
import { EntityLink, Pill, Status, type PillTone } from '../shared/cells'
import { cn } from '@ui/lib/cn'
import { DetailTable } from '../shared/DetailTable'
import { SubscriptionCard } from './SubscriptionCard'

/**
 * A customer's detail page: an avatar-tile `EntityHeader` (name; on the right
 * Create contract / Create invoice, "ID" and email copy chips, ⋯ menu)
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
  /** The header's second primary action; omitted, it is not shown. */
  onCreateInvoice?: () => void
  /** Open the stepped Edit page: address and billing configuration. */
  onEdit?: () => void
  /**
   * Save one of the simple fields in place (name, email, phone). Omitted, the
   * Information tab is read-only. Resolve to commit; reject with an Error to
   * show its message beside the field.
   */
  onUpdateField?: (patch: { name?: string; email?: string; phone?: string }) => Promise<unknown>
  /** Save the whole metadata map. Omitted, the Metadata card is read-only. */
  onUpdateMetadata?: (metadata: Record<string, string>) => Promise<unknown>
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
  onCreateInvoice,
  onEdit,
  onUpdateField,
  onUpdateMetadata,
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
  const initials =
    customer.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?'

  const addButton = (
    <Button size="sm" className="h-8 px-3" onClick={onCreateSubscription}>
      <PlusIcon aria-hidden="true" />
      Create contract
    </Button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EntityHeader
        trail={[{ label: 'Customers', onClick: onBack }, { label: customer.name }]}
        icon={<span className="text-xs font-medium">{initials}</span>}
        title={customer.name}
        id={customer.externalId || customer.id}
        {...(customer.email ? { email: customer.email } : {})}
        primary={
          <>
            <Button className="h-8 px-3" onClick={onCreateSubscription}>
              <PlusIcon aria-hidden="true" />
              Create contract
            </Button>
            {onCreateInvoice ? (
              <Button variant="outline" className="h-8 px-3" onClick={onCreateInvoice}>
                <ReceiptIcon aria-hidden="true" />
                Create invoice
              </Button>
            ) : null}
          </>
        }
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
            { value: 'subscriptions', label: 'Contracts', count: subscriptions.length },
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
            onViewSubscriptions={() => onTabChange('subscriptions')}
            invoices={invoices}
            invoicesLoading={invoicesLoading}
            formatDate={formatDate}
            onOpenInvoice={onOpenInvoice}
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
          <Section table title="Invoices">
            <InvoiceTable
              invoices={invoices}
              isLoading={invoicesLoading}
              formatDate={formatDate}
              onOpenInvoice={onOpenInvoice}
              {...(onCreateInvoice
                ? {
                    action: (
                      <Button size="sm" className="h-8 px-3" onClick={onCreateInvoice}>
                        <PlusIcon aria-hidden="true" />
                        New invoice
                      </Button>
                    ),
                  }
                : {})}
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
            onUpdateMetadata={onUpdateMetadata}
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
    labels: [{ id: 'a', label: 'Product', hint: 'api_call', variant: 'secondary' }],
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
    title: 'Contract renewed',
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

const RUNNING: readonly SubscriptionStatus[] = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Trialing,
  SubscriptionStatus.Paused,
]
const MAX_CARDS = 4

function OverviewTab({
  subscriptions,
  subscriptionsLoading,
  onViewSubscriptions,
  invoices,
  invoicesLoading,
  formatDate,
  onOpenInvoice,
}: {
  subscriptions: Subscription[]
  subscriptionsLoading: boolean
  onViewSubscriptions: () => void
  invoices: Invoice[]
  invoicesLoading: boolean
  formatDate: FormatDate
  onOpenInvoice: ((invoiceId: string) => void) | undefined
}) {
  const running = subscriptions.filter((s) => RUNNING.includes(s.status))
  const shown = running.slice(0, MAX_CARDS)
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-8">
        <section aria-label="Running contracts">
          {subscriptionsLoading ? (
            <LoadingRows />
          ) : shown.length > 0 ? (
            <div className={cn('grid gap-4', shown.length > 1 && 'md:grid-cols-2')}>
              {shown.map((s, index) => (
                <SubscriptionCard
                  key={s.id}
                  subscription={s}
                  formatDate={formatDate}
                  onOpen={onViewSubscriptions}
                  className={shown.length % 2 === 1 && index === 0 ? 'md:col-span-2' : ''}
                />
              ))}
              {running.length > MAX_CARDS ? (
                <button
                  type="button"
                  onClick={onViewSubscriptions}
                  className="text-muted-foreground hover:bg-muted/40 hover:text-foreground rounded-xl border border-dashed py-3 text-[13px] md:col-span-2"
                >
                  View all {running.length} contracts
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-[13px]">
              No active contracts. Create one from the Contracts tab.
            </p>
          )}
        </section>
        <Section table title="Recent invoices">
          <InvoiceTable
            compactList
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
    <Section table title="Contracts">
      {isLoading ? (
        <div>
          <div className="flex justify-end px-6 py-3">{addButton}</div>
          <div className="px-4 pb-4">
            <LoadingRows />
          </div>
        </div>
      ) : (
        <DetailTable
          compact
          label="Contracts"
          action={addButton}
          facet={{ label: 'Status', value: (s) => SUBSCRIPTION_STATUS_LABEL[s.status] }}
          noun="contracts"
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
          empty="No contracts yet. Create a contract to put this customer on a plan and start billing."
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
  compactList = false,
  invoices,
  isLoading,
  formatDate,
  onOpenInvoice,
  action,
}: {
  /** The short list on the Overview: no search row and no Period column. */
  compactList?: boolean
  invoices: Invoice[]
  isLoading: boolean
  formatDate: FormatDate
  onOpenInvoice: ((invoiceId: string) => void) | undefined
  /** Sits on the toolbar, to the right of the filter. Omitted on the short overview list. */
  action?: ReactNode
}) {
  if (isLoading) {
    return (
      <div>
        {action ? <div className="flex justify-end px-6 py-3">{action}</div> : null}
        <div className="px-4 pb-4">
          <LoadingRows />
        </div>
      </div>
    )
  }
  return (
    <DetailTable
      compact
      toolbar={!compactList}
      label="Invoices"
      {...(action ? { action } : {})}
      facet={{ label: 'Payment', value: (invoice) => invoicePayment(invoice).label }}
      noun="invoices"
      rows={invoices}
      {...(onOpenInvoice ? { onRowClick: (invoice: Invoice) => onOpenInvoice(invoice.id) } : {})}
      empty="No invoices yet. Invoices are created automatically from contracts, or raised by hand."
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
        ...(compactList
          ? []
          : [
              {
                key: 'period',
                header: 'Period',
                sortBy: (invoice: Invoice) => Number(new Date(invoice.periodStart ?? 0)),
                cell: (invoice: Invoice) => (
                  <Muted>
                    {invoice.periodStart && invoice.periodEnd
                      ? `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
                      : '—'}
                  </Muted>
                ),
              },
            ]),
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
  onUpdateMetadata,
  onEdit,
  taxes,
}: {
  customer: CustomerDetailModel
  formatDate: FormatDate
  onUpdateField: CustomerDetailProps['onUpdateField']
  onUpdateMetadata: CustomerDetailProps['onUpdateMetadata']
  onEdit: (() => void) | undefined
  taxes: ReactNode
}) {
  const street = [customer.addressLine1, customer.addressLine2].filter(Boolean).join(', ')

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
            { key: 'address', label: 'Address', value: street, readOnly: true },
            { key: 'city', label: 'City', value: customer.addressCity ?? '', readOnly: true },
            { key: 'state', label: 'State', value: customer.addressState ?? '', readOnly: true },
            {
              key: 'postal',
              label: 'Postal code',
              value: customer.addressPostalCode ?? '',
              readOnly: true,
            },
            {
              key: 'country',
              label: 'Country',
              value: customer.addressCountry ?? '',
              readOnly: true,
            },
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
        <MetadataCard
          metadata={customer.metadata}
          {...(onUpdateMetadata ? { onSave: onUpdateMetadata } : {})}
        />
      </div>
    </div>
  )
}

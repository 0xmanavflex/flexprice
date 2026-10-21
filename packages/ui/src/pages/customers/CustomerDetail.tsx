import { type ReactNode } from 'react'
import {
  ArchiveIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  ReceiptIcon,
  RocketIcon,
  WalletIcon,
} from '@ui/icons'
import {
  type CustomerDetail as CustomerDetailModel,
  CUSTOMER_STATUS_LABEL,
  CUSTOMER_TAX_TREATMENT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  type Invoice,
  InvoiceStatus,
  PAYMENT_STATUS_LABEL,
  type Payment,
  PaymentStatus,
  compareMoney,
  formatMoney,
  isZeroMoney,
  SubscriptionStatus,
  type Subscription,
  RBAC_ENTITY,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { AccessScope, WriteGate } from '@ui/compositions/access/Access'
import { ActivitySection, type ActivityLogEntry } from '@ui/compositions/detail/ActivityLog'
import { DetailTabs, OverviewTiles, type DetailMenuItem } from '@ui/compositions/detail/DetailKit'
import { Section } from '@ui/compositions/layout/Section'
import { EditableCard } from '@ui/compositions/forms/EditableCard'
import { RelatedCard } from '@ui/compositions/detail/RelatedCard'
import { MetadataCard } from '@ui/compositions/detail/MetadataCard'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import { SubTabState, truncationNote } from '@ui/compositions/detail/SubTabState'
import { Money } from '../shared/Money'
import { EntityHeader } from '../shared/EntityHeader'
import { provenance } from '@ui/provenance'
import { EmDash, EntityLink, Pill, Status, type PillTone } from '../shared/cells'
import { DetailTable } from '../shared/DetailTable'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import {
  ContractIntegrations,
  type ContractIntegrationsProps,
} from '../contracts/ContractIntegrations'
import { IntegrationMark, IntegrationMarks } from './IntegrationMark'
import { CopyValue } from '../shared/CopyValue'

/**
 * A customer's detail page: an avatar-tile `EntityHeader` (name; on the right
 * the connected integration marks, "ID" and email copy chips, and a ⋯ menu
 * holding Create invoice, Edit and Top up)
 * over line `DetailTabs`; the active tab renders as reference-style sections. It is presentational: the page fetches and hands data in.
 *
 * It shows only what the API has. A customer record carries no plan, currency or
 * payment method, so the header does not invent them; sections with no read
 * model yet (per-feature revenue and cost) say "not available yet" rather than
 * show sample figures. A contracts or invoices read that is loading or failed is
 * shown as that, never as "none yet" or a zero.
 */
export const CustomerDetailProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/shared/EntityHeader',
    'compositions/activity-log',
    'pages/shared/Money',
    'compositions/SubTabState',
  ],
  note: 'Customer detail: EntityHeader + DetailTabs; Overview from OverviewTiles, a Contracts table and the activity log, Information as single-pencil EditableCards. Lineage: ui/detail-kit, ui/section, ui/editable-card.',
})

/** How many invoices the customer page asks for; at this count the list may be cut. */
export const CUSTOMER_INVOICES_LIMIT = 200

export type CustomerTab = 'overview' | 'invoices' | 'wallet' | 'usage' | 'events' | 'information'

export const CUSTOMER_TABS = [
  'overview',
  'invoices',
  'wallet',
  'usage',
  'events',
  'information',
] as const satisfies readonly CustomerTab[]

export interface CustomerDetailProps {
  customer: CustomerDetailModel
  integrationControls?: ContractIntegrationsProps
  subscriptions: Subscription[]
  invoices: Invoice[]
  tab: CustomerTab
  onTabChange: (tab: CustomerTab) => void
  /** Back to the customer list. */
  onBack: () => void
  /** Adds "Create invoice" to the header menu and a "New invoice" button on the Invoices tab; omitted, neither is shown. */
  onCreateInvoice?: () => void
  /** Adds "Create contract" to the header menu and the Overview Contracts table; omitted, neither is shown. */
  onCreateContract?: () => void
  /** Open the stepped Edit page: address and billing configuration. */
  onEdit?: () => void
  /** Adds "Archive customer" to the header menu; the caller confirms and acts. */
  onArchive?: () => void
  /** Adds "Open customer portal" to the header menu (V1's portal link). */
  onOpenPortal?: () => void
  /** Adds "Copy portal link" to the header menu. */
  onCopyPortalLink?: () => void
  /**
   * Adds "Stream sample events" to the header menu: the backend generates a
   * minute of usage events for one of this customer's subscriptions. Omitted
   * (production, or no live subscription), the item is not shown.
   */
  onStreamEvents?: () => void
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
  /**
   * The Invoices tab's row menu for one invoice — finalize, record payment,
   * void… The page decides which apply; a destructive one sits last, apart.
   */
  invoiceActions?: (invoice: Invoice) => InvoiceRowAction[]
  /** The "View all" beside Recent payments. Omitted, the button is not shown. */
  onViewAllPayments?: () => void
  onOpenPlan?: (planId: string) => void
  /** Open one contract's own page, from a Contracts row or a running-contract card. Omitted, rows are not links. */
  onOpenContract?: (subscriptionId: string) => void
  subscriptionsLoading?: boolean
  /** The contracts read failed — shown as such, never as "no contracts". */
  subscriptionsError?: boolean
  /** Refetch the contracts; the Contracts error panel offers it as Try again. */
  onRetrySubscriptions?: () => void
  invoicesLoading?: boolean
  /** The invoices read failed — shown as such, never as "no invoices" or a count of 0. */
  invoicesError?: boolean
  /** Refetch the invoices; the Invoices error panel offers it as Try again. */
  onRetryInvoices?: () => void
  /**
   * The customer's recent payments, newest first. Omitted, the Overview leaves
   * the Recent payments section out rather than claim there are none.
   */
  payments?: Payment[] | undefined
  paymentsLoading?: boolean | undefined
  /** The payments read failed — shown as such, never as "no payments". */
  paymentsError?: boolean | undefined
  onRetryPayments?: (() => void) | undefined
  /**
   * The audit trail from `POST /activity`. When set, it replaces the dates
   * assembled from the customer, contracts and invoices already on the page.
   * Stories omit it and keep that assembled log.
   */
  activity?: ActivityLogEntry[] | undefined
  activityLoading?: boolean | undefined
  activityError?: boolean | undefined
  /** A change just landed and the new activity row is still being written. */
  activityAwaiting?: boolean | undefined
  /**
   * The Events tab's contents (the customer's recent ingested events). It is a
   * slot because the events read has its own loading and failure states. Omitted,
   * the tab says events are not available here yet.
   */
  events?: ReactNode
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
  integrationControls,
  subscriptions,
  invoices,
  tab,
  onTabChange,
  onBack,
  onCreateInvoice,
  onCreateContract,
  onEdit,
  onArchive,
  onOpenPortal,
  onCopyPortalLink,
  onStreamEvents,
  onUpdateField,
  onUpdateMetadata,
  onOpenInvoice,
  invoiceActions,
  onViewAllPayments,
  onOpenPlan,
  onOpenContract,
  subscriptionsLoading = false,
  subscriptionsError = false,
  onRetrySubscriptions,
  invoicesLoading = false,
  invoicesError = false,
  onRetryInvoices,
  payments,
  paymentsLoading = false,
  paymentsError = false,
  onRetryPayments,
  activity,
  activityLoading = false,
  activityError = false,
  activityAwaiting = false,
  events,
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

  const menu: DetailMenuItem[] = [
    ...(onCreateContract
      ? [
          {
            id: 'create-contract',
            label: 'Create contract',
            icon: <FileTextIcon className="text-muted-foreground" aria-hidden="true" />,
            onSelect: onCreateContract,
            entity: RBAC_ENTITY.Subscription,
          },
        ]
      : []),
    ...(onCreateInvoice
      ? [
          {
            id: 'create-invoice',
            label: 'Create invoice',
            icon: <ReceiptIcon className="text-muted-foreground size-4" aria-hidden="true" />,
            onSelect: onCreateInvoice,
            entity: RBAC_ENTITY.Invoice,
          },
        ]
      : []),
    ...(onEdit
      ? [
          {
            id: 'edit',
            label: 'Edit customer',
            icon: <PencilIcon className="text-muted-foreground" aria-hidden="true" />,
            onSelect: onEdit,
          },
        ]
      : []),
    ...(onStreamEvents
      ? [
          {
            id: 'stream-events',
            label: 'Stream sample events',
            icon: <RocketIcon className="text-muted-foreground" aria-hidden="true" />,
            onSelect: onStreamEvents,
            entity: RBAC_ENTITY.Event,
          },
        ]
      : []),
    ...(onOpenPortal && customer.externalId
      ? [
          {
            id: 'open-portal',
            label: 'Open customer portal',
            icon: <ExternalLinkIcon className="text-muted-foreground" aria-hidden="true" />,
            onSelect: onOpenPortal,
          },
        ]
      : []),
    ...(onCopyPortalLink && customer.externalId
      ? [
          {
            id: 'copy-portal-link',
            label: 'Copy portal link',
            icon: <LinkIcon className="text-muted-foreground" aria-hidden="true" />,
            onSelect: onCopyPortalLink,
          },
        ]
      : []),
    {
      id: 'top-up-wallet',
      label: 'Top up wallet',
      icon: <WalletIcon className="text-muted-foreground" aria-hidden="true" />,
      onSelect: () => onTabChange('wallet'),
      entity: RBAC_ENTITY.Wallet,
    },
    ...(onArchive
      ? [
          {
            id: 'archive',
            label: 'Archive customer',
            icon: <ArchiveIcon aria-hidden="true" />,
            onSelect: onArchive,
            destructive: true,
          },
        ]
      : []),
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EntityHeader
        trail={[{ label: 'Customers', onClick: onBack }, { label: 'Customer details' }]}
        icon={<span className="text-xs font-medium">{initials}</span>}
        title={customer.name}
        badges={<Status value={CUSTOMER_STATUS_LABEL[customer.status]} />}
        // The external id is what the customer's systems know them by, so it leads.
        {...(customer.externalId ? { externalId: customer.externalId } : {})}
        id={customer.id}
        leading={
          integrationControls ? (
            <ContractIntegrations {...integrationControls} showLink={false} />
          ) : (
            <IntegrationMarks integrations={customer.integrations} />
          )
        }
        {...(customer.email ? { email: customer.email } : {})}
        menuLabel="Customer actions"
        menu={menu}
      />
      <div className="mx-auto flex w-full max-w-[var(--shell-max)] min-w-0 flex-col gap-6 px-6 pb-10">
        <DetailTabs
          value={tab}
          onValueChange={(next) => onTabChange(next as CustomerTab)}
          tabs={[
            { value: 'overview', label: 'Overview' },
            {
              value: 'invoices',
              label: 'Invoices',
              ...(invoicesLoading || invoicesError ? {} : { count: invoices.length }),
            },
            { value: 'wallet', label: 'Wallet' },
            { value: 'usage', label: 'Analytics' },
            { value: 'events', label: 'Events' },
            { value: 'information', label: 'Information' },
          ]}
        />

        {tab === 'overview' ? (
          <OverviewTab
            customer={customer}
            subscriptions={subscriptions}
            subscriptionsLoading={subscriptionsLoading}
            subscriptionsError={subscriptionsError}
            onRetrySubscriptions={onRetrySubscriptions}
            onOpenPlan={onOpenPlan}
            onOpenContract={onOpenContract}
            onCreateContract={onCreateContract}
            invoices={invoices}
            invoicesLoading={invoicesLoading}
            invoicesError={invoicesError}
            onRetryInvoices={onRetryInvoices}
            payments={payments}
            paymentsLoading={paymentsLoading}
            paymentsError={paymentsError}
            onRetryPayments={onRetryPayments}
            formatDate={formatDate}
            locale={locale}
            onOpenInvoice={onOpenInvoice}
            onViewAllInvoices={() => onTabChange('invoices')}
            onViewAllPayments={onViewAllPayments}
            activity={activity}
            activityLoading={activityLoading}
            activityError={activityError}
            activityAwaiting={activityAwaiting}
            integrationControls={integrationControls}
            onUpdateMetadata={onUpdateMetadata}
          />
        ) : null}

        {tab === 'invoices' ? (
          // The invoices here write invoices, not the customer.
          <AccessScope entity={RBAC_ENTITY.Invoice}>
            <Section table title="Invoices">
              <InvoiceTable
                invoices={invoices}
                isLoading={invoicesLoading}
                isError={invoicesError}
                onRetry={onRetryInvoices}
                formatDate={formatDate}
                onOpenInvoice={onOpenInvoice}
                {...(invoiceActions ? { actions: invoiceActions } : {})}
                {...(onCreateInvoice
                  ? {
                      action: (
                        <WriteGate>
                          <Button size="sm" className="h-8 px-3" onClick={onCreateInvoice}>
                            <PlusIcon aria-hidden="true" />
                            New invoice
                          </Button>
                        </WriteGate>
                      ),
                    }
                  : {})}
              />
            </Section>
          </AccessScope>
        ) : null}

        {tab === 'wallet' ? (
          <AccessScope entity={RBAC_ENTITY.Wallet}>
            {wallet ?? (
              <EmptyState
                scene="customers"
                title="Wallet not available here"
                description="This view has no wallet data to show. A customer's credit balance, top-ups and transactions appear here when it is provided."
              />
            )}
          </AccessScope>
        ) : null}

        {tab === 'usage'
          ? (usage ?? (
              <EmptyState
                scene="customers"
                title="Usage not available here"
                description="This view has no usage data to show. Per-feature allowances and consumption appear here when it is provided."
              />
            ))
          : null}

        {tab === 'events'
          ? (events ?? (
              <EmptyState
                scene="customers"
                title="Events not available here"
                description="This view has no event feed to show. Events ingested for this customer appear here when it is provided."
              />
            ))
          : null}

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

const RUNNING: readonly SubscriptionStatus[] = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Trialing,
  SubscriptionStatus.Paused,
]
const BILLING: readonly SubscriptionStatus[] = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Trialing,
]
const NOT_ISSUED: readonly InvoiceStatus[] = [
  InvoiceStatus.Draft,
  InvoiceStatus.Void,
  InvoiceStatus.Skipped,
]
const time = (date: Date) => date.getTime()

/**
 * The activity the page already holds: when the customer, each contract and each
 * issued invoice came to exist. There is no customer activity feed in the API.
 */
function activityEntries(
  customer: CustomerDetailModel,
  subscriptions: Subscription[],
  invoices: Invoice[],
  locale: string | undefined,
): ActivityLogEntry[] {
  const stamp = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const dated: Array<{ when: Date; entry: ActivityLogEntry }> = []
  const add = (when: Date | null, entry: Omit<ActivityLogEntry, 'at'>) => {
    if (when) dated.push({ when, entry: { ...entry, at: stamp.format(when) } })
  }
  add(customer.createdAt, { id: `customer-${customer.id}`, title: 'Customer created' })
  for (const s of subscriptions) {
    add(s.createdAt ?? s.startDate, {
      id: `contract-${s.id}`,
      title: 'Contract created',
      record: s.id,
      summary: `on ${s.planName}`,
    })
  }
  for (const i of invoices) {
    if (NOT_ISSUED.includes(i.status)) continue
    add(i.issuedAt, {
      id: `invoice-${i.id}`,
      title: 'Invoice issued',
      record: i.number,
      summary: formatMoney(i.total),
    })
  }
  return dated.sort((x, y) => time(y.when) - time(x.when)).map((d) => d.entry)
}

function ViewAllButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="h-8 px-3" onClick={onClick}>
      <EyeIcon aria-hidden="true" />
      View all
      <span className="sr-only"> {label}</span>
    </Button>
  )
}

function OverviewTab({
  customer,
  subscriptions,
  subscriptionsLoading,
  subscriptionsError,
  onRetrySubscriptions,
  onOpenPlan,
  onOpenContract,
  onCreateContract,
  invoices,
  invoicesLoading,
  invoicesError,
  onRetryInvoices,
  payments,
  paymentsLoading,
  paymentsError,
  onRetryPayments,
  formatDate,
  locale,
  onOpenInvoice,
  onViewAllInvoices,
  onViewAllPayments,
  activity,
  activityLoading,
  activityError,
  activityAwaiting,
  integrationControls,
  onUpdateMetadata,
}: {
  customer: CustomerDetailModel
  subscriptions: Subscription[]
  subscriptionsLoading: boolean
  subscriptionsError: boolean
  onRetrySubscriptions: (() => void) | undefined
  onOpenPlan: ((planId: string) => void) | undefined
  onOpenContract: ((subscriptionId: string) => void) | undefined
  onCreateContract: (() => void) | undefined
  invoices: Invoice[]
  invoicesLoading: boolean
  invoicesError: boolean
  onRetryInvoices: (() => void) | undefined
  payments: Payment[] | undefined
  paymentsLoading: boolean
  paymentsError: boolean
  onRetryPayments: (() => void) | undefined
  formatDate: FormatDate
  locale: string | undefined
  onOpenInvoice: ((invoiceId: string) => void) | undefined
  onViewAllInvoices: () => void
  onViewAllPayments: (() => void) | undefined
  activity: ActivityLogEntry[] | undefined
  activityLoading: boolean | undefined
  activityError: boolean | undefined
  activityAwaiting: boolean | undefined
  onUpdateMetadata: CustomerDetailProps['onUpdateMetadata']
  integrationControls: CustomerDetailProps['integrationControls']
}) {
  // A loading or failed read is "not known", never "none": the tiles and the
  // activity note say so rather than count what has not arrived.
  const contractsKnown = !subscriptionsLoading && !subscriptionsError
  const invoicesKnown = !invoicesLoading && !invoicesError
  const live = subscriptions.filter((s) => RUNNING.includes(s.status))
  const lastInvoice = invoices
    .filter((i) => i.issuedAt && !NOT_ISSUED.includes(i.status))
    .sort((x, y) => time(y.issuedAt!) - time(x.issuedAt!))[0]
  const nextBilling = subscriptions
    .filter((s) => BILLING.includes(s.status) && s.currentPeriodEnd)
    .sort((x, y) => time(x.currentPeriodEnd!) - time(y.currentPeriodEnd!))[0]

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-8">
        <OverviewTiles
          tiles={[
            {
              label: 'Customer since',
              value: formatDate(customer.createdAt),
              detail: customer.createdAt ? 'Date this customer was created' : 'Not recorded',
            },
            {
              label: 'Live contracts',
              value: contractsKnown ? String(live.length) : '—',
              detail: contractsKnown
                ? `${live.length === 1 ? 'Contract' : 'Contracts'} active, trialing or paused`
                : subscriptionsError
                  ? 'Could not load contracts'
                  : 'Loading contracts…',
            },
            {
              label: 'Last invoice',
              value: invoicesKnown && lastInvoice ? formatDate(lastInvoice.issuedAt) : '—',
              detail: !invoicesKnown
                ? invoicesError
                  ? 'Could not load invoices'
                  : 'Loading invoices…'
                : lastInvoice
                  ? `${formatMoney(lastInvoice.total)} · ${lastInvoice.number}`
                  : 'No invoices issued yet',
            },
            {
              label: 'Next invoice',
              value: contractsKnown && nextBilling ? formatDate(nextBilling.currentPeriodEnd) : '—',
              detail: !contractsKnown
                ? subscriptionsError
                  ? 'Could not load contracts'
                  : 'Loading contracts…'
                : nextBilling
                  ? `Current period of ${nextBilling.id} ends`
                  : 'No contract is billing',
            },
          ]}
        />
        <ContractsTable
          showTitle
          subscriptions={subscriptions}
          isLoading={subscriptionsLoading}
          isError={subscriptionsError}
          onRetry={onRetrySubscriptions}
          formatDate={formatDate}
          onOpenPlan={onOpenPlan}
          onOpenContract={onOpenContract}
          onCreateContract={onCreateContract}
        />
        <Section
          table
          showTitle
          title="Recent invoices"
          {...(invoices.length > 0
            ? { action: <ViewAllButton label="invoices" onClick={onViewAllInvoices} /> }
            : {})}
        >
          <InvoiceTable
            compactList
            invoices={invoices.slice(0, 5)}
            isLoading={invoicesLoading}
            isError={invoicesError}
            onRetry={onRetryInvoices}
            formatDate={formatDate}
            onOpenInvoice={onOpenInvoice}
          />
        </Section>
        {payments ? (
          <Section
            table
            showTitle
            title="Recent payments"
            {...(onViewAllPayments && payments.length > 0
              ? { action: <ViewAllButton label="payments" onClick={onViewAllPayments} /> }
              : {})}
          >
            <PaymentTable
              payments={payments.slice(0, 5)}
              isLoading={paymentsLoading}
              isError={paymentsError}
              onRetry={onRetryPayments}
              formatDate={formatDate}
            />
          </Section>
        ) : null}
      </div>
      <aside
        aria-label="Customer details"
        className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-6"
      >
        <ActivitySection
          entries={
            activity ??
            (activityLoading || activityError
              ? []
              : activityEntries(customer, subscriptions, invoices, locale))
          }
          {...(activityLoading
            ? { emptyText: 'Loading activity…' }
            : activityError
              ? { emptyText: 'Could not load activity.' }
              : {})}
          awaiting={activityAwaiting ?? false}
        />
        <MetadataCard
          metadata={customer.metadata}
          {...(onUpdateMetadata ? { onSave: onUpdateMetadata } : {})}
        />
        {integrationControls ? (
          <RelatedCard items={[]}>
            <ContractIntegrations {...integrationControls} layout="rows" />
          </RelatedCard>
        ) : (
          <IntegrationsCard integrations={customer.integrations} />
        )}
      </aside>
    </div>
  )
}

/** "CARD" / "ACH_DEBIT" as words; empty when the API sent none. */
function paymentMethod(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * The short Overview list of a customer's payments. Receipt number is in the
 * column set the redesign asks for but the payments API does not return one,
 * so it reads as an em dash rather than a made-up reference.
 */
function PaymentTable({
  payments,
  isLoading,
  isError,
  onRetry,
  formatDate,
}: {
  payments: Payment[]
  isLoading: boolean
  isError: boolean
  onRetry: (() => void) | undefined
  formatDate: FormatDate
}) {
  return (
    <SubTabState
      hasData={payments.length > 0}
      isLoading={isLoading}
      error={isError ? "Payments couldn't be loaded" : null}
      onRetry={onRetry}
      columns={6}
      loadingLabel="Loading payments"
      empty={{
        scene: 'customers',
        title: 'No payments yet',
        description: 'Payments collected against this customer’s invoices appear here.',
      }}
    >
      <DetailTable
        compact
        toolbar={false}
        label="Recent payments"
        noun="payments"
        rows={payments}
        columns={[
          {
            key: 'receipt',
            header: 'Receipt number',
            width: 150,
            cell: () => <Muted>—</Muted>,
          },
          {
            key: 'invoice',
            header: 'Invoice number',
            width: 160,
            cell: (payment) => (payment.invoiceNumber ? payment.invoiceNumber : <Muted>—</Muted>),
          },
          {
            key: 'amount',
            header: 'Amount',
            width: 110,
            cell: (payment) => <Money value={payment.amount} />,
          },
          {
            key: 'method',
            header: 'Payment method',
            width: 150,
            cell: (payment) =>
              payment.methodType ? paymentMethod(payment.methodType) : <Muted>—</Muted>,
          },
          {
            key: 'status',
            header: 'Status',
            width: 130,
            cell: (payment) => <Status value={PAYMENT_STATUS_LABEL[payment.status]} />,
          },
          {
            key: 'date',
            header: 'Date',
            width: 130,
            cell: (payment) => <Muted>{formatDate(payment.createdAt)}</Muted>,
          },
        ]}
      />
    </SubTabState>
  )
}

function ContractsTable({
  showTitle,
  subscriptions,
  isLoading,
  isError,
  onRetry,
  formatDate,
  onOpenPlan,
  onOpenContract,
  onCreateContract,
}: {
  showTitle: boolean
  subscriptions: Subscription[]
  isLoading: boolean
  isError: boolean
  onRetry: (() => void) | undefined
  formatDate: FormatDate
  onOpenPlan: ((planId: string) => void) | undefined
  onOpenContract: ((subscriptionId: string) => void) | undefined
  onCreateContract: (() => void) | undefined
}) {
  return (
    <Section
      table
      showTitle={showTitle}
      title="Contracts"
      {...(onCreateContract
        ? {
            action: (
              <WriteGate entity={RBAC_ENTITY.Subscription}>
                <Button size="sm" className="h-8 px-3" onClick={onCreateContract}>
                  <PlusIcon aria-hidden="true" />
                  Create contract
                </Button>
              </WriteGate>
            ),
          }
        : {})}
    >
      <SubTabState
        hasData={subscriptions.length > 0}
        isLoading={isLoading}
        error={isError ? "Contracts couldn't be loaded" : null}
        onRetry={onRetry}
        columns={5}
        loadingLabel="Loading contracts"
        empty={{
          scene: 'customers',
          title: 'No contracts yet',
          description: 'A contract puts this customer on a plan. Create one to start billing them.',
        }}
      >
        <DetailTable
          compact
          label="Contracts"
          facet={{ label: 'Status', value: (s) => SUBSCRIPTION_STATUS_LABEL[s.status] }}
          noun="contracts"
          rows={subscriptions}
          getRowId={(s) => s.id}
          columns={[
            {
              key: 'contract',
              header: 'Contract',
              width: 140,
              sortBy: (s) => s.id,
              cell: (s) =>
                onOpenContract ? (
                  <span className="font-mono text-xs font-medium">
                    <EntityLink label={s.id} onOpen={() => onOpenContract(s.id)} />
                  </span>
                ) : (
                  <span className="font-mono text-xs font-medium">{s.id}</span>
                ),
            },
            {
              key: 'plan',
              header: 'Plan',
              width: 160,
              sortBy: (s) => s.planName,
              cell: (s) =>
                onOpenPlan ? (
                  <EntityLink label={s.planName} onOpen={() => onOpenPlan(s.planId)} />
                ) : (
                  <Muted>{s.planName}</Muted>
                ),
            },
            {
              key: 'status',
              header: 'Status',
              width: 120,
              sortBy: (s) => SUBSCRIPTION_STATUS_LABEL[s.status],
              cell: (s) => <Status value={SUBSCRIPTION_STATUS_LABEL[s.status]} />,
            },
            {
              key: 'billing',
              header: 'Billing',
              width: 120,
              sortBy: (s) => s.billingPeriodLabel,
              cell: (s) => <Muted>{s.billingPeriodLabel}</Muted>,
            },
            {
              key: 'period',
              header: 'Current period',
              width: 240,
              sortBy: (s) => Number(new Date(s.currentPeriodStart ?? 0)),
              cell: (s) => (
                <Muted>
                  {s.currentPeriodStart && s.currentPeriodEnd
                    ? `${formatDate(s.currentPeriodStart)} – ${formatDate(s.currentPeriodEnd)}`
                    : '—'}
                </Muted>
              ),
            },
          ]}
          {...(onOpenContract ? { onRowClick: (s: Subscription) => onOpenContract(s.id) } : {})}
        />
      </SubTabState>
    </Section>
  )
}

/** One item of an invoice row's menu. */
export interface InvoiceRowAction {
  label: string
  onSelect: () => void
  destructive?: boolean
}

/** The document state of an invoice: Draft, Finalized or Void. */
function invoiceDocument(invoice: Invoice): string {
  if (invoice.status === InvoiceStatus.Draft) return 'Draft'
  if (invoice.status === InvoiceStatus.Void) return 'Void'
  if (invoice.status === InvoiceStatus.Skipped) return 'Skipped'
  return 'Finalized'
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
  isError,
  onRetry,
  formatDate,
  onOpenInvoice,
  action,
  actions,
}: {
  /** The short list on the Overview: no toolbar. */
  compactList?: boolean
  invoices: Invoice[]
  isLoading: boolean
  isError: boolean
  onRetry: (() => void) | undefined
  formatDate: FormatDate
  onOpenInvoice: ((invoiceId: string) => void) | undefined
  /** Sits on the toolbar, to the right of the filter. Omitted on the short overview list. */
  action?: ReactNode
  /** Each row's menu; omitted, rows have none. */
  actions?: (invoice: Invoice) => InvoiceRowAction[]
}) {
  // Rows win; otherwise a failed read is an error with retry, a pending one a
  // skeleton, and only a finished empty read says "no invoices".
  if (invoices.length === 0) {
    const failed = isLoading || isError
    return (
      <div>
        {action && failed ? <div className="flex justify-end px-6 py-3">{action}</div> : null}
        <SubTabState
          hasData={false}
          isLoading={isLoading}
          error={isError ? "Invoices couldn't be loaded" : null}
          onRetry={onRetry}
          columns={6}
          loadingLabel="Loading invoices"
          empty={{
            scene: 'customers',
            title: 'No invoices yet',
            description: 'Invoices are created automatically from contracts, or raised by hand.',
            ...(action ? { action } : {}),
          }}
        >
          {null}
        </SubTabState>
      </div>
    )
  }
  const capped = compactList ? null : truncationNote(invoices.length, CUSTOMER_INVOICES_LIMIT)
  return (
    <>
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
            header: 'Invoice number',
            width: 160,
            sortBy: (invoice) => invoice.number,
            cell: (invoice) =>
              invoice.number ? (
                <span className="font-mono text-xs">{invoice.number}</span>
              ) : (
                <EmDash />
              ),
          },
          {
            key: 'issued',
            header: 'Issue date',
            width: 140,
            sortBy: (invoice) => Number(new Date(invoice.issuedAt ?? 0)),
            cell: (invoice) => <Muted>{formatDate(invoice.issuedAt)}</Muted>,
          },
          {
            key: 'due',
            header: 'Due date',
            width: 140,
            sortBy: (invoice) => Number(new Date(invoice.dueDate ?? 0)),
            cell: (invoice) => <Muted>{formatDate(invoice.dueDate)}</Muted>,
          },
          {
            key: 'status',
            header: 'Status',
            width: 130,
            sortBy: (invoice) => invoiceDocument(invoice),
            cell: (invoice) => <Status value={invoiceDocument(invoice)} />,
          },
          {
            key: 'payment',
            header: 'Payment',
            width: 150,
            sortBy: (invoice) => invoicePayment(invoice).label,
            cell: (invoice) => {
              const payment = invoicePayment(invoice)
              return <Pill tone={payment.tone}>{payment.label}</Pill>
            },
          },
          {
            key: 'total',
            header: 'Amount',
            width: 110,
            sortBy: (invoice) => Number(invoice.total.amount),
            cell: (invoice) => <Money value={invoice.total} />,
          },
          ...(actions
            ? [
                {
                  key: 'actions',
                  header: '',
                  width: 56,
                  cell: (invoice: Invoice) => {
                    const items = actions(invoice)
                    if (items.length === 0) return null
                    const removal = items.find((item) => item.destructive)
                    return (
                      // The menu is its own control: a click on it must not open the row.
                      <div onClick={(event) => event.stopPropagation()}>
                        <RowActionsMenu
                          label={invoice.number || 'invoice'}
                          extra={items.filter((item) => !item.destructive)}
                          {...(removal
                            ? { onRemove: removal.onSelect, removeLabel: removal.label }
                            : {})}
                        />
                      </div>
                    )
                  },
                },
              ]
            : []),
        ]}
      />
      {capped ? <p className="text-muted-foreground border-t px-6 py-3 text-xs">{capped}</p> : null}
    </>
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
            {
              key: 'externalId',
              label: 'External ID',
              value: customer.externalId,
              display: customer.externalId ? (
                <span className="font-mono text-[13px]">{customer.externalId}</span>
              ) : undefined,
              readOnly: true,
            },
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
            {
              key: 'id',
              label: 'Customer ID',
              value: customer.id,
              display: <span className="font-mono text-[13px]">{customer.id}</span>,
              readOnly: true,
            },
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
        <IntegrationsCard integrations={customer.integrations} />
      </div>
    </div>
  )
}

/** Where this customer is mirrored: one row per connected provider, with the customer's id there. */
function IntegrationsCard({ integrations }: { integrations: CustomerDetailModel['integrations'] }) {
  return (
    <RelatedCard items={[]}>
      {integrations.length === 0 ? (
        <p className="text-muted-foreground px-6 py-5 text-[13px]">
          Not mirrored to any connected integration.
        </p>
      ) : (
        <ul className="divide-y">
          {integrations.map((integration) => (
            <li
              key={integration.providerType}
              className="flex items-center justify-between gap-3 px-6 py-3"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <IntegrationMark integration={integration} />
                <span className="truncate text-sm font-medium">{integration.name}</span>
              </span>
              {integration.providerEntityId ? (
                <CopyValue value={integration.providerEntityId} label={`${integration.name} ID`} />
              ) : (
                <span className="text-muted-foreground text-xs">No provider ID</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </RelatedCard>
  )
}

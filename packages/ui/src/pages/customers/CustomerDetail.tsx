import { useMemo, useState, type ReactElement, type ReactNode } from 'react'
import {
  ArchiveIcon,
  CreditCardIcon,
  InfoIcon,
  ExternalLinkIcon,
  ArrowUpDownIcon,
  EyeIcon,
  FilterIcon,
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
  CustomerStatus,
  CUSTOMER_TAX_TREATMENT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  type Invoice,
  InvoiceStatus,
  PAYMENT_STATUS_LABEL,
  type Payment,
  PaymentStatus,
  compareMoney,
  customerEmailSchema,
  EMAIL_CANNOT_CLEAR,
  formatMoney,
  isZeroMoney,
  SubscriptionStatus,
  type Subscription,
  type TenantFeatureUsage,
  RBAC_ENTITY,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { AccessProvider, AccessScope, WriteGate, useAccess } from '@ui/compositions/access/Access'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { ActivitySection, type ActivityLogEntry } from '@ui/compositions/detail/ActivityLog'
import {
  DetailTabs,
  OverviewTiles,
  SimpleTable,
  type DetailMenuItem,
  type SimpleColumn,
} from '@ui/compositions/detail/DetailKit'
import { Section } from '@ui/compositions/layout/Section'
import {
  FilterBar,
  readSelectFilter,
  selectFilterField,
  type FlatFilter,
} from '@ui/compositions/tables/FilterBar'
import { SortMenu } from '@ui/compositions/tables/SortMenu'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import { EditableCard } from '@ui/compositions/forms/EditableCard'
import { formatStoredDay } from '@ui/compositions/forms/DateInput'
import { RelatedCard } from '@ui/compositions/detail/RelatedCard'
import { MetadataCard } from '@ui/compositions/detail/MetadataCard'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import { SubTabState, truncationNote } from '@ui/compositions/detail/SubTabState'
import { Money } from '../shared/Money'
import { EntityHeader } from '../shared/EntityHeader'
import { provenance } from '@ui/provenance'
import { EmDash, EntityLink, Pill, Status, type PillTone } from '../shared/cells'
import { DetailTable } from '../shared/DetailTable'
import {
  EntitlementUsageTable,
  entitlementRowsFromUsage,
  type EntitlementUsageRow,
} from '../shared/EntitlementUsage'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import {
  ContractIntegrations,
  type ContractIntegrationsProps,
} from '../contracts/ContractIntegrations'
import { IntegrationMark, IntegrationMarks } from './IntegrationMark'
import { CopyValue } from '../shared/CopyValue'
import { statusTone } from '../shared/statusTones'

/**
 * A customer's detail page: an avatar-tile `EntityHeader` (name; on the right
 * the connected integration marks, "ID" and email copy chips, and a ⋯ menu
 * holding Create invoice, Edit and Top up)
 * over line `DetailTabs`; the active tab renders as reference-style sections. It is presentational: the page fetches and hands data in.
 *
 * It shows only what the API has. A customer record carries no plan or payment
 * method (only the currency it is billed in, on the Information tab), so the header does not invent them; sections with no read
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
  note: 'Customer detail: EntityHeader + DetailTabs; Overview from OverviewTiles, a Contracts table, an Entitlements usage table and the activity log, Information as single-pencil EditableCards. Lineage: ui/detail-kit, ui/section, ui/editable-card.',
})

/** How many invoices the customer page asks for; at this count the list may be cut. */
export const CUSTOMER_INVOICES_LIMIT = 200

export type CustomerTab =
  'overview' | 'invoices' | 'wallet' | 'usage' | 'activity' | 'events' | 'information'

export const CUSTOMER_TABS = [
  'overview',
  'invoices',
  'wallet',
  'usage',
  'activity',
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
  /** Adds "Add card" to the header menu: a connected payment provider can save one. */
  onAddCard?: () => void
  /** Adds "Open customer portal" to the header menu (V1's portal link). */
  onOpenPortal?: () => void
  /** Adds "Copy portal link" to the header menu. */
  onCopyPortalLink?: () => void
  /**
   * "Stream sample events" in the header menu: the backend generates a minute
   * of usage events for one live subscription. Omitted, the item stays in the
   * menu, disabled, with `streamEventsReason` under the label.
   */
  onStreamEvents?: () => void
  /** Why sample events cannot be streamed. Shown under the disabled menu item. */
  streamEventsReason?: string
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
   * The Invoices tab's row menu for one invoice: finalize, record payment,
   * void… The page decides which apply; a destructive one sits last, apart.
   */
  invoiceActions?: (invoice: Invoice) => InvoiceRowAction[]
  /** The "View all" beside Recent payments. Omitted, the button is not shown. */
  onViewAllPayments?: () => void
  onOpenPlan?: (planId: string) => void
  /** Open one contract's own page, from a Contracts row or a running-contract card. Omitted, rows are not links. */
  onOpenContract?: (subscriptionId: string) => void
  subscriptionsLoading?: boolean
  /** The contracts read failed: shown as such, never as "no contracts". */
  subscriptionsError?: boolean
  /** Refetch the contracts; the Contracts error panel offers it as Try again. */
  onRetrySubscriptions?: () => void
  invoicesLoading?: boolean
  /** The invoices read failed: shown as such, never as "no invoices" or a count of 0. */
  invoicesError?: boolean
  /** Refetch the invoices; the Invoices error panel offers it as Try again. */
  onRetryInvoices?: () => void
  /**
   * The customer's recent payments, newest first. Omitted, the Overview leaves
   * the Recent payments section out rather than claim there are none.
   */
  payments?: Payment[] | undefined
  paymentsLoading?: boolean | undefined
  /** The payments read failed: shown as such, never as "no payments". */
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
  /** The full audit trail (`CustomerActivityView`). Without it there is no Activity tab. */
  activityTab?: ReactNode
  /**
   * The Usage section's contents: the per-feature quota cards.
   *
   * A slot rather than a data prop because the quota read is a separate
   * endpoint (`GET /customers/usage`) with its own loading and failure states,
   * and this component does not fetch. Omitted, the section keeps the empty
   * state it has always had, so nothing about it changes for a caller that has
   * no quota data to hand.
   */
  usage?: ReactNode
  /**
   * The Overview's Entitlements section: each feature the customer is
   * entitled to, what grants it, and how much is used (`GET /customers/usage`).
   * Omitted, the section is not drawn; loaded and empty, it is not drawn
   * either: as in V1, a customer with no entitlements has nothing to show.
   */
  entitlements?: TenantFeatureUsage[] | undefined
  entitlementsLoading?: boolean | undefined
  entitlementsError?: boolean | undefined
  onRetryEntitlements?: (() => void) | undefined
  /** The Wallet section's contents; omitted, the empty state shows. */
  wallet?: ReactNode
  /** The Taxes section on the Information tab; omitted, it is not shown. */
  taxes?: ReactNode
  /** The FX overrides section on the Information tab, after Taxes; omitted, it is not shown. */
  fxOverrides?: ReactNode
  /** The entity issuing this customer's invoices, while entities are enabled; read-only, a link to the entity. */
  billingEntity?: { name: string; onOpen: () => void } | undefined
  locale?: string
}

/**
 * Dates on this page read by the same rule as the contract page
 * (`formatStoredDay`): a UTC day boundary is that UTC day, anything else the
 * reader's local day. So a contract's period reads the same day here and there.
 */
function useDateFormat(locale?: string) {
  return (date: Date | null) => (date ? formatStoredDay(date, { locale }) : '—')
}

type FormatDate = (date: Date | null) => string

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
)

/** Why nothing on an archived customer's page can be changed. */
const ARCHIVED_CUSTOMER_LOCK = 'You can only view their details; nothing here can be changed.'

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
  onAddCard,
  onOpenPortal,
  onCopyPortalLink,
  onStreamEvents,
  streamEventsReason,
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
  activityTab,
  usage,
  entitlements,
  entitlementsLoading = false,
  entitlementsError = false,
  onRetryEntitlements,
  wallet,
  taxes,
  fxOverrides,
  billingEntity,
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
    {
      id: 'stream-events',
      label: 'Stream sample events',
      icon: <RocketIcon className="text-muted-foreground" aria-hidden="true" />,
      onSelect: onStreamEvents ?? (() => undefined),
      disabled: !onStreamEvents,
      entity: RBAC_ENTITY.Event,
      ...(!onStreamEvents
        ? {
            description: streamEventsReason ?? 'Sample events are not available for this customer.',
          }
        : {}),
    },
    ...(onAddCard
      ? [
          {
            id: 'add-card',
            label: 'Add card',
            icon: <CreditCardIcon className="text-muted-foreground" aria-hidden="true" />,
            onSelect: onAddCard,
            entity: RBAC_ENTITY.Payment,
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

  const access = useAccess()
  const archived = customer.status === CustomerStatus.Archived

  const page = (
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
        {archived ? (
          <Alert variant="info">
            <InfoIcon aria-hidden="true" />
            <AlertTitle>This customer is archived</AlertTitle>
            <AlertDescription>{ARCHIVED_CUSTOMER_LOCK}</AlertDescription>
          </Alert>
        ) : null}
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
            ...(activityTab ? [{ value: 'activity', label: 'Activity' }] : []),
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
            entitlements={entitlements}
            entitlementsLoading={entitlementsLoading}
            entitlementsError={entitlementsError}
            onRetryEntitlements={onRetryEntitlements}
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
            {...(activityTab ? { onViewAllActivity: () => onTabChange('activity') } : {})}
            billingEntity={billingEntity}
          />
        ) : null}

        {tab === 'invoices' ? (
          // The invoices here write invoices, not the customer.
          <AccessScope entity={RBAC_ENTITY.Invoice}>
            <Section
              table
              title="Invoices"
              {...(onCreateInvoice
                ? {
                    action: (
                      <WriteGate>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3"
                          onClick={onCreateInvoice}
                        >
                          <PlusIcon aria-hidden="true" />
                          New invoice
                        </Button>
                      </WriteGate>
                    ),
                  }
                : {})}
            >
              <InvoiceTable
                invoices={invoices}
                isLoading={invoicesLoading}
                isError={invoicesError}
                onRetry={onRetryInvoices}
                formatDate={formatDate}
                onOpenInvoice={onOpenInvoice}
                {...(invoiceActions ? { actions: invoiceActions } : {})}
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

        {tab === 'activity'
          ? (activityTab ?? (
              <EmptyState
                scene="customers"
                title="Activity not available here"
                description="This view has no audit trail to show."
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
            fxOverrides={fxOverrides}
            integrationControls={integrationControls}
          />
        ) : null}
      </div>
    </div>
  )

  /*
   * An archived customer is read-only: the same lock a locked account uses,
   * scoped to this page, so every write control here (menus, inline edits,
   * section actions, the wallet and tax panels) is disabled with the reason,
   * and the strip above the tabs says so once.
   */
  return archived ? (
    <AccessProvider value={{ ...access, writeLock: ARCHIVED_CUSTOMER_LOCK }}>
      {/* A scope, so items that name no entity of their own are checked too. */}
      <AccessScope entity={RBAC_ENTITY.Customer}>{page}</AccessScope>
    </AccessProvider>
  ) : (
    page
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

interface SortKey<T> {
  key: string
  label: string
  value: (row: T) => string | number
}

/** Filter and sort for a section table, sitting in the header beside the action. */
function TableTools<T>({
  rows,
  sorts,
  facet,
  action,
  children,
}: {
  rows: T[]
  sorts: SortKey<T>[]
  facet?: { label: string; value: (row: T) => string }
  action?: ReactNode
  children: (rows: T[], controls: ReactNode) => ReactNode
}) {
  const [field, setField] = useState(sorts[0]?.key ?? '')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [sorted, setSorted] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const choices = useMemo(() => {
    if (!facet) return []
    return [...new Set(rows.map(facet.value).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [rows, facet])
  const visible = useMemo(() => {
    const allowed = new Set(selected)
    const filtered =
      facet && selected.length > 0 ? rows.filter((row) => allowed.has(facet.value(row))) : rows
    if (!sorted) return filtered
    const sort = sorts.find((item) => item.key === field)
    if (!sort) return filtered
    return [...filtered].sort((a, b) => {
      const left = sort.value(a)
      const right = sort.value(b)
      const order =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right))
      return direction === 'asc' ? order : -order
    })
  }, [rows, facet, selected, sorted, sorts, field, direction])
  const query = useMemo(
    () =>
      facet && selected.length > 0
        ? createFilterQuery([
            createFilterRule({
              id: 'facet',
              path: ['facet'],
              operator: 'is_any_of',
              value: selected,
            }),
          ])
        : createFilterQuery(),
    [facet, selected],
  )

  const controls = (
    <>
      {facet && choices.length > 0 ? (
        <FilterBar
          variant="advanced"
          advancedAlign="end"
          fields={[
            selectFilterField(
              'facet',
              facet.label,
              choices.map((choice) => ({ value: choice, label: choice })),
            ),
          ]}
          query={query}
          onQueryChange={(_query, flat: FlatFilter[]) => {
            setSelected(readSelectFilter(flat, 'facet', new Set(choices)))
          }}
          trigger={
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative size-8"
              aria-label={selected.length > 0 ? `Filter. ${selected.length} active` : 'Filter'}
            >
              <FilterIcon aria-hidden />
            </Button>
          }
        />
      ) : null}
      {sorts.length > 0 && rows.length > 0 ? (
        <SortMenu
          align="end"
          options={sorts.map((item) => ({ value: item.key, label: item.label }))}
          field={field}
          direction={direction}
          onChange={(next, nextDirection) => {
            setField(next)
            setDirection(nextDirection)
            setSorted(true)
          }}
          trigger={
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Sort"
            >
              <ArrowUpDownIcon aria-hidden />
            </Button>
          }
        />
      ) : null}
      {action}
    </>
  )

  return children(visible, controls)
}

function EntitlementsBlock({
  rows,
  locale,
  isLoading,
  isError,
  onRetry,
  hasData,
}: {
  rows: EntitlementUsageRow[]
  locale: string | undefined
  isLoading: boolean
  isError: boolean
  onRetry: (() => void) | undefined
  hasData: boolean
}) {
  return (
    <Section flush title="Entitlements">
      <SubTabState
        hasData={hasData}
        isLoading={isLoading}
        error={isError ? "Entitlements couldn't be loaded" : null}
        onRetry={onRetry}
        columns={4}
        loadingLabel="Loading entitlements"
        empty={{
          scene: 'customers',
          title: 'No entitlements yet',
          description: 'Features appear here once this customer is on a plan that grants one.',
        }}
      >
        <EntitlementUsageTable rows={rows} locale={locale} />
      </SubTabState>
    </Section>
  )
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
  entitlements,
  entitlementsLoading,
  entitlementsError,
  onRetryEntitlements,
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
  onViewAllActivity,
  billingEntity,
}: {
  customer: CustomerDetailModel
  subscriptions: Subscription[]
  subscriptionsLoading: boolean
  subscriptionsError: boolean
  onRetrySubscriptions: (() => void) | undefined
  onOpenPlan: ((planId: string) => void) | undefined
  onOpenContract: ((subscriptionId: string) => void) | undefined
  onCreateContract: (() => void) | undefined
  entitlements: TenantFeatureUsage[] | undefined
  entitlementsLoading: boolean
  entitlementsError: boolean
  onRetryEntitlements: (() => void) | undefined
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
  /** Opens the Activity tab; omitted when there is none. */
  onViewAllActivity?: (() => void) | undefined
  billingEntity: CustomerDetailProps['billingEntity']
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
                  ? `Current period of ${nextBilling.planName} ends`
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
        {entitlements && (entitlementsLoading || entitlementsError || entitlements.length > 0) ? (
          <EntitlementsBlock
            rows={entitlementRowsFromUsage(entitlements, (source) => {
              if (source.entityType === 'plan' && source.entityId && onOpenPlan)
                return () => onOpenPlan(source.entityId)
              if (source.subscriptionId && onOpenContract)
                return () => onOpenContract(source.subscriptionId)
              return undefined
            })}
            locale={locale}
            isLoading={entitlementsLoading}
            isError={entitlementsError}
            onRetry={onRetryEntitlements}
            hasData={entitlements.length > 0}
          />
        ) : null}
        <TableTools
          rows={invoices.slice(0, 5)}
          facet={{ label: 'Payment', value: (invoice) => invoicePayment(invoice).label }}
          sorts={invoiceSorts}
          action={<ViewAllButton label="invoices" onClick={onViewAllInvoices} />}
        >
          {(rows, controls) => (
            <Section flush title="Recent invoices" action={controls}>
              <InvoiceTable
                compactList
                invoices={invoices.slice(0, 5)}
                shown={rows}
                isLoading={invoicesLoading}
                isError={invoicesError}
                onRetry={onRetryInvoices}
                formatDate={formatDate}
                onOpenInvoice={onOpenInvoice}
              />
            </Section>
          )}
        </TableTools>
        {payments ? (
          <TableTools
            rows={payments.slice(0, 5)}
            facet={{ label: 'Status', value: (payment) => PAYMENT_STATUS_LABEL[payment.status] }}
            sorts={[
              {
                key: 'invoice',
                label: 'Invoice number',
                value: (payment) => payment.invoiceNumber,
              },
              { key: 'amount', label: 'Amount', value: (payment) => Number(payment.amount.amount) },
              { key: 'method', label: 'Payment method', value: (payment) => payment.methodType },
              {
                key: 'status',
                label: 'Status',
                value: (payment) => PAYMENT_STATUS_LABEL[payment.status],
              },
              {
                key: 'date',
                label: 'Date',
                value: (payment) => Number(new Date(payment.createdAt ?? 0)),
              },
            ]}
            {...(onViewAllPayments
              ? { action: <ViewAllButton label="payments" onClick={onViewAllPayments} /> }
              : {})}
          >
            {(rows, controls) => (
              <Section flush title="Recent payments" action={controls}>
                <PaymentTable
                  payments={payments.slice(0, 5)}
                  shown={rows}
                  isLoading={paymentsLoading}
                  isError={paymentsError}
                  onRetry={onRetryPayments}
                  formatDate={formatDate}
                />
              </Section>
            )}
          </TableTools>
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
          {...(onViewAllActivity ? { onViewAll: onViewAllActivity } : {})}
        />
        <RelatedCard
          items={[
            ...(billingEntity
              ? [
                  {
                    id: 'billing-entity',
                    label: 'Billing entity',
                    value: billingEntity.name,
                    onOpen: billingEntity.onOpen,
                  },
                ]
              : []),
            ...(lastInvoice && onOpenInvoice
              ? [
                  {
                    id: 'latest-invoice',
                    label: 'Latest invoice',
                    value: lastInvoice.number,
                    copyValue: lastInvoice.id,
                    onOpen: () => onOpenInvoice(lastInvoice.id),
                  },
                ]
              : []),
            ...(invoicesKnown && invoices.length > 0
              ? [
                  {
                    id: 'invoices',
                    label: 'Invoices',
                    value: `${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'}`,
                    onOpen: onViewAllInvoices,
                  },
                ]
              : []),
          ]}
        />
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
  shown,
  isLoading,
  isError,
  onRetry,
  formatDate,
}: {
  payments: Payment[]
  /** Filtered or sorted slice. The empty state still follows `payments`. */
  shown?: Payment[]
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
      <SimpleTable
        rows={shown ?? payments}
        columns={[
          { key: 'receipt', header: 'Receipt number', cell: () => <Muted>—</Muted> },
          {
            key: 'invoice',
            header: 'Invoice number',
            cell: (payment) => (payment.invoiceNumber ? payment.invoiceNumber : <Muted>—</Muted>),
          },
          { key: 'amount', header: 'Amount', cell: (payment) => <Money value={payment.amount} /> },
          {
            key: 'method',
            header: 'Payment method',
            cell: (payment) =>
              payment.methodType ? paymentMethod(payment.methodType) : <Muted>—</Muted>,
          },
          {
            key: 'status',
            header: 'Status',
            cell: (payment) => <Status value={PAYMENT_STATUS_LABEL[payment.status]} />,
          },
          {
            key: 'date',
            header: 'Date',
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
  const create = onCreateContract ? (
    <WriteGate entity={RBAC_ENTITY.Subscription}>
      <Button variant="outline" size="sm" className="h-8 px-3" onClick={onCreateContract}>
        <PlusIcon aria-hidden="true" />
        Create contract
      </Button>
    </WriteGate>
  ) : null

  return (
    <TableTools
      rows={subscriptions}
      facet={{ label: 'Status', value: (s) => SUBSCRIPTION_STATUS_LABEL[s.status] }}
      sorts={[
        { key: 'contract', label: 'Contract', value: (s) => s.id },
        { key: 'plan', label: 'Plan', value: (s) => s.planName },
        { key: 'status', label: 'Status', value: (s) => SUBSCRIPTION_STATUS_LABEL[s.status] },
        { key: 'billing', label: 'Billing', value: (s) => s.billingPeriodLabel },
        {
          key: 'period',
          label: 'Current period',
          value: (s) => Number(new Date(s.currentPeriodStart ?? 0)),
        },
      ]}
      {...(create ? { action: create } : {})}
    >
      {(rows, controls) => (
        <Section flush title="Contracts" bare={!showTitle} action={controls}>
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
              description:
                'A contract puts this customer on a plan. Create one to start billing them.',
            }}
          >
            <SimpleTable
              rows={rows}
              getRowId={(s) => s.id}
              {...(onOpenContract ? { onRowClick: (s: Subscription) => onOpenContract(s.id) } : {})}
              columns={contractColumns(formatDate, onOpenPlan, onOpenContract)}
            />
          </SubTabState>
        </Section>
      )}
    </TableTools>
  )
}

function contractColumns(
  formatDate: FormatDate,
  onOpenPlan: ((planId: string) => void) | undefined,
  onOpenContract: ((subscriptionId: string) => void) | undefined,
): SimpleColumn<Subscription>[] {
  return [
    {
      key: 'contract',
      header: 'Contract',
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
      cell: (s) => <Status value={SUBSCRIPTION_STATUS_LABEL[s.status]} />,
    },
    {
      key: 'billing',
      header: 'Billing',
      cell: (s) => <Muted>{s.billingPeriodLabel}</Muted>,
    },
    {
      key: 'period',
      header: 'Current period',
      cell: (s) => (
        <Muted>
          {s.currentPeriodStart && s.currentPeriodEnd
            ? `${formatDate(s.currentPeriodStart)} – ${formatDate(s.currentPeriodEnd)}`
            : '—'}
        </Muted>
      ),
    },
  ]
}

/** One item of an invoice row's menu. */
export interface InvoiceRowAction {
  label: string
  onSelect: () => void
  /** Leading glyph, required so every item lines up behind one. */
  icon: ReactElement
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
  if (invoice.status === InvoiceStatus.Paid) return { label: 'Paid', tone: statusTone('Paid') }
  if (invoice.status === InvoiceStatus.Void) return { label: 'Void', tone: statusTone('Void') }
  if (invoice.status === InvoiceStatus.Skipped)
    return { label: 'Skipped', tone: statusTone('Skipped') }
  if (invoice.status === InvoiceStatus.Overdue)
    return { label: 'Overdue', tone: statusTone('Overdue') }
  const partial =
    !isZeroMoney(invoice.amountRemaining) &&
    compareMoney(invoice.amountRemaining, invoice.amountDue) < 0
  if (partial) return { label: 'Partially Paid', tone: statusTone('Partially Paid') }
  if (invoice.paymentStatus === PaymentStatus.Failed)
    return { label: 'Failed', tone: statusTone('Failed') }
  if (invoice.paymentStatus === PaymentStatus.Succeeded)
    return { label: 'Paid', tone: statusTone('Paid') }
  return { label: 'Pending', tone: statusTone('Pending') }
}

const invoiceSorts: SortKey<Invoice>[] = [
  { key: 'number', label: 'Invoice number', value: (invoice) => invoice.number },
  {
    key: 'issued',
    label: 'Issue date',
    value: (invoice) => Number(new Date(invoice.issuedAt ?? 0)),
  },
  { key: 'due', label: 'Due date', value: (invoice) => Number(new Date(invoice.dueDate ?? 0)) },
  { key: 'status', label: 'Status', value: (invoice) => invoiceDocument(invoice) },
  { key: 'payment', label: 'Payment', value: (invoice) => invoicePayment(invoice).label },
  { key: 'total', label: 'Amount', value: (invoice) => Number(invoice.total.amount) },
]

function invoiceColumns(
  formatDate: FormatDate,
  onOpenInvoice: ((invoiceId: string) => void) | undefined,
): SimpleColumn<Invoice>[] {
  return [
    {
      key: 'number',
      header: 'Invoice number',
      cell: (invoice) =>
        invoice.number ? (
          onOpenInvoice ? (
            <span className="font-mono text-xs">
              <EntityLink label={invoice.number} onOpen={() => onOpenInvoice(invoice.id)} />
            </span>
          ) : (
            <span className="font-mono text-xs">{invoice.number}</span>
          )
        ) : (
          <EmDash />
        ),
    },
    {
      key: 'issued',
      header: 'Issue date',
      cell: (invoice) => <Muted>{formatDate(invoice.issuedAt)}</Muted>,
    },
    {
      key: 'due',
      header: 'Due date',
      cell: (invoice) => <Muted>{formatDate(invoice.dueDate)}</Muted>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (invoice) => <Status value={invoiceDocument(invoice)} />,
    },
    {
      key: 'payment',
      header: 'Payment',
      cell: (invoice) => {
        const payment = invoicePayment(invoice)
        return <Pill tone={payment.tone}>{payment.label}</Pill>
      },
    },
    {
      key: 'total',
      header: 'Amount',
      cell: (invoice) => <Money value={invoice.total} />,
    },
  ]
}

/** The invoices table, edge to edge inside a flush section. */
function InvoiceTable({
  compactList = false,
  invoices,
  shown,
  isLoading,
  isError,
  onRetry,
  formatDate,
  onOpenInvoice,
  actions,
}: {
  /** The short list on the Overview: no toolbar. */
  compactList?: boolean
  invoices: Invoice[]
  /** Filtered or sorted slice. The empty state still follows `invoices`. */
  shown?: Invoice[]
  isLoading: boolean
  isError: boolean
  onRetry: (() => void) | undefined
  formatDate: FormatDate
  onOpenInvoice: ((invoiceId: string) => void) | undefined
  /** Each row's menu; omitted, rows have none. */
  actions?: (invoice: Invoice) => InvoiceRowAction[]
}) {
  // Rows win; otherwise a failed read is an error with retry, a pending one a
  // skeleton, and only a finished empty read says "no invoices".
  if (invoices.length === 0) {
    return (
      <div>
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
          }}
        >
          {null}
        </SubTabState>
      </div>
    )
  }
  const capped = compactList ? null : truncationNote(invoices.length, CUSTOMER_INVOICES_LIMIT)
  if (compactList) {
    return (
      <SimpleTable
        rows={shown ?? invoices}
        {...(onOpenInvoice ? { onRowClick: (invoice: Invoice) => onOpenInvoice(invoice.id) } : {})}
        columns={invoiceColumns(formatDate, onOpenInvoice)}
      />
    )
  }
  return (
    <>
      <DetailTable
        compact
        label="Invoices"
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
                            ? {
                                onRemove: removal.onSelect,
                                removeLabel: removal.label,
                                removeIcon: removal.icon,
                              }
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

function InformationTab({
  customer,
  formatDate,
  onUpdateField,
  onUpdateMetadata,
  onEdit,
  taxes,
  fxOverrides,
  integrationControls,
}: {
  customer: CustomerDetailModel
  formatDate: FormatDate
  onUpdateField: CustomerDetailProps['onUpdateField']
  onUpdateMetadata: CustomerDetailProps['onUpdateMetadata']
  onEdit: (() => void) | undefined
  taxes: ReactNode
  fxOverrides: ReactNode
  integrationControls: CustomerDetailProps['integrationControls']
}) {
  const street = [customer.addressLine1, customer.addressLine2].filter(Boolean).join(', ')

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="flex flex-col gap-5 xl:col-span-2">
        <EditableCard
          title="Customer details"
          locked={!onUpdateField}
          fields={[
            // The external ID and customer ID live in the header, copyable on every tab;
            // they are not repeated here.
            { key: 'name', label: 'Name', value: customer.name, required: true },
            {
              key: 'email',
              label: 'Email',
              value: customer.email,
              placeholder: 'No email',
              validate: (next) =>
                customer.email && !next.trim()
                  ? EMAIL_CANNOT_CLEAR
                  : (customerEmailSchema.safeParse(next).error?.issues[0]?.message ?? null),
            },
            {
              key: 'phone',
              label: 'Phone',
              value: customer.phone,
              placeholder: 'No phone',
            },
            {
              key: 'created',
              label: 'Created',
              value: formatDate(customer.createdAt),
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
            {
              key: 'billingCurrency',
              label: 'Billing currency',
              // Blank means invoices follow each contract's currency, which is a value, not a gap.
              value: customer.billingCurrency
                ? customer.billingCurrency.toUpperCase()
                : "Contract's currency",
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
        {fxOverrides}
      </div>

      <div className="flex flex-col gap-5">
        <MetadataCard
          description="Your own key/value fields, returned with this record in the API"
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

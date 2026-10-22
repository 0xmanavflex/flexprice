import type { IntegrationLink } from '@fp/domain'
import {
  ContractIntegrations,
  type ContractIntegrationsProps,
} from '../../contracts/ContractIntegrations'
import { useState, type ReactNode } from 'react'
import {
  CalculatorIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileMinusIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ReceiptIcon,
  RefreshCwIcon,
  SendIcon,
  WalletIcon,
  XCircleIcon,
} from '@ui/icons'
import { toast } from 'sonner'
import { InvoiceStatus, PaymentStatus } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Badge } from '@ui/components/reui/badge'
import { provenance } from '@ui/provenance'
import { DetailShell } from '../../../compositions/detail/DetailShell'
import { ActivitySection } from '../../../compositions/detail/ActivityLog'
import { DetailTabs, TotalRow, TotalsList } from '../../../compositions/detail/DetailKit'
import { MetadataCard } from '../../../compositions/detail/MetadataCard'
import { RelatedCard, type RelatedItem } from '../../../compositions/detail/RelatedCard'
import { Section } from '../../../compositions/layout/Section'
import {
  SubTabState,
  knownCount,
  truncationNote,
  type SubTabQuery,
} from '../../../compositions/detail/SubTabState'
import { Spinner } from '@ui/components/primitives/spinner'
import { DetailTable } from '../../shared/DetailTable'
import { Pill, Status } from '../../shared/cells'
import {
  invoiceTotals,
  statusChips,
  type InvoiceCreditNoteRow,
  type InvoiceDocument,
  type InvoiceLine,
  type InvoiceParty,
  type InvoicePaymentRow,
} from './invoiceDocument'

export const InvoiceDetailViewProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/DetailShell',
    'compositions/MetadataCard',
    'compositions/RelatedCard',
    'compositions/ActivityLog',
    'compositions/SubTabState',
    'compositions/detail-kit',
    'ui/spinner',
    '@reui/badge',
  ],
  note: 'Invoice detail: DetailShell header (status chips, ID, More), Invoice details (the document and an Activity, Metadata, Related rail), Payments and Credit memos tabs. Entity-specific integration controls share header and Related mappings, following the supplied HTML reference.',
})

export interface InvoiceDetailViewProps {
  integrationControls?: ContractIntegrationsProps | undefined
  integrationLinks?: IntegrationLink[] | undefined
  integrationsError?: boolean
  onRetryIntegrations?: () => void
  invoice: InvoiceDocument
  onBack?: () => void
  /** Drafts only: open the edit page. */
  onEdit?: () => void
  /** Drafts only. */
  onFinalize?: () => void
  isFinalizing?: boolean
  /** More menu: Download PDF. Omitted, the item is disabled. */
  onDownload?: () => void
  onRecordPayment?: () => void
  /** Drafts only: recompute lines, credits and taxes in place. */
  onRecalculate?: () => void
  onVoid?: () => void
  /** Set the payment status by hand, for money that moved outside Flexprice. */
  onUpdatePaymentStatus?: () => void
  /**
   * Why the payment status cannot be set by hand right now (void, payments
   * recorded…) — `manualPaymentStatusBlocked`. Shown as the disabled item's hint.
   */
  paymentStatusBlocked?: string | null
  /** Saves the invoice's metadata map. Omitted, the metadata card is read-only. */
  onSaveMetadata?: (metadata: Record<string, string>) => Promise<unknown>
  onIssueCreditNote?: () => void
  /** Finalized invoices: send the invoice to the customer. */
  onSend?: () => void
  onRetryPayment?: () => void
  onOpenCustomer?: () => void
  onOpenSubscription?: () => void
  onOpenPayment?: (paymentId: string) => void
  onOpenCreditNote?: (creditNoteId: string) => void
  /** Payments sub-query. Omitted: treated as loaded. */
  payments?: SubTabQuery
  /** Credit memos sub-query. Omitted: treated as loaded. */
  creditNotes?: SubTabQuery
  /**
   * The action in flight, if any. Its menu item and button disable and say what
   * is happening ("Sending…"), so a second press has nothing to land on.
   */
  pendingAction?: InvoicePendingAction | null
}

export type InvoicePendingAction = 'finalize' | 'recalculate' | 'send' | 'retry-payment'

/** The most the payments and credit-note reads ask for; at the cap the list may be cut. */
const SUB_LIST_LIMIT = 100

const optionalCount = (count: number | undefined): { count?: number } =>
  count === undefined ? {} : { count }

type InvoiceTab = 'details' | 'payments' | 'credit-notes'

/**
 * One invoice (reference `invoice-detail`). The header is the plain word
 * "Invoice" with the status pills under it, the ID chip and one More menu on the right; every
 * action, Download PDF and Copy link included, lives in that menu. Tabs sit under
 * the header: Invoice details (the invoice as a document, with the Activity,
 * Metadata, Related rail beside it), Payments and Credit memos.
 */
export function InvoiceDetailView({
  integrationLinks,
  integrationControls,
  integrationsError,
  onRetryIntegrations,
  invoice,
  onBack,
  onEdit,
  onFinalize,
  isFinalizing = false,
  onDownload,
  onRecordPayment,
  onRecalculate,
  onVoid,
  onUpdatePaymentStatus,
  paymentStatusBlocked = null,
  onSaveMetadata,
  onIssueCreditNote,
  onSend,
  onRetryPayment,
  onOpenCustomer,
  onOpenSubscription,
  onOpenPayment,
  onOpenCreditNote,
  payments: paymentsQuery = { isLoading: false },
  creditNotes: creditNotesQuery = { isLoading: false },
  pendingAction = null,
}: InvoiceDetailViewProps) {
  const [tab, setTab] = useState<InvoiceTab>('details')
  const totals = invoiceTotals(invoice)
  const money = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currencyDisplay: 'narrowSymbol',
      currency: invoice.currency,
    }).format(value)
  const unitMoney = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currencyDisplay: 'narrowSymbol',
      currency: invoice.currency,
      maximumFractionDigits: 6,
    }).format(value)
  const isDraft = invoice.status === InvoiceStatus.Draft
  const isOpen = invoice.status === InvoiceStatus.Open || invoice.status === InvoiceStatus.Overdue
  const paymentFailed = isOpen && invoice.paymentStatus === PaymentStatus.Failed
  const lines = invoice.lines.filter((line) => line.amount !== 0)
  const canRecordPayment = isOpen && totals.due > 0
  const canIssueCreditNote = !isDraft && invoice.status !== InvoiceStatus.Void
  const liveCreditNotes = invoice.creditNotes.filter(
    (note) => (note.status ?? '').toUpperCase() !== 'VOIDED',
  ).length
  const hostedUrl = invoice.hostedUrl ?? null

  const copyLink = async () => {
    if (!hostedUrl) return
    try {
      await navigator.clipboard.writeText(hostedUrl)
      toast.success('Hosted invoice link copied', {
        description: 'Anyone with the link can view and pay this invoice until it expires.',
      })
    } catch {
      toast.error('Couldn’t copy the link', {
        description: 'Your browser blocked clipboard access.',
      })
    }
  }

  const related: RelatedItem[] = [
    {
      id: 'customer',
      label: 'Customer',
      value: invoice.billTo.name,
      ...(onOpenCustomer ? { onOpen: onOpenCustomer } : {}),
    },
    {
      id: 'subscription',
      label: 'Subscription',
      value: invoice.subscriptionLabel,
      ...(onOpenSubscription && invoice.subscriptionId ? { onOpen: onOpenSubscription } : {}),
    },
    ...(hostedUrl
      ? [{ id: 'payment-link', label: 'Payment link', value: 'Hosted invoice', href: hostedUrl }]
      : []),
  ]

  return (
    <DetailShell
      trail={[
        { label: 'Invoices', ...(onBack ? { onClick: onBack } : {}) },
        { label: 'Invoice details' },
      ]}
      icon={<ReceiptIcon />}
      title="Invoice"
      id={invoice.id}
      leading={
        integrationControls ? (
          <ContractIntegrations {...integrationControls} entityLabel="invoice" showLink={false} />
        ) : integrationLinks?.length ? (
          <ContractIntegrations links={integrationLinks} linkable={[]} entityLabel="invoice" />
        ) : undefined
      }
      badges={[
        ...statusChips(invoice).map((chip) => (
          <Pill key={chip.label} tone={chip.tone}>
            {chip.label}
          </Pill>
        )),
        // A credit memo changes what is owed, so it is visible from the header
        // and leads to the memos rather than waiting for someone to look there.
        ...(liveCreditNotes > 0
          ? [
              <button
                key="credit-notes"
                type="button"
                onClick={() => setTab('credit-notes')}
                aria-label={`${liveCreditNotes} credit memo${liveCreditNotes === 1 ? '' : 's'} issued. Show credit memos`}
                className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-3"
              >
                <Pill tone="info">
                  {liveCreditNotes === 1 ? 'Credit memo' : `${liveCreditNotes} credit memos`}
                </Pill>
              </button>,
            ]
          : []),
      ]}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon" className="size-8" aria-label="More actions" />
            }
          >
            <MoreHorizontalIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <MenuAction
                icon={<DownloadIcon />}
                label="Download PDF"
                onSelect={onDownload}
                hint="Available once the invoice has a PDF"
              />
              <MenuAction
                icon={<LinkIcon />}
                label="Copy hosted invoice link"
                onSelect={hostedUrl ? () => void copyLink() : undefined}
                hint="Available once the invoice is finalized"
              />
              {isDraft && onFinalize ? (
                <MenuAction
                  icon={<CheckCircle2Icon />}
                  label="Finalize invoice"
                  disabled={isFinalizing || pendingAction === 'finalize'}
                  pending={isFinalizing || pendingAction === 'finalize'}
                  pendingLabel="Finalizing…"
                  onSelect={onFinalize}
                />
              ) : null}
              {onEdit &&
              invoice.status !== InvoiceStatus.Void &&
              invoice.status !== InvoiceStatus.Skipped ? (
                <MenuAction icon={<PencilIcon />} label="Edit invoice" onSelect={onEdit} />
              ) : null}
              <MenuAction
                icon={<WalletIcon />}
                label="Record payment"
                onSelect={onRecordPayment}
                disabled={!canRecordPayment}
                hint={!isOpen ? 'Finalized, unpaid invoices only' : undefined}
              />
              {paymentFailed && onRetryPayment ? (
                <MenuAction
                  icon={<RefreshCwIcon />}
                  label="Retry payment"
                  disabled={pendingAction === 'retry-payment'}
                  pending={pendingAction === 'retry-payment'}
                  pendingLabel="Retrying…"
                  onSelect={onRetryPayment}
                />
              ) : null}
              <MenuAction
                icon={<CalculatorIcon />}
                label="Recalculate"
                onSelect={onRecalculate}
                disabled={!isDraft || pendingAction === 'recalculate'}
                pending={pendingAction === 'recalculate'}
                pendingLabel="Recalculating…"
                hint={isDraft ? undefined : 'Drafts only'}
              />
              <MenuAction
                icon={<FileMinusIcon />}
                label="Issue credit memo"
                onSelect={onIssueCreditNote}
                disabled={!canIssueCreditNote}
                hint={isDraft ? 'Finalize the invoice first' : undefined}
              />
              {onUpdatePaymentStatus ? (
                <MenuAction
                  icon={<WalletIcon />}
                  label="Update payment status"
                  onSelect={onUpdatePaymentStatus}
                  disabled={paymentStatusBlocked !== null}
                  hint={paymentStatusBlocked ?? undefined}
                />
              ) : null}
              <MenuAction
                icon={<SendIcon />}
                label="Send invoice"
                onSelect={onSend}
                disabled={
                  isDraft || invoice.status === InvoiceStatus.Void || pendingAction === 'send'
                }
                pending={pendingAction === 'send'}
                pendingLabel="Sending…"
                hint={isDraft ? 'Finalize the invoice first' : undefined}
              />
            </DropdownMenuGroup>
            {isOpen && onVoid ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onVoid}>
                  <XCircleIcon aria-hidden="true" />
                  Void invoice
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="flex min-w-0 flex-col gap-6">
        <DetailTabs
          value={tab}
          onChange={(next) => setTab(next as InvoiceTab)}
          tabs={[
            { value: 'details', label: 'Invoice details' },
            {
              value: 'payments',
              label: 'Payments',
              ...optionalCount(knownCount(invoice.payments.length, paymentsQuery)),
            },
            {
              value: 'credit-notes',
              label: 'Credit memos',
              ...optionalCount(knownCount(invoice.creditNotes.length, creditNotesQuery)),
            },
          ]}
        />

        {tab === 'details' ? (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <InvoiceDocumentArticle
              invoice={invoice}
              lines={lines}
              money={money}
              unitMoney={unitMoney}
              totals={totals}
              paymentFailed={paymentFailed}
              isDraft={isDraft}
              retryPending={pendingAction === 'retry-payment'}
              {...(onRetryPayment ? { onRetryPayment } : {})}
            />
            <div className="flex flex-col gap-5 xl:sticky xl:top-6">
              <ActivitySection
                entries={invoice.events.map((event) => ({
                  id: event.id,
                  title: event.title,
                  at: event.at,
                  summary: event.summary,
                  ...(event.record ? { record: event.record } : {}),
                  ...(event.by ? { by: event.by } : {}),
                  ...(event.href ? { href: event.href } : {}),
                }))}
                emptyText={invoice.activityEmptyText ?? 'No dates recorded yet.'}
                awaiting={invoice.activityAwaiting ?? false}
              />
              <MetadataCard
                metadata={invoice.metadata ?? {}}
                {...(onSaveMetadata ? { onSave: onSaveMetadata } : {})}
              />
              <RelatedCard items={related}>
                {integrationControls ? (
                  <ContractIntegrations
                    {...integrationControls}
                    entityLabel="invoice"
                    layout="rows"
                  />
                ) : integrationLinks?.length ? (
                  <ContractIntegrations
                    layout="rows"
                    links={integrationLinks}
                    linkable={[]}
                    entityLabel="invoice"
                  />
                ) : integrationsError ? (
                  <button
                    type="button"
                    className="px-6 py-3 text-sm underline"
                    onClick={onRetryIntegrations}
                  >
                    Retry integrations
                  </button>
                ) : null}
              </RelatedCard>
            </div>
          </div>
        ) : null}

        {tab === 'payments' ? (
          <Section
            table
            title="Payments"
            {...(onRecordPayment && canRecordPayment
              ? {
                  action: (
                    <Button size="sm" className="h-8 px-3" onClick={onRecordPayment}>
                      Record payment
                    </Button>
                  ),
                }
              : {})}
          >
            <SubTabState
              hasData={invoice.payments.length > 0}
              isLoading={paymentsQuery.isLoading}
              error={paymentsQuery.error}
              errorKind={paymentsQuery.errorKind}
              retryAfterMs={paymentsQuery.retryAfterMs}
              onRetry={paymentsQuery.onRetry}
              isRetrying={paymentsQuery.isRetrying}
              truncation={truncationNote(invoice.payments.length, SUB_LIST_LIMIT)}
              loadingLabel="Loading payments"
              columns={[{ width: '2fr' }, { kind: 'money' }, { kind: 'short' }, { kind: 'badge' }]}
              empty={{
                scene: 'billing',
                title: 'No payments yet',
                description: 'No payments recorded for this invoice yet.',
              }}
            >
              <DetailTable<InvoicePaymentRow>
                compact
                label="Payments"
                noun="payments"
                rows={invoice.payments}
                {...(onOpenPayment ? { onRowClick: (row) => onOpenPayment(row.id) } : {})}
                columns={[
                  {
                    key: 'id',
                    header: 'Payment ID',
                    cell: (row) => <span className="font-mono text-xs">{row.id}</span>,
                  },
                  {
                    key: 'invoice',
                    header: 'Invoice number',
                    text: () => invoice.number ?? '',
                    cell: () =>
                      invoice.number ? (
                        <span className="font-mono text-xs">{invoice.number}</span>
                      ) : (
                        '—'
                      ),
                  },
                  {
                    key: 'amount',
                    header: 'Amount',
                    cell: (row) => <span className="tabular-nums">{money(row.amount)}</span>,
                  },
                  { key: 'method', header: 'Payment method', cell: (row) => row.method || '—' },
                  {
                    key: 'status',
                    header: 'Status',
                    cell: (row) => <Status value={row.status} />,
                  },
                ]}
              />
            </SubTabState>
          </Section>
        ) : null}

        {tab === 'credit-notes' ? (
          <Section
            table
            title="Credit memos"
            {...(onIssueCreditNote && canIssueCreditNote
              ? {
                  action: (
                    <Button size="sm" className="h-8 px-3" onClick={onIssueCreditNote}>
                      Issue credit memo
                    </Button>
                  ),
                }
              : {})}
          >
            <SubTabState
              hasData={invoice.creditNotes.length > 0}
              isLoading={creditNotesQuery.isLoading}
              error={creditNotesQuery.error}
              errorKind={creditNotesQuery.errorKind}
              retryAfterMs={creditNotesQuery.retryAfterMs}
              onRetry={creditNotesQuery.onRetry}
              isRetrying={creditNotesQuery.isRetrying}
              truncation={truncationNote(invoice.creditNotes.length, SUB_LIST_LIMIT)}
              loadingLabel="Loading credit memos"
              columns={[{ width: '2fr' }, { kind: 'money' }, { kind: 'short' }, { kind: 'badge' }]}
              empty={{
                scene: 'billing',
                title: 'No credit memos yet',
                description: 'No credit memos issued against this invoice.',
              }}
            >
              <DetailTable<InvoiceCreditNoteRow>
                compact
                label="Credit memos"
                noun="credit memos"
                rows={invoice.creditNotes}
                {...(onOpenCreditNote ? { onRowClick: (row) => onOpenCreditNote(row.id) } : {})}
                columns={[
                  {
                    key: 'number',
                    header: 'Credit memo',
                    cell: (row) => <span className="font-mono text-xs">{row.number}</span>,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    cell: (row) => (row.status ? <Status value={row.status} /> : '—'),
                  },
                  {
                    key: 'date',
                    header: 'Date',
                    cell: (row) => <span className="text-muted-foreground">{row.date}</span>,
                  },
                  {
                    key: 'amount',
                    header: 'Amount',
                    cell: (row) => <span className="tabular-nums">{money(row.amount)}</span>,
                  },
                ]}
              />
            </SubTabState>
          </Section>
        ) : null}
      </div>
    </DetailShell>
  )
}

/** A More-menu item, with an optional reason line when it is unavailable. */
function MenuAction({
  icon,
  label,
  onSelect,
  disabled = false,
  hint,
  pending = false,
  pendingLabel,
}: {
  icon: ReactNode
  label: string
  onSelect: (() => void) | undefined
  disabled?: boolean
  hint?: string | undefined
  /** The action is running: spinner, `pendingLabel`, not selectable. */
  pending?: boolean
  pendingLabel?: string | undefined
}) {
  return (
    <DropdownMenuItem
      disabled={disabled || pending || !onSelect}
      onClick={onSelect}
      {...(pending ? { 'aria-busy': true } : {})}
    >
      <span className="text-muted-foreground [&_svg]:size-4" aria-hidden="true">
        {pending ? <Spinner /> : icon}
      </span>
      <span className="flex flex-col">
        <span>{pending && pendingLabel ? pendingLabel : label}</span>
        {hint && (disabled || !onSelect) ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </span>
    </DropdownMenuItem>
  )
}

/**
 * The invoice as a document (Stripe wording): sender and invoice facts, Bill
 * from / Bill to, line items with quantity and unit price, totals, and the
 * payment note.
 */
function InvoiceDocumentArticle({
  invoice,
  lines,
  money,
  unitMoney,
  totals,
  paymentFailed,
  isDraft,
  retryPending = false,
  onRetryPayment,
}: {
  invoice: InvoiceDocument
  lines: InvoiceLine[]
  money: (value: number) => string
  unitMoney: (value: number) => string
  totals: ReturnType<typeof invoiceTotals>
  paymentFailed: boolean
  isDraft: boolean
  retryPending?: boolean
  onRetryPayment?: () => void
}) {
  const settled = totals.due <= 0 && invoice.paid > 0
  const note = paymentFailed
    ? 'The last payment attempt failed. Retry, or send the customer a payment link.'
    : settled || invoice.status === InvoiceStatus.Paid
      ? 'Paid in full.'
      : invoice.dueAt
        ? `Payment is due on ${invoice.dueAt}.`
        : 'Payment is due on receipt.'

  return (
    <article className="bg-background w-full overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-6 px-8 pt-8">
        <div className="space-y-2">
          <p className="text-3xl font-medium tracking-tight tabular-nums">{money(totals.due)}</p>
          <p className="text-muted-foreground text-[13px]">Amount due</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-[13px]">
          <dt className="text-muted-foreground">Date of issue</dt>
          <dd className="tabular-nums">{invoice.issuedAt ?? 'On finalize'}</dd>
          <dt className="text-muted-foreground">Date due</dt>
          <dd className="tabular-nums">{invoice.dueAt ?? '—'}</dd>
        </dl>
      </div>

      <div className="grid gap-6 px-8 py-8 sm:grid-cols-2">
        {invoice.from ? <Party heading="Bill from" party={invoice.from} withLogo /> : null}
        <Party heading="Bill to" party={invoice.billTo} tagged />
        {invoice.payment ? (
          <div className="space-y-1.5 text-[13px]">
            <p className="text-muted-foreground text-[11px] tracking-wider uppercase">Payment</p>
            <p>{invoice.payment.method}</p>
            {invoice.payment.terms ? (
              <p className="text-muted-foreground">Terms: {invoice.payment.terms}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mx-8 border-t pt-3">
        <div role="table" aria-label="Line items" className="text-sm">
          <div
            role="row"
            className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_5rem_7rem_7rem] gap-4 border-b pb-3 text-xs"
          >
            <span role="columnheader">Description</span>
            <span role="columnheader" className="text-right">
              Qty
            </span>
            <span role="columnheader" className="text-right">
              Unit price
            </span>
            <span role="columnheader" className="text-right">
              Amount
            </span>
          </div>
          {lines.map((line) => (
            <div
              key={line.id}
              role="row"
              className="border-border/50 grid grid-cols-[minmax(0,1fr)_5rem_7rem_7rem] items-start gap-4 border-b py-4 last:border-b-0"
            >
              <p role="cell" className="min-w-0 font-medium">
                {line.description}
              </p>
              <span role="cell" className="text-muted-foreground text-right tabular-nums">
                {line.quantity || '—'}
              </span>
              <span role="cell" className="text-muted-foreground text-right tabular-nums">
                {line.unitPrice === null || line.unitPrice === undefined
                  ? '—'
                  : unitMoney(line.unitPrice)}
              </span>
              <span role="cell" className="text-right tabular-nums">
                {money(line.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-8 flex justify-end border-t py-6">
        <TotalsList>
          <TotalRow label="Subtotal" value={money(totals.subtotal)} />
          {invoice.prepaidCredits ? (
            <TotalRow label="Prepaid credits" value={`− ${money(invoice.prepaidCredits)}`} />
          ) : null}
          <TotalRow label="Tax" value={money(invoice.tax)} />
          <TotalRow label="Total" value={money(totals.total)} emphasis="total" rule />
          {invoice.paid > 0 ? <TotalRow label="Paid" value={`− ${money(invoice.paid)}`} /> : null}
          <TotalRow label="Amount due" value={money(totals.due)} emphasis="due" />
        </TotalsList>
      </div>

      {isDraft ? null : (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-t px-8 py-4 text-[13px]">
          <span className="text-muted-foreground">{note}</span>
          {paymentFailed && onRetryPayment ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3"
              disabled={retryPending}
              aria-busy={retryPending || undefined}
              onClick={onRetryPayment}
            >
              {retryPending ? <Spinner aria-hidden="true" /> : null}
              {retryPending ? 'Retrying…' : 'Retry payment'}
            </Button>
          ) : null}
        </div>
      )}
    </article>
  )
}

function Party({
  heading,
  party,
  withLogo = false,
  tagged = false,
}: {
  heading: string
  party: InvoiceParty
  withLogo?: boolean
  /** Marks the address and email rows with a small "Billing ..." tag. */
  tagged?: boolean
}) {
  return (
    <div className="space-y-1.5 text-[13px]">
      <p className="text-muted-foreground text-[11px] tracking-wider uppercase">{heading}</p>
      <div className="flex items-start gap-3">
        {withLogo && party.logoUrl ? (
          <img
            src={party.logoUrl}
            alt=""
            className="size-9 shrink-0 rounded-lg border object-contain"
          />
        ) : null}
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{party.name}</p>
          {party.address.length > 0 ? (
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <div className="space-y-0.5">
                {party.address.map((line, index) => (
                  <p key={`${index}-${line}`} className="text-muted-foreground">
                    {line}
                  </p>
                ))}
              </div>
              {tagged ? <PartyTag>Billing address</PartyTag> : null}
            </div>
          ) : null}
          {party.email ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-muted-foreground">{party.email}</p>
              {tagged ? <PartyTag>Billing email</PartyTag> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PartyTag({ children }: { children: ReactNode }) {
  return (
    <Badge variant="outline" size="sm" radius="full" className="text-muted-foreground font-normal">
      {children}
    </Badge>
  )
}


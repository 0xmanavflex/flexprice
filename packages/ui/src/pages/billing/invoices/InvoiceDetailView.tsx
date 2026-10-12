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
import { DetailTabs } from '../../../compositions/detail/DetailKit'
import { MetadataCard } from '../../../compositions/detail/MetadataCard'
import { RelatedCard, type RelatedItem } from '../../../compositions/detail/RelatedCard'
import { Section } from '../../../compositions/layout/Section'
import { SectionEmpty } from '../../../compositions/feedback/SectionEmpty'
import { LoadingRows } from '../../../compositions/feedback/States'
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
    '@reui/badge',
  ],
  note: 'Invoice detail: DetailShell header (status chips, ID, More), Invoice details (the document and an Activity, Metadata, Related rail), Payments and Credit notes tabs.',
})

export interface InvoiceDetailViewProps {
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
  onIssueCreditNote?: () => void
  /** Finalized invoices: send the invoice to the customer. */
  onSend?: () => void
  onRetryPayment?: () => void
  onOpenCustomer?: () => void
  onOpenSubscription?: () => void
  onOpenPayment?: (paymentId: string) => void
  onOpenCreditNote?: (creditNoteId: string) => void
  paymentsLoading?: boolean
  creditNotesLoading?: boolean
}

type InvoiceTab = 'details' | 'payments' | 'credit-notes'

/**
 * One invoice (reference `invoice-detail`). The header is the plain word
 * "Invoice" with the status pills under it, the ID chip and one More menu on the right; every
 * action, Download PDF and Copy link included, lives in that menu. Tabs sit under
 * the header: Invoice details (the invoice as a document, with the Activity,
 * Metadata, Related rail beside it), Payments and Credit notes.
 */
export function InvoiceDetailView({
  invoice,
  onBack,
  onEdit,
  onFinalize,
  isFinalizing = false,
  onDownload,
  onRecordPayment,
  onRecalculate,
  onVoid,
  onIssueCreditNote,
  onSend,
  onRetryPayment,
  onOpenCustomer,
  onOpenSubscription,
  onOpenPayment,
  onOpenCreditNote,
  paymentsLoading = false,
  creditNotesLoading = false,
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
  const hostedUrl = invoice.hostedUrl ?? null

  const copyLink = () => {
    if (!hostedUrl) return
    void navigator.clipboard?.writeText(hostedUrl)
    toast.success('Invoice link copied')
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
        { label: invoice.number ?? 'Invoice' },
      ]}
      icon={<ReceiptIcon />}
      title="Invoice"
      id={invoice.id}
      badges={statusChips(invoice).map((chip) => (
        <Pill key={chip.label} tone={chip.tone}>
          {chip.label}
        </Pill>
      ))}
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
                label="Copy link"
                onSelect={hostedUrl ? copyLink : undefined}
                hint="Available once the invoice has a hosted page"
              />
              {isDraft && onFinalize ? (
                <MenuAction
                  icon={<CheckCircle2Icon />}
                  label="Finalize invoice"
                  disabled={isFinalizing}
                  onSelect={onFinalize}
                />
              ) : null}
              {isDraft && onEdit ? (
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
                  onSelect={onRetryPayment}
                />
              ) : null}
              <MenuAction
                icon={<CalculatorIcon />}
                label="Recalculate"
                onSelect={onRecalculate}
                disabled={!isDraft}
                hint={isDraft ? undefined : 'Drafts only'}
              />
              <MenuAction
                icon={<FileMinusIcon />}
                label="Issue credit note"
                onSelect={onIssueCreditNote}
                disabled={!canIssueCreditNote}
                hint={isDraft ? 'Finalize the invoice first' : undefined}
              />
              <MenuAction
                icon={<SendIcon />}
                label="Send invoice"
                onSelect={onSend}
                disabled={isDraft || invoice.status === InvoiceStatus.Void}
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
              ...(paymentsLoading ? {} : { count: invoice.payments.length }),
            },
            {
              value: 'credit-notes',
              label: 'Credit notes',
              ...(creditNotesLoading ? {} : { count: invoice.creditNotes.length }),
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
              {...(onRetryPayment ? { onRetryPayment } : {})}
            />
            <div className="flex flex-col gap-5 xl:sticky xl:top-6">
              <ActivitySection
                entries={invoice.events.map((event) => ({
                  id: event.id,
                  title: event.title,
                  at: event.at,
                  summary: event.summary,
                }))}
              />
              <MetadataCard metadata={invoice.metadata ?? {}} />
              <RelatedCard items={related} />
            </div>
          </div>
        ) : null}

        {tab === 'payments' ? (
          paymentsLoading ? (
            <Section title="Payments" flush>
              <div className="p-4">
                <LoadingRows />
              </div>
            </Section>
          ) : invoice.payments.length === 0 ? (
            <Section title="Payments" flush>
              <SectionEmpty
                title="No payments yet"
                description="No payments recorded for this invoice yet."
                action={
                  onRecordPayment && canRecordPayment ? (
                    <Button size="sm" onClick={onRecordPayment}>
                      Record payment
                    </Button>
                  ) : undefined
                }
              />
            </Section>
          ) : (
            <Section table title="Payments">
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
            </Section>
          )
        ) : null}

        {tab === 'credit-notes' ? (
          creditNotesLoading ? (
            <Section title="Credit notes" flush>
              <div className="p-4">
                <LoadingRows />
              </div>
            </Section>
          ) : invoice.creditNotes.length === 0 ? (
            <Section title="Credit notes" flush>
              <SectionEmpty
                title="No credit notes yet"
                description="No credit notes issued against this invoice."
                action={
                  onIssueCreditNote && canIssueCreditNote ? (
                    <Button size="sm" onClick={onIssueCreditNote}>
                      Issue credit note
                    </Button>
                  ) : undefined
                }
              />
            </Section>
          ) : (
            <Section table title="Credit notes">
              <DetailTable<InvoiceCreditNoteRow>
                compact
                label="Credit notes"
                noun="credit notes"
                rows={invoice.creditNotes}
                {...(onOpenCreditNote ? { onRowClick: (row) => onOpenCreditNote(row.id) } : {})}
                columns={[
                  {
                    key: 'number',
                    header: 'Credit note',
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
            </Section>
          )
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
}: {
  icon: ReactNode
  label: string
  onSelect: (() => void) | undefined
  disabled?: boolean
  hint?: string | undefined
}) {
  return (
    <DropdownMenuItem disabled={disabled || !onSelect} onClick={onSelect}>
      <span className="text-muted-foreground [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <span className="flex flex-col">
        <span>{label}</span>
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
  onRetryPayment,
}: {
  invoice: InvoiceDocument
  lines: InvoiceLine[]
  money: (value: number) => string
  unitMoney: (value: number) => string
  totals: ReturnType<typeof invoiceTotals>
  paymentFailed: boolean
  isDraft: boolean
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
        <dl className="w-full max-w-xs space-y-2.5 text-[13px]">
          <Total label="Subtotal" value={money(totals.subtotal)} />
          {invoice.prepaidCredits ? (
            <Total label="Prepaid credits" value={`− ${money(invoice.prepaidCredits)}`} />
          ) : null}
          <Total label="Tax" value={money(invoice.tax)} />
          <div className="flex justify-between border-t pt-3 text-sm font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(totals.total)}</dd>
          </div>
          {invoice.paid > 0 ? <Total label="Paid" value={`− ${money(invoice.paid)}`} /> : null}
          <div className="flex justify-between text-base font-medium">
            <dt>Amount due</dt>
            <dd className="tabular-nums">{money(totals.due)}</dd>
          </div>
        </dl>
      </div>

      {isDraft ? null : (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-t px-8 py-4 text-[13px]">
          <span className="text-muted-foreground">{note}</span>
          {paymentFailed && onRetryPayment ? (
            <Button size="sm" variant="outline" className="h-8 px-3" onClick={onRetryPayment}>
              Retry payment
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

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

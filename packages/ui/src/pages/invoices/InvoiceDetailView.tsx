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
} from 'lucide-react'
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
import { ScrollArea } from '@ui/components/primitives/scroll-area'
import { Switch } from '@ui/components/primitives/switch'
import { Badge } from '@ui/components/reui/badge'
import { AccountActivityRail } from '@ui/components/blocks/solution-billing-4/components/account-activity-rail'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { DetailShell } from '../../compositions/DetailShell'
import { DetailTabs } from '../../compositions/DetailKit'
import { MetadataCard } from '../../compositions/MetadataCard'
import { RelatedCard, type RelatedItem } from '../../compositions/RelatedCard'
import { Section } from '../../compositions/Section'
import { SectionEmpty } from '../../compositions/SectionEmpty'
import { LoadingRows } from '../../compositions/States'
import { DetailTable } from '../shared/DetailTable'
import { Status } from '../shared/cells'
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
    '@reui/badge',
    'blocks/solution-billing-4',
  ],
  note: 'Invoice detail: DetailShell header (status chips, ID, More), the invoice document with Payments / Credit notes tabs, and an Activity, Metadata, Related rail.',
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
  /** Starts with zero-amount lines shown; the switch above the items still toggles it. */
  showZeroAmounts?: boolean
}

type InvoiceTab = 'payments' | 'credit-notes'

/**
 * One invoice (reference `invoice-detail`). The header is the plain word
 * "Invoice" with the status chips, ID chip and one More menu on the right; every
 * action, Download PDF and Copy link included, lives in that menu. The main column is the
 * invoice as a document, then Payments and Credit notes tabs; the rail is
 * Activity, Metadata, Related.
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
  showZeroAmounts = false,
}: InvoiceDetailViewProps) {
  const [tab, setTab] = useState<InvoiceTab>('payments')
  const [showZero, setShowZero] = useState(showZeroAmounts)
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
  const lines = showZero ? invoice.lines : invoice.lines.filter((line) => line.amount !== 0)
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
        <Badge key={chip.label} variant={chip.variant} size="lg" radius="full">
          {chip.label}
        </Badge>
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
                disabled={!isOpen || totals.due <= 0}
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
                disabled={isDraft || invoice.status === InvoiceStatus.Void}
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
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <InvoiceDocumentArticle
            invoice={invoice}
            lines={lines}
            showZero={showZero}
            onShowZero={setShowZero}
            money={money}
            unitMoney={unitMoney}
            totals={totals}
            paymentFailed={paymentFailed}
            isDraft={isDraft}
            {...(onRetryPayment ? { onRetryPayment } : {})}
          />

          <DetailTabs
            value={tab}
            onChange={(next) => setTab(next as InvoiceTab)}
            tabs={[
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

          {tab === 'payments' ? (
            <Section title="Payments" flush bare={invoice.payments.length > 0}>
              {paymentsLoading ? (
                <div className="p-4">
                  <LoadingRows />
                </div>
              ) : invoice.payments.length === 0 ? (
                <SectionEmpty
                  title="No payments yet"
                  description="No payments recorded for this invoice yet."
                />
              ) : (
                <DetailTable<InvoicePaymentRow>
                  label="Payments"
                  noun="payments"
                  rows={invoice.payments}
                  {...(onOpenPayment ? { onRowClick: (row) => onOpenPayment(row.id) } : {})}
                  columns={[
                    {
                      key: 'id',
                      header: 'Payment',
                      cell: (row) => <span className="font-mono text-xs">{row.id}</span>,
                    },
                    { key: 'method', header: 'Method', cell: (row) => row.method || '—' },
                    {
                      key: 'date',
                      header: 'Date',
                      cell: (row) => <span className="text-muted-foreground">{row.date}</span>,
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      cell: (row) => <Status value={row.status} />,
                    },
                    {
                      key: 'amount',
                      header: 'Amount',
                      cell: (row) => <span className="tabular-nums">{money(row.amount)}</span>,
                    },
                  ]}
                />
              )}
            </Section>
          ) : null}

          {tab === 'credit-notes' ? (
            <Section title="Credit notes" flush bare={invoice.creditNotes.length > 0}>
              {creditNotesLoading ? (
                <div className="p-4">
                  <LoadingRows />
                </div>
              ) : invoice.creditNotes.length === 0 ? (
                <SectionEmpty
                  title="No credit notes yet"
                  description="No credit notes issued against this invoice."
                />
              ) : (
                <DetailTable<InvoiceCreditNoteRow>
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
              )}
            </Section>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 xl:sticky xl:top-6">
          <Section title="Activity" flush>
            {invoice.events.length === 0 ? (
              <p className="text-muted-foreground px-6 py-5 text-[13px]">No activity yet.</p>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <div className="p-5">
                  <AccountActivityRail
                    events={invoice.events.map((event) => ({ ...event, labels: [] }))}
                  />
                </div>
              </ScrollArea>
            )}
          </Section>
          <MetadataCard metadata={invoice.metadata ?? {}} />
          <RelatedCard items={related} />
        </div>
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
  showZero,
  onShowZero,
  money,
  unitMoney,
  totals,
  paymentFailed,
  isDraft,
  onRetryPayment,
}: {
  invoice: InvoiceDocument
  lines: InvoiceLine[]
  showZero: boolean
  onShowZero: (value: boolean) => void
  money: (value: number) => string
  unitMoney: (value: number) => string
  totals: ReturnType<typeof invoiceTotals>
  paymentFailed: boolean
  isDraft: boolean
  onRetryPayment?: () => void
}) {
  const settled = totals.due <= 0 && invoice.paid > 0
  const note = isDraft
    ? 'Finalizing assigns the invoice number and sends it to the customer.'
    : paymentFailed
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
          <p className="text-3xl font-medium tracking-tight tabular-nums">
            {money(settled ? totals.total : totals.due)}
          </p>
          <p className="text-muted-foreground text-[13px]">
            {settled ? 'Paid in full' : 'Amount due'}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-[13px]">
          <dt className="text-muted-foreground">Invoice number</dt>
          <dd
            className={cn(
              'leading-5',
              invoice.number ? 'font-mono text-xs' : 'text-muted-foreground',
            )}
          >
            {invoice.number ?? 'On finalize'}
          </dd>
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

      <div className="mx-8 flex flex-col gap-3 border-t">
        <div className="flex items-center justify-between pt-3">
          <p className="text-muted-foreground text-[11px] tracking-wider uppercase">Items</p>
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            Show zero amounts
            <Switch
              checked={showZero}
              onCheckedChange={onShowZero}
              aria-label="Show zero amounts"
            />
          </label>
        </div>
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
              <div role="cell" className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {line.description}
                  {line.kind ? (
                    <Badge variant="outline" size="sm" radius="full" className="font-normal">
                      {line.kind === 'usage' ? 'Usage' : 'Fixed'}
                    </Badge>
                  ) : null}
                </p>
                {line.detail ? (
                  <p className="text-muted-foreground text-xs">{line.detail}</p>
                ) : null}
              </div>
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

      <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-t px-8 py-4 text-[13px]">
        <span className="text-muted-foreground">{note}</span>
        {paymentFailed && onRetryPayment ? (
          <Button size="sm" variant="outline" className="h-8 px-3" onClick={onRetryPayment}>
            Retry payment
          </Button>
        ) : null}
      </div>
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

import { useState } from 'react'
import { SectionEmpty } from '@ui/compositions/SectionEmpty'
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  ReceiptIcon,
  RefreshCwIcon,
  UserIcon,
  XCircleIcon,
} from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Switch } from '@ui/components/primitives/switch'
import { InvoiceStatus } from '@fp/domain'
import { cn } from '@ui/lib/cn'
import { DetailShell } from '../../compositions/DetailShell'
import { DetailTabs, Dot, Properties } from '../../compositions/DetailKit'
import { Section } from '../../compositions/Section'
import { Pill, Status } from '../shared/cells'
import {
  displayStatus,
  invoiceTotals,
  type InvoiceDocument,
  type InvoiceLine,
} from './invoiceDocument'
import { DetailTable } from '../shared/DetailTable'

export interface InvoiceDetailViewProps {
  invoice: InvoiceDocument
  onBack?: () => void
  onEdit?: () => void
  onFinalize?: () => void
  onVoid?: () => void
  isFinalizing?: boolean
  onRetryPayment?: () => void
  onDownload?: () => void
  onOpenCustomer?: () => void
  /** Shown as the primary action while an open invoice still has an amount due. */
  onRecordPayment?: () => void
}

type InvoiceTab = 'overview' | 'payments' | 'credit-notes' | 'information'

const LINE_DOT = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

/**
 * One invoice (reference `invoice-detail`): the shared detail header, then the
 * invoice as a document with a Timeline and Related rail, and Payments, Credit
 * notes and Information as their own tabs.
 */
export function InvoiceDetailView({
  invoice,
  onBack,
  onEdit,
  onFinalize,
  onVoid,
  isFinalizing = false,
  onRetryPayment,
  onDownload,
  onOpenCustomer,
  onRecordPayment,
}: InvoiceDetailViewProps) {
  const [tab, setTab] = useState<InvoiceTab>('overview')
  const [showZero, setShowZero] = useState(false)
  const status = displayStatus(invoice)
  const totals = invoiceTotals(invoice)
  const money = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(value)
  const isDraft = invoice.status === 'draft'
  const paymentFailed = status?.label === 'Payment failed'
  const canVoid =
    onVoid && (invoice.status === InvoiceStatus.Open || invoice.status === InvoiceStatus.Overdue)
  const lines = showZero ? invoice.lines : invoice.lines.filter((line) => line.amount !== 0)
  const title = isDraft ? 'Draft invoice' : (invoice.number ?? invoice.id)
  const hasMenu = Boolean(
    paymentFailed || (isDraft && onEdit) || onOpenCustomer || canVoid || onBack,
  )

  return (
    <DetailShell
      trail={[{ label: 'Invoices', ...(onBack ? { onClick: onBack } : {}) }, { label: title }]}
      icon={<ReceiptIcon />}
      title={title}
      id={invoice.id}
      subtitle={
        <>
          {onOpenCustomer ? (
            <button
              type="button"
              className="hover:text-foreground underline-offset-2 hover:underline"
              onClick={onOpenCustomer}
            >
              {invoice.billTo.name}
            </button>
          ) : (
            <span>{invoice.billTo.name}</span>
          )}
          {invoice.subscriptionLabel ? (
            <>
              <Dot />
              <span>{invoice.subscriptionLabel}</span>
            </>
          ) : null}
          {/* The one status on the page. A draft's title already says so. */}
          {status ? (
            <>
              <Dot />
              <Pill tone={status.tone}>{status.label}</Pill>
            </>
          ) : null}
        </>
      }
      actions={
        <>
          <Button variant="outline" className="h-8 px-3" onClick={onDownload}>
            <DownloadIcon aria-hidden="true" />
            PDF
          </Button>
          {isDraft ? (
            <Button className="h-8 px-3.5" onClick={onFinalize} disabled={isFinalizing}>
              Finalize
            </Button>
          ) : onRecordPayment && totals.due > 0 ? (
            <Button className="h-8 px-3.5" onClick={onRecordPayment}>
              Record payment
            </Button>
          ) : null}
          {hasMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="More actions"
                  />
                }
              >
                <MoreHorizontalIcon aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  {paymentFailed ? (
                    <DropdownMenuItem onClick={onRetryPayment}>
                      <RefreshCwIcon className="text-muted-foreground" aria-hidden="true" />
                      Retry payment
                    </DropdownMenuItem>
                  ) : null}
                  {isDraft && onEdit ? (
                    <DropdownMenuItem onClick={onEdit}>Edit invoice</DropdownMenuItem>
                  ) : null}
                  {onOpenCustomer ? (
                    <DropdownMenuItem onClick={onOpenCustomer}>
                      <UserIcon className="text-muted-foreground" aria-hidden="true" />
                      Go to customer
                    </DropdownMenuItem>
                  ) : null}
                  {onBack ? (
                    <DropdownMenuItem onClick={onBack}>Back to invoices</DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
                {canVoid ? (
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
          ) : null}
        </>
      }
    >
      <DetailTabs
        value={tab}
        onChange={(next) => setTab(next as InvoiceTab)}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'payments', label: 'Payments', count: invoice.payments.length },
          { value: 'credit-notes', label: 'Credit notes', count: invoice.creditNotes.length },
          { value: 'information', label: 'Information' },
        ]}
      />

      {tab === 'overview' ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <InvoiceDocumentArticle
            invoice={invoice}
            lines={lines}
            showZero={showZero}
            onShowZero={setShowZero}
            money={money}
            totals={totals}
            paymentFailed={paymentFailed}
            isDraft={isDraft}
            {...(onRetryPayment ? { onRetryPayment } : {})}
          />
          <div className="flex flex-col gap-5 xl:sticky xl:top-6">
            <Section title="Timeline" flush>
              <InvoiceTimeline events={invoice.events} />
            </Section>
            <Section title="Related" flush>
              <ul className="divide-border/50 divide-y text-[13px]">
                <RelatedRow
                  label="Customer"
                  value={invoice.billTo.name}
                  {...(onOpenCustomer ? { onClick: onOpenCustomer } : {})}
                />
                <RelatedRow label="Subscription" value={invoice.subscriptionLabel || '—'} />
                <RelatedRow
                  label="Credit notes"
                  value={invoice.creditNotes.length ? String(invoice.creditNotes.length) : 'None'}
                  {...(invoice.creditNotes.length ? { onClick: () => setTab('credit-notes') } : {})}
                />
              </ul>
            </Section>
          </div>
        </div>
      ) : null}

      {tab === 'payments' ? (
        <Section title="Payments" flush bare={invoice.payments.length > 0}>
          {invoice.payments.length === 0 ? (
            <SectionEmpty
              title="No payments yet"
              description="No payments recorded for this invoice yet."
            />
          ) : (
            <DetailTable
              label="Payments"
              noun="payments"
              rows={invoice.payments}
              columns={[
                {
                  key: 'id',
                  header: 'Payment',
                  cell: (row) => <span className="font-mono text-xs">{row.id}</span>,
                },
                { key: 'method', header: 'Method', cell: (row) => row.method },
                {
                  key: 'date',
                  header: 'Date',
                  cell: (row) => <span className="text-muted-foreground">{row.date}</span>,
                },
                { key: 'status', header: 'Status', cell: (row) => <Status value={row.status} /> },
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
          {invoice.creditNotes.length === 0 ? (
            <SectionEmpty
              title="No credit notes yet"
              description="No credit notes issued against this invoice."
            />
          ) : (
            <DetailTable
              label="Credit notes"
              noun="credit notes"
              rows={invoice.creditNotes}
              columns={[
                {
                  key: 'number',
                  header: 'Credit note',
                  cell: (row) => <span className="font-mono text-xs">{row.number}</span>,
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

      {tab === 'information' ? (
        <div className="grid gap-5 xl:grid-cols-3">
          <Section className="xl:col-span-2" title="Invoice details">
            <Properties
              items={[
                {
                  label: 'Invoice ID',
                  value: <span className="font-mono text-[13px]">{invoice.id}</span>,
                },
                { label: 'Currency', value: invoice.currency },
                { label: 'Customer', value: invoice.billTo.name },
                ...(invoice.payment
                  ? [{ label: 'Payment terms', value: invoice.payment.terms }]
                  : []),
              ]}
            />
          </Section>
        </div>
      ) : null}
    </DetailShell>
  )
}

/** The invoice as a document, after the reference's receipt block: amount first, parties, items, totals, payment note. */
function InvoiceDocumentArticle({
  invoice,
  lines,
  showZero,
  onShowZero,
  money,
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
  totals: ReturnType<typeof invoiceTotals>
  paymentFailed: boolean
  isDraft: boolean
  onRetryPayment?: () => void
}) {
  const note = isDraft
    ? 'Finalizing assigns the invoice number and sends it to the customer.'
    : paymentFailed
      ? 'The last payment attempt failed. Retry, or send the customer a payment link.'
      : totals.due > 0
        ? `Payment is due${invoice.dueAt ? ` ${invoice.dueAt}` : ''}.`
        : 'Paid in full.'

  return (
    <article className="bg-background mx-auto w-full max-w-4xl overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-6 px-8 pt-8">
        {invoice.from ? (
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg text-sm font-medium"
            >
              {invoice.from.name.slice(0, 1)}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium">{invoice.from.name}</p>
              <p className="text-muted-foreground text-xs">{invoice.billTo.email}</p>
            </div>
          </div>
        ) : (
          <span />
        )}
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-[13px]">
          <dt className="text-muted-foreground">Invoice</dt>
          <dd
            className={cn(
              'leading-5',
              invoice.number ? 'font-mono text-xs' : 'text-muted-foreground',
            )}
          >
            {invoice.number ?? 'On finalize'}
          </dd>
          <dt className="text-muted-foreground">Issued</dt>
          <dd className="tabular-nums">{invoice.issuedAt ?? 'On finalize'}</dd>
          <dt className="text-muted-foreground">Due</dt>
          <dd className="tabular-nums">{invoice.dueAt ?? '—'}</dd>
        </dl>
      </div>

      <div className="space-y-2 px-8 pt-8">
        <p className="text-3xl font-medium tracking-tight tabular-nums">{money(totals.due)}</p>
        {invoice.dueAt ? (
          <p className="text-muted-foreground text-[13px]">Due {invoice.dueAt}</p>
        ) : null}
      </div>

      <div className="grid gap-6 px-8 py-8 sm:grid-cols-3">
        <Party
          heading="Bill to"
          lines={[
            invoice.billTo.name,
            invoice.billTo.email,
            ...addressLines(invoice.billTo.address),
          ]}
        />
        {invoice.from ? (
          <Party
            heading="From"
            lines={[invoice.from.name, ...addressLines(invoice.from.address)]}
          />
        ) : null}
        {invoice.payment ? (
          <Party
            heading="Payment"
            lines={[
              invoice.payment.method,
              invoice.payment.terms && `Terms: ${invoice.payment.terms}`,
            ]}
          />
        ) : null}
      </div>

      <div className="mx-8 border-t">
        <div className="flex items-center justify-between py-3">
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
        <ul className="divide-border/50 divide-y">
          {lines.map((line, index) => (
            <li key={line.id} className="flex items-start justify-between gap-6 py-4">
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span
                    aria-hidden="true"
                    className={cn('size-1.5 rounded-full', LINE_DOT[index % LINE_DOT.length])}
                  />
                  {line.description}
                </p>
                {line.detail ? (
                  <p className="text-muted-foreground pl-3.5 text-xs">{line.detail}</p>
                ) : null}
              </div>
              <p className="text-sm tabular-nums">{money(line.amount)}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-8 flex justify-end border-t py-6">
        <dl className="w-full max-w-xs space-y-2.5 text-[13px]">
          <Total label="Subtotal" value={money(totals.subtotal)} />
          {invoice.prepaidCredits ? (
            <Total label="Prepaid credits" value={`− ${money(invoice.prepaidCredits)}`} credit />
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

/** Keep the city and region together so a narrow column does not break "San Francisco". */
function addressLines(address: string): string[] {
  const parts = address.split(/,\s+/).filter(Boolean)
  if (parts.length < 2) return parts
  const region = parts[parts.length - 1] ?? ''
  const city = parts[parts.length - 2] ?? ''
  return [...parts.slice(0, -2), `${city}, ${region}`]
}

function Party({ heading, lines }: { heading: string; lines: Array<string | false> }) {
  return (
    <div className="space-y-1.5 text-[13px]">
      <p className="text-muted-foreground text-[11px] tracking-wider uppercase">{heading}</p>
      {lines
        .filter((line): line is string => Boolean(line))
        .map((line, index) => (
          <p
            key={`${index}-${line}`}
            className={cn(index === 0 ? 'font-medium' : 'text-muted-foreground')}
          >
            {line}
          </p>
        ))}
    </div>
  )
}

function Total({ label, value, credit }: { label: string; value: string; credit?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('tabular-nums', credit && 'text-success')}>{value}</dd>
    </div>
  )
}

function InvoiceTimeline({ events }: { events: InvoiceDocument['events'] }) {
  const ordered = [...events].sort((a, b) => a.id - b.id)
  if (ordered.length === 0) {
    return <p className="text-muted-foreground px-6 py-5 text-[13px]">No activity yet.</p>
  }
  return (
    <ol className="space-y-4 px-6 py-5">
      {ordered.map((event) => {
        const done = event.status === 'completed'
        const issue = event.status === 'issue'
        return (
          <li key={event.id} className="flex items-start gap-3">
            {done ? (
              <CheckCircle2Icon
                className="text-success mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
            ) : issue ? (
              <XCircleIcon className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <CircleDashedIcon
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
            )}
            <span className="flex-1">
              <span className={cn('block text-[13px]', !done && !issue && 'text-muted-foreground')}>
                {event.title}
              </span>
              <span className="text-muted-foreground block text-xs">{event.at}</span>
              {!done && event.summary ? (
                <span className="text-muted-foreground block text-xs">{event.summary}</span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function RelatedRow({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick?: () => void
}) {
  return (
    <li>
      <button
        type="button"
        disabled={!onClick}
        onClick={onClick}
        className="hover:bg-muted/30 flex w-full items-center justify-between gap-3 px-6 py-3 text-left disabled:pointer-events-none"
      >
        <span className="text-muted-foreground">{label}</span>
        <span>{value}</span>
      </button>
    </li>
  )
}

import { useState, type ReactNode } from 'react'
import { CheckIcon, CopyIcon, DownloadIcon, EllipsisIcon } from 'lucide-react'
import { MENU_CONTENT, MENU_ITEM } from '../../compositions/shell/menuSurface'
import { DetailTabs } from '../../compositions/DetailKit'
import { Button } from '@ui/components/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/primitives/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Switch } from '@ui/components/primitives/switch'
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@ui/components/reui/timeline'
import { InvoiceStatus } from '@fp/domain'
import { cn } from '@ui/lib/cn'
import {
  displayStatus,
  invoiceTotals,
  type InvoiceDocument,
  type InvoiceLine,
} from './invoiceDocument'

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
}

const LINE_DOT = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

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
}: InvoiceDetailViewProps) {
  const [showZero, setShowZero] = useState(false)
  const status = displayStatus(invoice)
  const totals = invoiceTotals(invoice)
  const money = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(value)
  const isDraft = invoice.status === 'draft'
  const paymentFailed = status?.label === 'Payment failed'
  const lines = showZero ? invoice.lines : invoice.lines.filter((line) => line.amount !== 0)
  const title = isDraft ? 'Draft invoice' : (invoice.number ?? invoice.id)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="bg-muted text-foreground flex size-7 shrink-0 items-center justify-center rounded-sm text-xs font-medium"
          >
            {isDraft ? 'D' : invoice.billTo.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-medium">{title}</h1>
            <p className="text-muted-foreground truncate text-[13px] font-normal">
              {invoice.billTo.name}
              {invoice.subscriptionLabel ? ` · ${invoice.subscriptionLabel}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyInvoiceId value={invoice.id} />
          <Button variant="outline" size="sm" onClick={onDownload}>
            <DownloadIcon aria-hidden className="size-3.5" />
            PDF
          </Button>
          {isDraft && onEdit ? (
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          {isDraft ? (
            <Button size="sm" onClick={onFinalize} disabled={isFinalizing}>
              Finalize
            </Button>
          ) : null}
          {onVoid && (invoice.status === InvoiceStatus.Open || invoice.status === InvoiceStatus.Overdue) ? (
            <Button variant="outline" size="sm" onClick={onVoid}>
              Void invoice
            </Button>
          ) : null}
          {onBack || paymentFailed ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon-sm" aria-label="More actions" />}
              >
                <EllipsisIcon aria-hidden className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className={MENU_CONTENT}>
                <DropdownMenuGroup>
                  {paymentFailed ? (
                    <DropdownMenuItem className={MENU_ITEM} onClick={onRetryPayment}>
                      Retry payment
                    </DropdownMenuItem>
                  ) : null}
                  {onBack ? (
                    <DropdownMenuItem className={MENU_ITEM} onClick={onBack}>
                      Back to invoices
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      <div className="px-6 pt-4 pb-10">
        <DetailTabs
          tabs={[
            {
              value: 'overview',
              label: 'Overview',
              content: (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <InvoiceDocumentCard
                    invoice={invoice}
                    lines={lines}
                    showZero={showZero}
                    onShowZero={setShowZero}
                    money={money}
                    subtotal={totals.subtotal}
                    due={totals.due}
                  />
                  <div className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
                    <Card size="sm" className="shadow-xs">
                      <CardHeader className="border-b">
                        <CardTitle className="text-sm font-medium">Timeline</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <InvoiceTimeline events={invoice.events} />
                      </CardContent>
                    </Card>
                    <Card size="sm" className="shadow-xs">
                      <CardHeader className="border-b">
                        <CardTitle className="text-sm font-medium">Related</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <dl className="flex flex-col gap-3 text-sm">
                          <RelatedRow label="Customer">
                            <button
                              type="button"
                              className="hover:underline"
                              onClick={onOpenCustomer}
                            >
                              {invoice.billTo.name}
                            </button>
                          </RelatedRow>
                          <RelatedRow label="Subscription">{invoice.subscriptionLabel || '—'}</RelatedRow>
                          <RelatedRow label="Credit notes">
                            {invoice.creditNotes.length || 'None'}
                          </RelatedRow>
                        </dl>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ),
            },
            {
              value: 'payments',
              label: 'Payments',
              count: invoice.payments.length,
              content: <RecordsCard title="Payments" empty="No payments yet.">{invoice.payments.length === 0 ? null : (
                <RecordTable
                  rows={invoice.payments}
                  columns={['Date', 'Method', 'Amount', 'Status']}
                  cells={(payment) => [payment.date, payment.method, money(payment.amount), payment.status]}
                />
              )}</RecordsCard>,
            },
            {
              value: 'credit-notes',
              label: 'Credit notes',
              count: invoice.creditNotes.length,
              content: <RecordsCard title="Credit notes" empty="No credit notes for this invoice.">{invoice.creditNotes.length === 0 ? null : (
                <RecordTable
                  rows={invoice.creditNotes}
                  columns={['Number', 'Date', 'Amount']}
                  cells={(note) => [note.number, note.date, money(note.amount)]}
                />
              )}</RecordsCard>,
            },
            {
              value: 'information',
              label: 'Information',
              content: (
                <Card className="shadow-xs">
                  <CardHeader className="border-b">
                    <CardTitle className="text-sm font-medium">Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid gap-5 sm:grid-cols-2">
                      <Info label="Invoice ID" value={invoice.id} mono />
                      <Info label="Currency" value={invoice.currency} />
                      <Info label="Customer" value={invoice.billTo.name} />
                      {invoice.payment ? <Info label="Payment terms" value={invoice.payment.terms} /> : null}
                    </dl>
                  </CardContent>
                </Card>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

function InvoiceDocumentCard({
  invoice,
  lines,
  showZero,
  onShowZero,
  money,
  subtotal,
  due,
}: {
  invoice: InvoiceDocument
  lines: InvoiceLine[]
  showZero: boolean
  onShowZero: (value: boolean) => void
  money: (value: number) => string
  subtotal: number
  due: number
}) {
  return (
    <Card className="shadow-xs">
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="bg-foreground text-background flex size-8 shrink-0 items-center justify-center rounded-sm text-xs font-medium"
            >
              {invoice.billTo.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{invoice.billTo.name}</p>
              <p className="text-muted-foreground truncate text-xs font-normal">{invoice.billTo.email}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
            <Meta label="Invoice" value={invoice.number ?? 'On finalize'} />
            <Meta label="Issued" value={invoice.issuedAt ?? 'On finalize'} />
            <Meta label="Due" value={invoice.dueAt ?? '—'} />
          </dl>
        </div>

        <div>
          <p className="text-[1.75rem] leading-none font-semibold tabular-nums">{money(due)}</p>
          {invoice.dueAt ? (
            <p className="text-muted-foreground mt-1.5 text-[13px] font-normal">Due {invoice.dueAt}</p>
          ) : null}
        </div>

        <div className="grid gap-6 border-t pt-5 sm:grid-cols-3">
          <Party
            heading="Bill to"
            lines={[invoice.billTo.name, invoice.billTo.email, ...addressLines(invoice.billTo.address)]}
          />
          {invoice.from ? (
            <Party heading="From" lines={[invoice.from.name, ...addressLines(invoice.from.address)]} />
          ) : null}
          {invoice.payment ? (
            <Party
              heading="Payment"
              lines={[invoice.payment.method, invoice.payment.terms && `Terms: ${invoice.payment.terms}`]}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-1 border-t pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
              Items
            </h2>
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              Show zero amounts
              <Switch
                size="sm"
                checked={showZero}
                onCheckedChange={onShowZero}
                aria-label="Show zero amounts"
              />
            </label>
          </div>
          <ul>
            {lines.map((line, index) => (
              <li key={line.id} className="flex items-start justify-between gap-4 border-b py-3.5 last:border-b-0">
                <div className="flex min-w-0 gap-3">
                  <span
                    aria-hidden
                    className={cn('mt-1.5 size-2 shrink-0 rounded-full', LINE_DOT[index % LINE_DOT.length])}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{line.description}</p>
                    {line.detail ? (
                      <p className="text-muted-foreground text-xs font-normal">{line.detail}</p>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-normal tabular-nums">{money(line.amount)}</span>
              </li>
            ))}
          </ul>
          <dl className="ml-auto flex w-full max-w-xs flex-col gap-2 pt-2 text-sm tabular-nums">
            <Total label="Subtotal" value={money(subtotal)} />
            {invoice.prepaidCredits ? (
              <Total label="Prepaid credits" value={`-${money(invoice.prepaidCredits)}`} credit />
            ) : null}
            <Total label="Tax" value={money(invoice.tax)} />
            {invoice.paid > 0 ? <Total label="Paid" value={money(invoice.paid)} /> : null}
            <Total label="Amount due" value={money(due)} strong />
          </dl>
        </div>
      </CardContent>
    </Card>
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs font-normal">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

function Party({ heading, lines }: { heading: string; lines: Array<string | false> }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <h3 className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">{heading}</h3>
      {lines.filter((line): line is string => Boolean(line)).map((line, index) => (
        <span
          key={`${index}-${line}`}
          className={index === 0 ? 'text-sm font-medium' : 'text-muted-foreground text-[13px] font-normal leading-5'}
        >
          {line}
        </span>
      ))}
    </div>
  )
}

function Total({
  label,
  value,
  strong,
  credit,
}: {
  label: string
  value: string
  strong?: boolean
  credit?: boolean
}) {
  return (
    <div className={cn('flex justify-between font-normal', strong && 'border-t pt-2 font-medium')}>
      <dt className={strong ? undefined : 'text-muted-foreground font-normal'}>{label}</dt>
      <dd className={credit ? 'text-success' : undefined}>{value}</dd>
    </div>
  )
}

function InvoiceTimeline({ events }: { events: InvoiceDocument['events'] }) {
  const ordered = [...events].sort((a, b) => a.id - b.id)
  return (
    <Timeline defaultValue={0}>
      {ordered.map((event, index) => {
        const done = event.status === 'completed'
        return (
          <TimelineItem key={event.id} step={index + 1} className="not-last:pb-3">
            <TimelineHeader className="flex flex-wrap items-baseline gap-x-2">
              <TimelineSeparator className="bg-border" />
              <TimelineTitle
                className={cn('text-[13px]', done ? 'font-medium' : 'text-muted-foreground font-normal')}
              >
                {event.title}
              </TimelineTitle>
              <TimelineDate className="mb-0 inline font-normal">{event.at}</TimelineDate>
              <TimelineIndicator
                className={cn(
                  'flex size-4 items-center justify-center border-2 bg-background',
                  done ? 'border-success bg-success text-white' : 'border-muted-foreground/30',
                )}
              >
                {done ? <CheckIcon className="size-2.5" /> : null}
              </TimelineIndicator>
            </TimelineHeader>
            {!done && event.summary ? (
              <TimelineContent className="text-xs leading-4">{event.summary}</TimelineContent>
            ) : null}
          </TimelineItem>
        )
      })}
    </Timeline>
  )
}

function CopyInvoiceId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      className="font-mono"
      aria-label={`Copy ${value}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {value}
      {copied ? <CheckIcon aria-hidden className="size-3.5" /> : <CopyIcon aria-hidden className="size-3.5" />}
    </Button>
  )
}

function RelatedRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground font-normal">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={mono ? 'font-mono text-xs' : 'text-sm'}>{value}</dd>
    </div>
  )
}

function RecordsCard({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode
}) {
  return (
    <Card className="shadow-xs">
      <CardHeader className="border-b">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children ?? <p className="text-muted-foreground text-sm">{empty}</p>}</CardContent>
    </Card>
  )
}

function RecordTable<T extends { id: string }>({
  rows,
  columns,
  cells,
}: {
  rows: T[]
  columns: string[]
  cells: (row: T) => string[]
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left">
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className="text-muted-foreground pb-2 text-[11px] font-medium tracking-[0.08em] uppercase"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t">
            {cells(row).map((cell, index) => (
              <td key={columns[index]} className="py-3 tabular-nums">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

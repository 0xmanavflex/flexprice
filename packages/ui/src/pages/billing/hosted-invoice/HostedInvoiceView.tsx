import { type ReactNode, useId } from 'react'
import type {
  HostedInvoice,
  HostedInvoiceLine,
  HostedInvoicePayment,
  Money as MoneyValue,
} from '@fp/domain'
import { CircleAlertIcon, CircleCheckIcon, DownloadIcon, PrinterIcon } from '@ui/icons'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Item, ItemMedia } from '@ui/components/primitives/item'
import { Separator } from '@ui/components/primitives/separator'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Spinner } from '@ui/components/primitives/spinner'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { ErrorState } from '@ui/compositions/feedback/States'
import { Panel } from '@ui/compositions/layout/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Money } from '../../shared/Money'
import { formatHostedDate } from './format'

const FLEXPRICE_URL = 'https://flexprice.io'

/**
 * The page behind a hosted invoice link, on ReUI's `receipt-5` block
 * (`components/blocks/receipt-5`), as installed: one Card with a sidebar —
 * the merchant's mark and the state, the amount, the invoice's essentials and
 * Pay — beside the invoice lines and totals, with Download and Print under it.
 *
 * The block is a static demo; this is its layout and parts fed with the
 * invoice. Presentational: the app passes data and handlers.
 */
export const HostedInvoiceViewProvenance = provenance({
  source: 'composition',
  composes: [
    'reui/badge',
    'compositions/layout/Section',
    'primitives/item',
    'primitives/separator',
    'primitives/button',
    'compositions/feedback/States',
    'shared/Money',
  ],
  note: 'Hosted invoice page: @reui/receipt-5, fed with the invoice.',
})

export type HostedInvoiceViewProps = { locale?: string } & (
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'invalid'; message: string }
  | { kind: 'failed'; onRetry: () => void }
  | {
      kind: 'invoice'
      invoice: HostedInvoice
      onPay: () => void
      isPaying: boolean
      payError: string | null
      onDownload: () => void
      isDownloading: boolean
      downloadError: string | null
    }
)

export function HostedInvoiceView(props: HostedInvoiceViewProps) {
  switch (props.kind) {
    case 'not-found':
      return (
        <Notice
          title="Invoice not found"
          body="Check the link in your invoice email. If it still doesn’t work, contact the business that sent it."
        />
      )
    case 'invalid':
      return <Notice title="Invoice not found" body={props.message} />
    case 'failed':
      return (
        <Page>
          <Panel innerClassName="p-6">
            <ErrorState
              variant="page"
              kind="network"
              title="We couldn’t load this invoice"
              description="Check your connection and try again."
              onRetry={props.onRetry}
            />
          </Panel>
        </Page>
      )
    case 'loading':
      return (
        <Page>
          <Panel innerClassName="p-6">
            <div
              className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10"
              role="status"
              aria-label="Loading invoice"
            >
              <div className="flex flex-col gap-5">
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="flex flex-col gap-4">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="ml-auto h-24 w-72" />
              </div>
            </div>
          </Panel>
        </Page>
      )
    case 'invoice':
      return <Receipt {...props} />
  }
}

const STATE: Record<
  HostedInvoice['state'],
  {
    badge: 'success-light' | 'warning-light' | 'info-light' | 'secondary'
    label: string
    hero: string
  }
> = {
  open: { badge: 'warning-light', label: 'Due', hero: 'Amount Due' },
  processing: { badge: 'info-light', label: 'Processing', hero: 'Payment Processing' },
  paid: { badge: 'success-light', label: 'Paid', hero: 'Total Paid' },
  voided: { badge: 'secondary', label: 'Void', hero: 'Invoice Voided' },
}

function Receipt(props: Extract<HostedInvoiceViewProps, { kind: 'invoice' }>) {
  const { invoice, locale } = props
  const loc = locale ? { locale } : {}
  const money = (value: MoneyValue) => <Money value={value} {...loc} />
  const date = (value: Date) => formatHostedDate(value, locale)
  // A due date is a calendar date: shown in UTC, the day the invoice PDF shows.
  const dueDay = (value: Date) => formatHostedDate(value, locale, 'UTC')
  const state = STATE[invoice.state]
  const settled = invoice.state === 'paid' || invoice.state === 'voided'
  const amount = settled ? invoice.total : invoice.amountRemaining
  const error = props.payError ?? props.downloadError
  // The backend withholds Pay when no connected gateway can take this payment, or the invoice can't be paid yet.
  const payUnavailable = invoice.state === 'open' && !invoice.payEnabled
  const payUnavailableId = useId()
  const merchant = invoice.tenant.name || 'Invoice'
  const lineCount = invoice.lines.length

  return (
    <Page>
      <section aria-labelledby="receipt-heading">
        <Panel innerClassName="p-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
            {/* Sidebar: merchant + state + amount + essentials + Pay */}
            <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start lg:border-r lg:pr-10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Item
                    className="bg-primary text-primary-foreground size-8 shrink-0 items-center justify-center p-0"
                    aria-hidden="true"
                  >
                    <ItemMedia variant="icon" className="size-auto text-sm font-medium">
                      {merchant.charAt(0).toUpperCase()}
                    </ItemMedia>
                  </Item>
                  <span className="truncate text-[13px] font-medium">{merchant}</span>
                </div>
                <Badge variant={state.badge} radius="full">
                  {invoice.state === 'paid' ? (
                    <CircleCheckIcon className="size-3.5" aria-hidden="true" />
                  ) : null}
                  {state.label}
                </Badge>
              </div>

              <div className="flex flex-col gap-1.5">
                <h1
                  id="receipt-heading"
                  className="text-muted-foreground text-[0.6875rem] font-medium tracking-[0.2em] uppercase"
                >
                  {state.hero}
                </h1>
                <span className="text-foreground text-2xl leading-none font-medium tracking-tight tabular-nums">
                  {money(amount)}
                </span>
                {invoice.state === 'paid' && invoice.paidAt ? (
                  <span className="text-muted-foreground text-xs">on {date(invoice.paidAt)}</span>
                ) : invoice.state === 'open' && invoice.dueAt ? (
                  <span className="text-muted-foreground text-xs">due {dueDay(invoice.dueAt)}</span>
                ) : null}
              </div>

              <Separator />

              <div className="flex flex-col gap-4">
                <MetaSection label="Invoice">
                  <p className="text-foreground font-mono text-[13px] tabular-nums">
                    {invoice.number}
                  </p>
                </MetaSection>
                {invoice.customerName ? (
                  <MetaSection label="Billed To">
                    <p className="text-foreground text-[13px] font-medium">
                      {invoice.customerName}
                    </p>
                  </MetaSection>
                ) : null}
                {invoice.state === 'paid' && invoice.paidWith ? (
                  <MetaSection label="Paid With">
                    <p className="text-foreground text-[13px] font-medium">{invoice.paidWith}</p>
                  </MetaSection>
                ) : null}
                {invoice.state !== 'paid' && invoice.state !== 'voided' && invoice.dueAt ? (
                  <MetaSection label="Due Date">
                    <p className="text-foreground text-[13px] font-medium">
                      {dueDay(invoice.dueAt)}
                    </p>
                  </MetaSection>
                ) : null}
                {invoice.memo ? (
                  <MetaSection label="Note">
                    <p className="text-muted-foreground text-xs leading-snug">{invoice.memo}</p>
                  </MetaSection>
                ) : null}
              </div>

              {invoice.state === 'open' ? (
                <>
                  <Separator />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={!invoice.payEnabled || props.isPaying}
                    aria-describedby={payUnavailable ? payUnavailableId : undefined}
                    onClick={props.onPay}
                  >
                    {props.isPaying ? <Spinner aria-hidden="true" /> : null}
                    Pay {money(invoice.amountRemaining)}
                  </Button>
                  {payUnavailable ? (
                    <p id={payUnavailableId} className="text-muted-foreground text-xs">
                      Online payment isn’t available for this invoice. Contact{' '}
                      {invoice.tenant.name || 'the business that sent it'} to pay.
                    </p>
                  ) : null}
                </>
              ) : null}
            </aside>

            {/* Main: lines + totals */}
            <div className="flex min-w-0 flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground text-[0.6875rem] font-medium tracking-[0.2em] uppercase">
                    Invoice Items
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {lineCount} {lineCount === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <div className="flex flex-col divide-y">
                  {invoice.lines.map((line, index) => (
                    <LineItem
                      key={line.id}
                      line={line}
                      amount={money(line.amount)}
                      isFirst={index === 0}
                      isLast={index === lineCount - 1}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              <dl className="ml-auto flex w-full flex-col gap-1.5 text-[13px] sm:w-72">
                <TotalRow label="Subtotal" value={money(invoice.subtotal)} />
                {invoice.discount ? (
                  <TotalRow
                    label="Discount"
                    value={<>-{money(invoice.discount)}</>}
                    tone="success"
                  />
                ) : null}
                {invoice.tax ? <TotalRow label="Tax" value={money(invoice.tax)} /> : null}
                <TotalRow label="Total" value={money(invoice.total)} strong divided />
                {invoice.state !== 'voided' && Number(invoice.amountPaid.amount) !== 0 ? (
                  <TotalRow label="Paid" value={<>-{money(invoice.amountPaid)}</>} />
                ) : null}
                {invoice.state === 'open' || invoice.state === 'processing' ? (
                  <TotalRow label="Amount due" value={money(invoice.amountRemaining)} strong />
                ) : null}
              </dl>

              {invoice.payments.length > 0 ? (
                <>
                  <Separator />
                  <PaymentHistory payments={invoice.payments} money={money} date={date} />
                </>
              ) : null}
            </div>
          </div>
        </Panel>

        {error ? (
          <Alert variant="destructive" className="mt-6">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription className="text-foreground">{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Secondary action utility row + support line */}
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={props.isDownloading}
              onClick={props.onDownload}
              aria-label={`Download invoice ${invoice.number}`}
            >
              {props.isDownloading ? (
                <Spinner aria-hidden="true" />
              ) : (
                <DownloadIcon className="size-4" aria-hidden="true" />
              )}
              Download
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              aria-label={`Print invoice ${invoice.number}`}
            >
              <PrinterIcon className="size-4" aria-hidden="true" />
              Print
            </Button>
          </div>
          <Footnote tenant={invoice.tenant} />
        </div>
      </section>
    </Page>
  )
}

/** The block's centred column on the page background. */
function Page({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background text-foreground min-h-svh w-full">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 md:py-14">{children}</div>
    </main>
  )
}

/** Who to ask about the invoice, and that Flexprice served the page. */
function Footnote({ tenant }: { tenant: HostedInvoice['tenant'] | null }) {
  return (
    <p className="text-muted-foreground text-xs">
      {tenant?.contactEmail ? (
        <>
          Questions?{' '}
          <a
            href={`mailto:${tenant.contactEmail}`}
            className="text-foreground hover:text-primary font-medium underline-offset-4 transition-colors hover:underline"
          >
            Contact {tenant.name || tenant.contactEmail}
          </a>
          .{' '}
        </>
      ) : null}
      Powered by{' '}
      <a
        href={FLEXPRICE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground hover:text-primary font-medium underline-offset-4 transition-colors hover:underline"
      >
        Flexprice
      </a>
      .
    </p>
  )
}

/** A link that leads nowhere: the block's frame with one centred notice and a way to reach support. */
function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Page>
      <Panel innerClassName="p-6">
        <ErrorState
          variant="page"
          kind="unavailable"
          title={title}
          description={body}
          action={
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={`${FLEXPRICE_URL}/contact`}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="link"
                />
              }
            >
              Contact Flexprice support
            </Button>
          }
        />
      </Panel>
    </Page>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// receipt-5's subcomponents, fed with invoice lines and totals.
// ─────────────────────────────────────────────────────────────────────────

function MetaSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[0.625rem] font-medium tracking-[0.22em] uppercase">
        {label}
      </span>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

/** A quantity as the API sent it, grouped for reading ("1,800"); anything unparseable as is. */
function quantityText(quantity: string): string {
  const value = Number(quantity)
  return quantity !== '' && Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value)
    : quantity
}

function LineItem({
  line,
  amount,
  isFirst,
  isLast,
}: {
  line: HostedInvoiceLine
  amount: ReactNode
  isFirst: boolean
  isLast: boolean
}) {
  return (
    // One line per item, so an invoice with many lines stays a short list.
    <article
      className={cn(
        'flex min-w-0 items-baseline gap-4 text-[13px]',
        isFirst ? 'pt-0' : 'pt-2',
        isLast ? 'pb-0' : 'pb-2',
      )}
    >
      {/* Names wrap rather than truncate: a charge name is often the only
          thing that tells two lines apart, on a phone and on paper. */}
      <p className="text-foreground min-w-0 flex-1 font-medium break-words">{line.name}</p>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        × {quantityText(line.quantity)}
      </span>
      <span className="text-foreground w-24 shrink-0 text-right font-medium tabular-nums">
        {amount}
      </span>
    </article>
  )
}

const PAYMENT_BADGE: Record<string, 'success-light' | 'destructive-light' | 'info-light'> = {
  SUCCEEDED: 'success-light',
  FAILED: 'destructive-light',
  PROCESSING: 'info-light',
  PENDING: 'info-light',
}

/** "PARTIALLY_REFUNDED" → "Partially refunded". */
function paymentStatusLabel(status: string): string {
  const spaced = status.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Each payment attempt: amount, method, when, and how it ended. A failed card
 * attempt is the only explanation a customer gets for a balance still due.
 */
function PaymentHistory({
  payments,
  money,
  date,
}: {
  payments: HostedInvoicePayment[]
  money: (value: MoneyValue) => ReactNode
  date: (value: Date) => string
}) {
  return (
    <section aria-labelledby="payment-history-heading" className="flex flex-col gap-4">
      <h2
        id="payment-history-heading"
        className="text-muted-foreground text-[0.6875rem] font-medium tracking-[0.2em] uppercase"
      >
        Payment History
      </h2>
      <ul className="flex flex-col divide-y">
        {payments.map((payment, index) => (
          <li
            key={payment.id}
            className={cn(
              'flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[13px]',
              index === 0 ? 'pt-0' : 'pt-2',
              index === payments.length - 1 ? 'pb-0' : 'pb-2',
            )}
          >
            <span className="text-foreground min-w-0 flex-1 font-medium">
              {payment.method || 'Payment'}
              {payment.at ? (
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  {date(payment.at)}
                </span>
              ) : null}
            </span>
            {payment.status ? (
              <Badge variant={PAYMENT_BADGE[payment.status] ?? 'secondary'} radius="full">
                {paymentStatusLabel(payment.status)}
              </Badge>
            ) : null}
            <span className="text-foreground w-24 shrink-0 text-right font-medium tabular-nums">
              {money(payment.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TotalRow({
  label,
  value,
  tone = 'default',
  strong = false,
  divided = false,
}: {
  label: string
  value: ReactNode
  tone?: 'default' | 'success'
  strong?: boolean
  /** A rule above the row, for the total (a separator cannot sit inside a `dl`). */
  divided?: boolean
}) {
  return (
    <div
      className={cn('flex items-baseline justify-between gap-4', divided && 'mt-1 border-t pt-2.5')}
    >
      <dt
        className={cn(
          strong ? 'text-foreground text-sm font-medium' : 'text-muted-foreground text-[13px]',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'tabular-nums',
          strong
            ? 'text-foreground text-base font-medium'
            : 'text-foreground text-[13px] font-medium',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

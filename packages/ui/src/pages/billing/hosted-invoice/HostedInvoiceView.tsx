import { type ReactNode, useId, useState } from 'react'
import { type HostedInvoice, type Money as MoneyValue, isOverdue } from '@fp/domain'
import { ChevronRightIcon, CircleAlertIcon } from '@ui/icons'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Spinner } from '@ui/components/primitives/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { ErrorState } from '@ui/compositions/feedback/States'
import { Panel } from '@ui/compositions/layout/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Money } from '../../shared/Money'
import { formatHostedDate } from './format'
import { HostedInvoiceCharges } from './HostedInvoiceCharges'
import { HostedInvoiceDetailsSheet, type StatusBadge } from './HostedInvoiceDetailsSheet'
import {
  HostedInvoicePreviewDialog,
  type HostedInvoicePreviewDialogProps,
} from './HostedInvoicePreviewDialog'

const FLEXPRICE_URL = 'https://flexprice.io'

/**
 * The page behind a hosted invoice link, as the hosted invoice redesign lays
 * it out: a summary card (the state, the amount, Pay, the
 * invoice's essentials) beside "What you're paying for", the charges grouped
 * by plan or add-on over the totals. "All invoice details" opens both parties'
 * addresses, the memo and the payments; "Preview invoice" shows the PDF.
 *
 * Presentational: the app passes data and handlers.
 */
export const HostedInvoiceViewProvenance = provenance({
  source: 'composition',
  composes: [
    'reui/badge',
    'reui/alert',
    'primitives/tooltip',
    'compositions/layout/Section',
    'primitives/button',
    'primitives/skeleton',
    'primitives/spinner',
    'compositions/feedback/States',
    'shared/Money',
    'pages/billing/hosted-invoice/HostedInvoiceCharges',
    'pages/billing/hosted-invoice/HostedInvoiceDetailsSheet',
    'pages/billing/hosted-invoice/HostedInvoicePreviewDialog',
  ],
  note: 'Hosted invoice page, on the hosted invoice redesign: summary card, grouped charges, details sheet and PDF preview.',
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
      /** Opens the PDF preview; the app fetches its link and passes it as `preview`. */
      onPreview: () => void
      /** Null when the preview is closed; `url` null while its link is fetched. */
      preview: HostedInvoicePreviewDialogProps['preview']
      onClosePreview: () => void
      /** Today, for "Overdue". Defaults to now; stories pass a fixed day. */
      now?: Date
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

type Status = {
  key: 'due' | 'overdue' | 'processing' | 'paid' | 'void'
  label: string
  badge: StatusBadge
}

function statusOf(invoice: HostedInvoice, now: Date): Status {
  switch (invoice.state) {
    case 'paid':
      return { key: 'paid', label: 'Paid', badge: 'success-light' }
    case 'voided':
      return { key: 'void', label: 'Void', badge: 'secondary' }
    case 'processing':
      return { key: 'processing', label: 'Processing', badge: 'info-light' }
    case 'open':
      return isOverdue(invoice, now)
        ? { key: 'overdue', label: 'Overdue', badge: 'destructive-light' }
        : { key: 'due', label: 'Due', badge: 'warning-light' }
  }
}

function Receipt(props: Extract<HostedInvoiceViewProps, { kind: 'invoice' }>) {
  const { invoice, locale } = props
  const loc = locale ? { locale } : {}
  const money = (value: MoneyValue) => <Money value={value} {...loc} />
  // Calendar dates (due, issued, period) in UTC: the days the invoice PDF prints.
  const day = (value: Date) => formatHostedDate(value, locale, 'UTC')
  const status = statusOf(invoice, props.now ?? new Date())
  const [detailsOpen, setDetailsOpen] = useState(false)
  const error = props.payError
  const payable = status.key === 'due' || status.key === 'overdue'
  const payUnavailable = payable && !invoice.payEnabled
  const merchant = invoice.tenant.name || 'Invoice'

  const hero = {
    due: { label: 'Amount due', amount: invoice.amountRemaining },
    overdue: { label: 'Amount due', amount: invoice.amountRemaining },
    processing: { label: 'Payment processing', amount: invoice.amountRemaining },
    paid: { label: 'Amount paid', amount: invoice.total },
    void: { label: 'Voided', amount: invoice.total },
  }[status.key]

  const when =
    status.key === 'due' && invoice.dueAt
      ? `Due ${day(invoice.dueAt)}`
      : status.key === 'overdue' && invoice.dueAt
        ? `Overdue since ${day(invoice.dueAt)}`
        : status.key === 'paid' && invoice.paidAt
          ? `Paid ${formatHostedDate(invoice.paidAt, locale)}${invoice.paidWith ? ` with ${invoice.paidWith}` : ''}`
          : status.key === 'void' && invoice.voidedAt
            ? `Voided ${formatHostedDate(invoice.voidedAt, locale)}`
            : null

  const period =
    invoice.periodStart && invoice.periodEnd
      ? `${day(invoice.periodStart)} – ${day(invoice.periodEnd)}`
      : null

  return (
    <Page>
      <p className="mb-6 text-lg font-medium tracking-tight">{merchant}</p>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <section
            aria-labelledby="hosted-amount-heading"
            className="bg-background flex flex-col gap-5 rounded-xl border p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground min-w-0 truncate text-[13px]">
                Invoice {invoice.number}
              </span>
              <Badge variant={status.badge} radius="full">
                {status.label}
              </Badge>
            </div>

            <div className="flex flex-col gap-1">
              <h1 id="hosted-amount-heading" className="text-muted-foreground text-[13px]">
                {hero.label}
              </h1>
              <span
                className={cn(
                  'text-[2rem] leading-tight font-medium tracking-tight tabular-nums',
                  status.key === 'void' && 'text-muted-foreground line-through',
                )}
              >
                {money(hero.amount)}
              </span>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span
                  className={cn(
                    'text-muted-foreground',
                    status.key === 'overdue' && 'text-destructive',
                  )}
                >
                  {when}
                </span>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={props.onPreview}
                  className="text-muted-foreground hover:text-foreground h-auto px-0 font-normal underline decoration-dotted underline-offset-4"
                >
                  Preview invoice
                </Button>
              </div>
            </div>

            {payable ? (
              <PayButton
                amount={money(invoice.amountRemaining)}
                isPaying={props.isPaying}
                onPay={props.onPay}
                unavailable={payUnavailable ? invoice.tenant : null}
              />
            ) : null}

            <dl className="flex flex-col gap-2.5 border-t pt-5 text-[13px]">
              {invoice.customer ? <Fact label="Billed to">{invoice.customer.name}</Fact> : null}
              {period ? <Fact label="Billing period">{period}</Fact> : null}
              {invoice.issuedAt ? <Fact label="Invoice date">{day(invoice.issuedAt)}</Fact> : null}
              {invoice.dueAt ? <Fact label="Due date">{day(invoice.dueAt)}</Fact> : null}
            </dl>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDetailsOpen(true)}
              className="-mx-2 -mt-2 w-fit"
            >
              All invoice details
              <ChevronRightIcon aria-hidden data-icon="inline-end" />
            </Button>
          </section>

          {error ? (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden="true" />
              <AlertDescription className="text-foreground">{error}</AlertDescription>
            </Alert>
          ) : null}

          <Footnote tenant={invoice.tenant} />
        </div>

        <HostedInvoiceCharges invoice={invoice} money={money} locale={locale} />
      </div>

      <HostedInvoiceDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        invoice={invoice}
        status={status}
        money={money}
        locale={locale}
      />
      <HostedInvoicePreviewDialog
        preview={props.preview}
        onClose={props.onClosePreview}
        number={invoice.number}
      />
    </Page>
  )
}

/**
 * Pay, or, when the business has not turned online payment on, Pay disabled
 * with a tooltip saying to contact the business, its email a link. A disabled
 * button gets no pointer events, so the tooltip hangs on a focusable wrapper,
 * and the popup stays open while hovered so the link can be clicked. The
 * reason is also the button's description, for screen readers.
 */
function PayButton({
  amount,
  isPaying,
  onPay,
  unavailable,
}: {
  amount: ReactNode
  isPaying: boolean
  onPay: () => void
  /** The business to contact when online payment is off; null when Pay works. */
  unavailable: HostedInvoice['tenant'] | null
}) {
  const reasonId = useId()
  const button = (
    <Button
      type="button"
      className="w-full"
      disabled={unavailable !== null || isPaying}
      aria-describedby={unavailable === null ? undefined : reasonId}
      onClick={onPay}
    >
      {isPaying ? <Spinner aria-hidden="true" /> : null}
      Pay {amount}
    </Button>
  )
  if (unavailable === null) return button
  const merchant = unavailable.name || 'the business that sent it'
  const email = unavailable.contactEmail
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="flex w-full" />}>
        {button}
      </TooltipTrigger>
      <TooltipContent className="block max-w-64">
        Online payment isn’t available. Contact {merchant}
        {email ? (
          <>
            {' at '}
            <a href={`mailto:${email}`} className="font-medium underline underline-offset-2">
              {email}
            </a>
          </>
        ) : null}{' '}
        to pay.
      </TooltipContent>
      <span id={reasonId} className="sr-only">
        {`Online payment isn’t available. Contact ${merchant}${email ? ` at ${email}` : ''} to pay.`}
      </span>
    </Tooltip>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

/** The block's centred column on a light grey page, the cards on top. */
function Page({ children }: { children: ReactNode }) {
  return (
    <main className="bg-muted text-foreground min-h-svh w-full">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:py-14">{children}</div>
    </main>
  )
}

/** Who to ask about the invoice, and that Flexprice served the page. */
function Footnote({ tenant }: { tenant: HostedInvoice['tenant'] | null }) {
  return (
    <div className="text-muted-foreground flex flex-col gap-1.5 px-1 text-xs">
      {tenant?.contactEmail ? (
        <p>
          Contact {tenant.name || 'the business that sent it'} at{' '}
          <a
            href={`mailto:${tenant.contactEmail}`}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            {tenant.contactEmail}
          </a>
        </p>
      ) : null}
      <p>
        Powered by{' '}
        <a
          href={FLEXPRICE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Flexprice
        </a>
      </p>
    </div>
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

import { type ReactNode, useId, useState } from 'react'
import type { HostedInvoice } from '@fp/domain'
import { ChevronRightIcon, CircleAlertIcon, DownloadIcon, ReceiptIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Spinner } from '@ui/components/primitives/spinner'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { IconTile } from '@ui/components/reui/icon-tile'
import { ErrorState } from '@ui/compositions/feedback/States'
import { Section } from '@ui/compositions/layout/Section'
import { DetailList, type DetailItem } from '@ui/compositions/tables/DetailList'
import { provenance } from '@ui/provenance'
import { Money } from '../../shared/Money'
import { HostedInvoiceDetailsSheet } from './HostedInvoiceDetailsSheet'
import { HostedInvoiceStatePill, TenantMark, amountLabelOf } from './parts'
import { formatHostedDate } from './format'

const FLEXPRICE_URL = 'https://flexprice.io'

/**
 * The page behind a hosted invoice link: the merchant's header, one invoice
 * section with the amount, the essentials, Download and Pay, and a drawer with
 * the full invoice. Same frame and parts as the customer portal (header band,
 * `Section`, `DetailList`, `Pill`, `ErrorState`). Presentational: the app
 * passes data and handlers.
 */
export const HostedInvoiceViewProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/Section',
    'compositions/tables/DetailList',
    'compositions/feedback/States',
    'reui/icon-tile',
    'reui/alert',
    'primitives/button',
    'shared/Money',
  ],
  note: 'Hosted invoice page: the customer portal frame around one invoice Section.',
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
        <Frame tenant={null}>
          <Section title="Invoice" bare>
            <ErrorState
              variant="page"
              kind="network"
              title="We couldn’t load this invoice"
              description="Check your connection and try again."
              onRetry={props.onRetry}
            />
          </Section>
        </Frame>
      )
    case 'loading':
      return (
        <Frame tenant={null}>
          <Section title="Invoice">
            <div className="flex flex-col gap-6" role="status" aria-label="Loading invoice">
              <div className="flex items-center gap-4">
                <Skeleton className="size-12 rounded-lg" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-40" />
                </div>
              </div>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </Section>
        </Frame>
      )
    case 'invoice':
      return <InvoicePage {...props} />
  }
}

function InvoicePage(props: Extract<HostedInvoiceViewProps, { kind: 'invoice' }>) {
  const { invoice, locale } = props
  const [detailsOpen, setDetailsOpen] = useState(false)
  const date = (value: Date) => formatHostedDate(value, locale)
  const settled = invoice.state === 'paid' || invoice.state === 'voided'
  const amount = settled ? invoice.total : invoice.amountRemaining
  const error = props.payError ?? props.downloadError
  // The backend withholds Pay when no connected gateway can take this payment, or the invoice can't be paid yet.
  const payUnavailable = invoice.state === 'open' && !invoice.payEnabled
  const payUnavailableId = useId()

  const facts: DetailItem[] = [{ label: 'Invoice number', value: invoice.number }]
  if (invoice.state === 'paid') {
    if (invoice.paidAt) facts.push({ label: 'Payment date', value: date(invoice.paidAt) })
    if (invoice.paidWith) facts.push({ label: 'Payment method', value: invoice.paidWith })
  } else if (invoice.state !== 'voided' && invoice.dueAt) {
    facts.push({ label: 'Due date', value: formatHostedDate(invoice.dueAt, locale, 'UTC') })
  }

  return (
    <Frame tenant={invoice.tenant}>
      <Section title="Invoice" as="h1" actions={<HostedInvoiceStatePill state={invoice.state} />}>
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <IconTile size="lg" variant="outline" className="text-foreground/70" aria-hidden="true">
              <ReceiptIcon />
            </IconTile>
            <div className="min-w-0 space-y-0.5">
              <p className="text-muted-foreground text-xs">{amountLabelOf(invoice.state)}</p>
              <p className="text-3xl font-medium tracking-tight tabular-nums">
                <Money value={amount} {...(locale ? { locale } : {})} />
              </p>
            </div>
          </div>

          <DetailList items={facts} className="border-y py-5" />

          {payUnavailable ? (
            <p id={payUnavailableId} className="text-muted-foreground text-[13px]">
              Online payment isn’t available for this invoice. Contact{' '}
              {invoice.tenant.name || 'the business that sent it'} to pay.
            </p>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden="true" />
              <AlertDescription className="text-foreground">{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="link"
              className="text-foreground h-auto self-start p-0 sm:self-auto"
              onClick={() => setDetailsOpen(true)}
            >
              View invoice and payment details
              <ChevronRightIcon aria-hidden="true" />
            </Button>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                type="button"
                variant="outline"
                className={invoice.state === 'open' ? undefined : 'col-span-2'}
                disabled={props.isDownloading}
                onClick={props.onDownload}
              >
                {props.isDownloading ? (
                  <Spinner aria-hidden="true" />
                ) : (
                  <DownloadIcon aria-hidden="true" />
                )}
                Download invoice
              </Button>
              {invoice.state === 'open' ? (
                <Button
                  type="button"
                  disabled={!invoice.payEnabled || props.isPaying}
                  aria-describedby={payUnavailable ? payUnavailableId : undefined}
                  onClick={props.onPay}
                >
                  {props.isPaying ? <Spinner aria-hidden="true" /> : null}
                  Pay
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Section>

      <HostedInvoiceDetailsSheet
        invoice={detailsOpen ? invoice : null}
        onClose={() => setDetailsOpen(false)}
        {...(locale ? { locale } : {})}
      />
    </Frame>
  )
}

/**
 * The customer portal's frame: a header band with the merchant, the content
 * column on the muted page, and "Powered by Flexprice" at the foot.
 */
function Frame({
  tenant,
  children,
}: {
  tenant: HostedInvoice['tenant'] | null
  children: ReactNode
}) {
  return (
    <div className="bg-muted/30 text-foreground flex min-h-svh flex-col">
      <header className="bg-background border-b">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-5 sm:px-8">
          {tenant?.name ? <TenantMark name={tenant.name} /> : null}
          <span
            className={
              tenant?.name
                ? 'truncate text-[15px] font-medium tracking-tight'
                : 'text-muted-foreground text-sm'
            }
          >
            {tenant?.name || 'Invoice'}
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 pt-8 pb-16 sm:px-8">
        {children}
        {tenant?.contactEmail ? (
          <p className="text-muted-foreground text-center text-[13px]">
            Questions? Contact{' '}
            <a
              className="text-foreground underline underline-offset-4"
              href={`mailto:${tenant.contactEmail}`}
            >
              {tenant.name || tenant.contactEmail}
            </a>
          </p>
        ) : null}
      </main>
      <footer className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t py-6 text-xs">
        <span>
          Powered by{' '}
          <a
            href={FLEXPRICE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 hover:text-foreground underline underline-offset-4"
          >
            Flexprice
          </a>
        </span>
        <a
          href={`${FLEXPRICE_URL}/terms-and-conditions`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground"
        >
          Terms
        </a>
        <a
          href={`${FLEXPRICE_URL}/privacy`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground"
        >
          Privacy
        </a>
      </footer>
    </div>
  )
}

/** A link that leads nowhere: the frame with one centred notice and a way to reach support. */
function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Frame tenant={null}>
      <Section title="Invoice" bare>
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
      </Section>
    </Frame>
  )
}

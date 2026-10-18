import { type ReactNode, useState } from 'react'
import type { HostedInvoice } from '@fp/domain'
import { ChevronRightIcon, CircleCheckIcon, ReceiptIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Spinner } from '@ui/components/primitives/spinner'
import { IconTile } from '@ui/components/reui/icon-tile'
import { Panel } from '@ui/compositions/layout/Section'
import { ErrorState } from '@ui/compositions/feedback/States'
import { provenance } from '@ui/provenance'
import { Money } from '../../shared/Money'
import { HostedInvoiceDetailsSheet } from './HostedInvoiceDetailsSheet'
import { formatHostedDate } from './format'

/**
 * The page behind a hosted invoice link: one centred card with the amount,
 * the essentials, Download and Pay, and a drawer with the full invoice —
 * Stripe's hosted invoice page. Presentational: the app passes data and handlers.
 */
export const HostedInvoiceViewProvenance = provenance({
  source: 'composition',
  composes: ['compositions/layout/Section', 'reui/icon-tile', 'primitives/button', 'compositions/feedback/States', 'shared/Money'],
  note: 'Hosted invoice page card; layout after ReUI receipt-5 summary and Stripe hosted invoice.',
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
      return <ErrorState variant="page" title="Page not found" />
    case 'invalid':
      return <ErrorState variant="page" title={props.message} />
    case 'failed':
      return (
        <ErrorState variant="page" kind="generic" title="We couldn’t load this invoice" onRetry={props.onRetry} />
      )
    case 'loading':
      return (
        <Layout tenant={null}>
          <div className="flex flex-col items-center gap-4 p-8">
            <Skeleton className="size-12 rounded-lg" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="mt-4 h-24 w-full" />
          </div>
        </Layout>
      )
    case 'invoice':
      return <InvoiceCard {...props} />
  }
}

function InvoiceCard(props: Extract<HostedInvoiceViewProps, { kind: 'invoice' }>) {
  const { invoice, locale } = props
  const [detailsOpen, setDetailsOpen] = useState(false)
  const date = (value: Date) => formatHostedDate(value, locale)
  const settled = invoice.state === 'paid' || invoice.state === 'voided'
  const amount = settled ? invoice.total : invoice.amountRemaining
  const error = props.payError ?? props.downloadError

  const rows: { label: string; value: string }[] = [{ label: 'Invoice number', value: invoice.number }]
  if (invoice.state === 'paid') {
    if (invoice.paidAt) rows.push({ label: 'Payment date', value: date(invoice.paidAt) })
    if (invoice.paidWith) rows.push({ label: 'Payment method', value: invoice.paidWith })
  } else if (invoice.state !== 'voided' && invoice.dueAt) {
    rows.push({ label: 'Due date', value: date(invoice.dueAt) })
  }

  return (
    <Layout tenant={invoice.tenant}>
      <div className="flex flex-col items-center gap-6 px-6 py-8 sm:px-10">
        <div className="relative">
          <IconTile size="xl" variant="elevated" aria-hidden="true">
            <ReceiptIcon />
          </IconTile>
          {invoice.state === 'paid' ? (
            <CircleCheckIcon aria-hidden="true" className="text-success bg-background absolute -right-1.5 -bottom-1.5 size-5 rounded-full" />
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-muted-foreground text-sm">{labelOf(invoice)}</p>
          <p className="text-3xl font-medium tabular-nums">
            <Money value={amount} {...(locale ? { locale } : {})} />
          </p>
          <Button type="button" variant="link" size="sm" className="text-muted-foreground" onClick={() => setDetailsOpen(true)}>
            View invoice and payment details
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>

        <dl className="flex w-full flex-col gap-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right break-all">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex w-full flex-col gap-3">
          <div className={invoice.state === 'open' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1'}>
            <Button type="button" variant="outline" disabled={props.isDownloading} onClick={props.onDownload}>
              {props.isDownloading ? <Spinner aria-hidden="true" /> : null}
              Download invoice
            </Button>
            {invoice.state === 'open' ? (
              <Button type="button" disabled={!invoice.payEnabled || props.isPaying} onClick={props.onPay}>
                {props.isPaying ? <Spinner aria-hidden="true" /> : null}
                Pay
              </Button>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-center text-sm">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <HostedInvoiceDetailsSheet
        invoice={detailsOpen ? invoice : null}
        onClose={() => setDetailsOpen(false)}
        {...(locale ? { locale } : {})}
      />
    </Layout>
  )
}

function labelOf(invoice: HostedInvoice): string {
  switch (invoice.state) {
    case 'paid':
      return 'Invoice paid'
    case 'voided':
      return 'Invoice voided'
    case 'processing':
      return 'Payment processing'
    case 'open':
      return 'Amount due'
  }
}

function Layout({ tenant, children }: { tenant: HostedInvoice['tenant'] | null; children: ReactNode }) {
  return (
    <main className="bg-muted/40 min-h-dvh px-4 py-12 sm:py-20">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        {tenant?.name ? <p className="text-muted-foreground text-xl font-medium">{tenant.name}</p> : null}
        <Panel>{children}</Panel>
        {tenant?.contactEmail ? (
          <p className="text-muted-foreground text-center text-sm">
            Questions? Contact{' '}
            <a className="text-foreground underline underline-offset-4" href={`mailto:${tenant.contactEmail}`}>
              {tenant.name || tenant.contactEmail}
            </a>
          </p>
        ) : null}
      </div>
    </main>
  )
}

import { type ReactNode, useRef } from 'react'
import type { HostedInvoice } from '@fp/domain'
import { XIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Separator } from '@ui/components/primitives/separator'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@ui/components/primitives/sheet'
import { provenance } from '@ui/provenance'
import { Pill } from '../../shared/cells'
import { Money } from '../../shared/Money'
import { formatHostedDate } from './format'

/**
 * The full invoice behind a hosted invoice link: who it is from and to, every
 * line, the totals, and each payment attempt — Stripe's hosted invoice drawer.
 */
export const HostedInvoiceDetailsSheetProvenance = provenance({
  source: 'composition',
  composes: ['primitives/sheet', 'primitives/separator', 'shared/Money', 'shared/cells'],
  note: 'Hosted invoice details drawer; layout after ReUI receipt-1 items and totals.',
})

export interface HostedInvoiceDetailsSheetProps {
  /** `null` closes the drawer. */
  invoice: HostedInvoice | null
  onClose: () => void
  locale?: string
}

export function HostedInvoiceDetailsSheet({ invoice, onClose, locale }: HostedInvoiceDetailsSheetProps) {
  // Keep the last invoice so the drawer keeps its title and content while it animates closed.
  const shown = useRef(invoice)
  if (invoice) shown.current = invoice

  return (
    <Sheet open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent showCloseButton={false}>
        {shown.current ? <Details invoice={shown.current} onClose={onClose} locale={locale} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function Details({ invoice, onClose, locale }: { invoice: HostedInvoice; onClose: () => void; locale: string | undefined }) {
  const date = (value: Date) => formatHostedDate(value, locale)
  const money = (value: HostedInvoice['total']) => <Money value={value} {...(locale ? { locale } : {})} />

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="px-6 pt-4">
        <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onClose}>
          <XIcon aria-hidden="true" />
          Close invoice and payment details
        </Button>
      </div>

      <div className="flex flex-col gap-8 px-6 pt-4 pb-8">
        <div className="space-y-1">
          <SheetTitle className="text-2xl font-medium">{titleOf(invoice, date)}</SheetTitle>
          <SheetDescription className="sr-only">Invoice {invoice.number}</SheetDescription>
        </div>

        <Block title="Summary">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {invoice.customerName ? <Fact label="To">{invoice.customerName}</Fact> : null}
            {invoice.tenant.name ? <Fact label="From">{invoice.tenant.name}</Fact> : null}
            <Fact label="Invoice">{invoice.number}</Fact>
            {invoice.memo ? <Fact label="Memo">{invoice.memo}</Fact> : null}
          </dl>
        </Block>

        <Block title="Items">
          {invoice.lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">No line items on this invoice.</p>
          ) : (
            <ul className="divide-y">
              {invoice.lines.map((line) => (
                <li key={line.id || line.name} className="flex items-start justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{line.name}</p>
                    {line.quantity ? <p className="text-muted-foreground text-xs">Qty {line.quantity}</p> : null}
                  </div>
                  <span className="shrink-0 tabular-nums">{money(line.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <dl className="flex flex-col gap-2 pt-3 text-sm">
            <Total label="Subtotal">{money(invoice.subtotal)}</Total>
            {invoice.discount ? <Total label="Discount">{money(invoice.discount)}</Total> : null}
            {invoice.tax ? <Total label="Tax">{money(invoice.tax)}</Total> : null}
            <Total label="Total" strong>
              {money(invoice.total)}
            </Total>
          </dl>
          <Separator />
          <dl className="flex flex-col gap-2 pt-3 text-sm">
            <Total label="Amount paid">{money(invoice.amountPaid)}</Total>
            <Total label="Amount remaining" strong>
              {money(invoice.amountRemaining)}
            </Total>
          </dl>
        </Block>

        {invoice.payments.length > 0 ? (
          <Block title="Payment history">
            <ul className="divide-y">
              {invoice.payments.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0 space-y-1">
                    <p className="tabular-nums">{money(payment.amount)}</p>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span>{payment.method}</span>
                      {payment.status !== 'SUCCEEDED' ? (
                        <Pill tone={payment.status === 'FAILED' ? 'danger' : 'neutral'}>{statusLabel(payment.status)}</Pill>
                      ) : null}
                    </div>
                  </div>
                  {payment.at ? <span className="text-muted-foreground shrink-0 text-xs">{date(payment.at)}</span> : null}
                </li>
              ))}
            </ul>
          </Block>
        ) : null}

        {invoice.tenant.contactEmail ? (
          <p className="text-muted-foreground text-sm">
            Questions? Contact{' '}
            <a className="text-foreground underline underline-offset-4" href={`mailto:${invoice.tenant.contactEmail}`}>
              {invoice.tenant.name || invoice.tenant.contactEmail}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  )
}

function titleOf(invoice: HostedInvoice, date: (value: Date) => string): string {
  switch (invoice.state) {
    case 'paid':
      return invoice.paidAt ? `Paid on ${date(invoice.paidAt)}` : 'Invoice paid'
    case 'voided':
      return 'Invoice voided'
    case 'processing':
      return 'Payment processing'
    case 'open':
      return invoice.dueAt ? `Due ${date(invoice.dueAt)}` : 'Amount due'
  }
}

function statusLabel(status: string): string {
  const spaced = status.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-muted-foreground border-b pb-2 text-xs font-medium tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

function Total({ label, strong = false, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className={strong ? 'flex justify-between gap-4 font-medium' : 'flex justify-between gap-4'}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}

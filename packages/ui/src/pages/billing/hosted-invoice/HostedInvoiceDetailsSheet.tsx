import type { ReactNode } from 'react'
import type { HostedInvoice, HostedInvoiceParty, Money as MoneyValue } from '@fp/domain'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { Badge } from '@ui/components/reui/badge'
import { provenance } from '@ui/provenance'
import { formatHostedDate } from './format'

export const HostedInvoiceDetailsSheetProvenance = provenance({
  source: 'composition',
  composes: ['primitives/sheet', 'reui/badge'],
  note: "The hosted invoice redesign's 'All invoice details': dates, both parties' addresses, the memo and each payment attempt.",
})

export interface HostedInvoiceDetailsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: HostedInvoice
  /** "Due", "Overdue", "Paid": the summary card's word for the state. */
  status: { label: string; badge: StatusBadge }
  money: (value: MoneyValue) => ReactNode
  locale?: string | undefined
}

export type StatusBadge =
  'success-light' | 'warning-light' | 'destructive-light' | 'info-light' | 'secondary'

const PAYMENT_BADGE: Record<string, StatusBadge> = {
  SUCCEEDED: 'success-light',
  FAILED: 'destructive-light',
  PROCESSING: 'info-light',
  PENDING: 'info-light',
}

/** "PARTIALLY_REFUNDED" → "Partially refunded". */
function statusWords(status: string): string {
  const spaced = status.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Everything the summary card leaves out: who issued the invoice and who it is
 * for, with addresses, the memo, and every payment attempt, so a customer with
 * a failed card can see why the balance is still due.
 */
export function HostedInvoiceDetailsSheet({
  open,
  onOpenChange,
  invoice,
  status,
  money,
  locale,
}: HostedInvoiceDetailsSheetProps) {
  // Calendar dates, in UTC: the days the invoice PDF prints.
  const day = (value: Date) => formatHostedDate(value, locale, 'UTC')
  const period =
    invoice.periodStart && invoice.periodEnd
      ? `${day(invoice.periodStart)} – ${day(invoice.periodEnd)}`
      : null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Invoice details</SheetTitle>
          <SheetDescription className="font-mono">{invoice.number}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 overflow-y-auto px-6 pb-6 text-[13px]">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Invoice date">{invoice.issuedAt ? day(invoice.issuedAt) : '—'}</Field>
            <Field label="Due date">{invoice.dueAt ? day(invoice.dueAt) : '—'}</Field>
            <Field label="Billing period">{period ?? '—'}</Field>
            <Field label="Status">
              <Badge variant={status.badge} radius="full">
                {status.label}
              </Badge>
            </Field>
          </dl>

          <div className="grid grid-cols-1 gap-6 border-t pt-6 sm:grid-cols-2">
            <Party
              label="From"
              party={{
                name: invoice.tenant.name,
                email: invoice.tenant.contactEmail,
                address: invoice.tenant.address,
              }}
            />
            {invoice.customer ? <Party label="Billed to" party={invoice.customer} /> : null}
          </div>

          {invoice.memo ? (
            <section className="flex flex-col gap-1.5 border-t pt-6">
              <h3 className="text-muted-foreground text-xs">Memo</h3>
              <p className="leading-relaxed">{invoice.memo}</p>
            </section>
          ) : null}

          <section
            aria-labelledby="hosted-payments-heading"
            className="flex flex-col gap-3 border-t pt-6"
          >
            <h3 id="hosted-payments-heading" className="text-muted-foreground text-xs">
              Payments
            </h3>
            {invoice.payments.length === 0 ? (
              <p className="text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                    <span className="min-w-0 flex-1 font-medium">
                      {payment.method || 'Payment'}
                      {payment.at ? (
                        <span className="text-muted-foreground ml-2 text-xs font-normal">
                          {formatHostedDate(payment.at, locale)}
                        </span>
                      ) : null}
                    </span>
                    {payment.status ? (
                      <Badge variant={PAYMENT_BADGE[payment.status] ?? 'secondary'} radius="full">
                        {statusWords(payment.status)}
                      </Badge>
                    ) : null}
                    <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                      {money(payment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function Party({ label, party }: { label: string; party: HostedInvoiceParty }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-muted-foreground text-xs">{label}</h3>
      <address className="flex flex-col leading-relaxed not-italic">
        <span className="font-medium">{party.name || '—'}</span>
        {party.address.map((line) => (
          <span key={line}>{line}</span>
        ))}
        {party.email ? <span>{party.email}</span> : null}
      </address>
    </section>
  )
}

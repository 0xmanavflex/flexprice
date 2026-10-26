import { type ReactNode, useId, useState } from 'react'
import type {
  HostedInvoice,
  HostedInvoiceGroup,
  HostedInvoiceLine,
  Money as MoneyValue,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { ChevronDownIcon, ChevronRightIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { formatHostedDate } from './format'

export const HostedInvoiceChargesProvenance = provenance({
  source: 'composition',
  composes: ['primitives/button'],
  note: "The hosted invoice redesign's 'What you're paying for' panel: charges grouped by plan or add-on, each opening into how its amount was reached, over the invoice's totals.",
})

type Format = (value: MoneyValue) => ReactNode

export interface HostedInvoiceChargesProps {
  invoice: HostedInvoice
  money: Format
  locale?: string | undefined
}

/**
 * What the customer is paying for: one group per plan or add-on, a row per
 * charge, and the invoice's totals under them.
 *
 * A row shows what the charge comes to, with what it cost before a coupon or
 * credits struck through beside it, and opens into the arithmetic: quantity,
 * price, each amount taken off, and the total for the charge's own period.
 */
export function HostedInvoiceCharges({ invoice, money, locale }: HostedInvoiceChargesProps) {
  const count = invoice.lines.length
  return (
    <section
      aria-labelledby="hosted-charges-heading"
      className="bg-background flex min-w-0 flex-col overflow-hidden rounded-xl border"
    >
      <header className="flex items-baseline justify-between gap-3 border-b px-5 py-4">
        <h2 id="hosted-charges-heading" className="text-sm font-medium">
          What you’re paying for
        </h2>
        <span className="text-muted-foreground text-xs">
          {count} {count === 1 ? 'charge' : 'charges'}
        </span>
      </header>

      {invoice.groups.map((group) => (
        <ChargeGroup key={group.name} group={group} money={money} locale={locale} />
      ))}

      <Totals invoice={invoice} money={money} />
    </section>
  )
}

function ChargeGroup({
  group,
  money,
  locale,
}: {
  group: HostedInvoiceGroup
  money: Format
  locale?: string | undefined
}) {
  return (
    <section aria-label={group.name} className="border-b px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-muted-foreground text-[0.6875rem] font-medium tracking-[0.08em] uppercase">
          {group.name}
        </h3>
        <span className="text-muted-foreground text-xs tabular-nums">{money(group.total)}</span>
      </div>
      <ul className="mt-2 flex flex-col">
        {group.lines.map((line) => (
          <li key={line.id}>
            <ChargeRow line={line} money={money} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** `1,800` for a quantity the API sent as a decimal string; anything unparseable as is. */
function quantityText(quantity: string, locale?: string): string {
  const value = Number(quantity)
  return quantity !== '' && Number.isFinite(value)
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)
    : quantity
}

function periodText(line: HostedInvoiceLine, locale?: string): string | null {
  if (!line.periodStart || !line.periodEnd) return null
  // Calendar dates, in UTC: the days the invoice PDF prints.
  return `${formatHostedDate(line.periodStart, locale, 'UTC')} – ${formatHostedDate(line.periodEnd, locale, 'UTC')}`
}

function ChargeRow({
  line,
  money,
  locale,
}: {
  line: HostedInvoiceLine
  money: Format
  locale?: string | undefined
}) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const quantity = quantityText(line.quantity, locale)
  const period = periodText(line, locale)
  const adjusted = line.adjustments.length > 0
  const subtitle =
    line.kind === 'fixed' && line.unitPrice ? (
      <>
        {money(line.unitPrice)} {Number(line.quantity) === 1 ? 'each' : `× ${quantity}`}
      </>
    ) : (
      <>{quantity} used</>
    )

  return (
    <div className="flex flex-col">
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        // A whole row, not a button-shaped control: full width, wrapping, left aligned.
        className="hover:bg-muted/40 -mx-2 h-auto w-[calc(100%+1rem)] items-start justify-start gap-2 px-2 py-2.5 text-left font-normal whitespace-normal aria-expanded:bg-transparent"
      >
        {open ? (
          <ChevronDownIcon aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        ) : (
          <ChevronRightIcon aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium break-words">{line.name}</span>
          <span className="text-muted-foreground text-xs">{subtitle}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="text-sm font-medium tabular-nums">{money(line.amount)}</span>
          {adjusted ? (
            <s className="text-muted-foreground text-xs tabular-nums">
              <span className="sr-only">was </span>
              {money(line.gross)}
            </s>
          ) : period ? (
            <span className="text-muted-foreground text-xs">{period}</span>
          ) : null}
        </span>
      </Button>

      {open ? (
        <dl id={bodyId} className="mb-2 ml-6 flex flex-col gap-1.5 border-l pl-4 text-xs">
          {line.kind === 'fixed' && line.unitPrice ? (
            <Row
              label={
                <>
                  {quantity} × {money(line.unitPrice)}
                </>
              }
            >
              {money(line.gross)}
            </Row>
          ) : (
            <Row label="Usage">{quantity}</Row>
          )}
          {line.included ? (
            <Row label="Included in your plan">{quantityText(line.included, locale)}</Row>
          ) : null}
          {adjusted ? <Row label="Subtotal">{money(line.gross)}</Row> : null}
          {line.adjustments.map((adjustment) => (
            <Row
              key={adjustment.label}
              label={adjustment.label}
              tone={adjustment.label.startsWith('Prepaid') ? 'success' : 'default'}
            >
              −{money(adjustment.amount)}
            </Row>
          ))}
          <Row label={period ? `Total (${period})` : 'Total'} strong>
            {money(line.amount)}
          </Row>
        </dl>
      ) : null}
    </div>
  )
}

function Row({
  label,
  children,
  strong = false,
  tone = 'default',
}: {
  label: ReactNode
  children: ReactNode
  strong?: boolean
  tone?: 'default' | 'success'
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4',
        strong && 'text-foreground mt-1 border-t pt-2 font-medium',
      )}
    >
      <dt className={cn(!strong && 'text-muted-foreground')}>{label}</dt>
      <dd className={cn('tabular-nums', tone === 'success' && 'text-success')}>{children}</dd>
    </div>
  )
}

/** Subtotal, what was taken off, tax, and what is left to pay. */
function Totals({ invoice, money }: { invoice: HostedInvoice; money: Format }) {
  const settledOrVoid = invoice.state === 'paid' || invoice.state === 'voided'
  const paid = !settledOrVoid && Number(invoice.amountPaid.amount) !== 0
  return (
    // Each group already ends in a rule, so the totals need none of their own.
    <div className="px-5 py-4">
      <dl className="ml-auto flex w-full flex-col gap-2 text-[13px] sm:max-w-sm">
        <TotalRow label="Subtotal">{money(invoice.subtotal)}</TotalRow>
        {invoice.discount ? (
          <TotalRow label="Discounts">−{money(invoice.discount)}</TotalRow>
        ) : null}
        {invoice.prepaidCredits ? (
          <TotalRow label="Prepaid credits" tone="success">
            −{money(invoice.prepaidCredits)}
          </TotalRow>
        ) : null}
        {invoice.taxes.map((tax) => (
          <TotalRow
            key={`${tax.name}-${tax.rate}`}
            label={tax.rate ? `${tax.name} (${tax.rate})` : tax.name}
          >
            {money(tax.amount)}
          </TotalRow>
        ))}
        <TotalRow label="Total" strong divided>
          {money(invoice.total)}
        </TotalRow>
        {paid ? <TotalRow label="Paid">−{money(invoice.amountPaid)}</TotalRow> : null}
        {invoice.state === 'open' || invoice.state === 'processing' ? (
          <TotalRow label="Amount due" strong>
            {money(invoice.amountRemaining)}
          </TotalRow>
        ) : null}
      </dl>
    </div>
  )
}

function TotalRow({
  label,
  children,
  strong = false,
  divided = false,
  tone = 'default',
}: {
  label: string
  children: ReactNode
  strong?: boolean
  /** A rule above the row, for the total (a separator cannot sit inside a `dl`). */
  divided?: boolean
  tone?: 'default' | 'success'
}) {
  return (
    <div
      className={cn('flex items-baseline justify-between gap-4', divided && 'mt-1 border-t pt-2.5')}
    >
      <dt className={cn(strong ? 'text-foreground font-medium' : 'text-muted-foreground')}>
        {label}
      </dt>
      <dd
        className={cn(
          'tabular-nums',
          strong ? 'text-foreground font-medium' : 'text-foreground',
          tone === 'success' && 'text-success',
        )}
      >
        {children}
      </dd>
    </div>
  )
}

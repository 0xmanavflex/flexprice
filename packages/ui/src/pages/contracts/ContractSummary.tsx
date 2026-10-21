import {
  BillingCycle,
  BillingModel,
  type Charge,
  type CreateSubscription,
  InvoiceCadence,
  PriceType,
} from '@fp/domain'
import { FormPreview, PreviewRow, PreviewRows } from '@ui/compositions/forms/FormPreview'
import { provenance } from '@ui/provenance'

/**
 * The running summary beside the contract wizard: what has been chosen so far,
 * and what the first invoice will bill.
 *
 * The first invoice is worked out here, from the plan's charges as this
 * contract changes them — Flexprice has no preview for a contract that does not
 * exist yet. Only charges billed up front are counted (a fixed charge in
 * advance, at its quantity, at the overridden flat price when there is one);
 * usage bills at the end of the period, so it is said, not guessed. Whatever
 * the estimate leaves out (proration, add-ons, taxes, coupons) the card says.
 */
export const ContractSummaryProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-preview'],
  note: 'Summary + First invoice cards in the contract wizard rail (FormPreview, card variant).',
})

export interface ContractSummaryProps {
  values: CreateSubscription
  customerLabel: string | undefined
  planLabel: string | undefined
  /** The charges this contract bills, as the form selected them. */
  charges: readonly Charge[]
  /** Today, as `YYYY-MM-DD`; injectable for stories and tests. */
  today?: string
}

const PERIOD_NOUN: Record<string, [string, string]> = {
  DAILY: ['day', 'days'],
  WEEKLY: ['week', 'weeks'],
  MONTHLY: ['month', 'months'],
  QUARTERLY: ['quarter', 'quarters'],
  HALF_YEARLY: ['half-year', 'half-years'],
  ANNUAL: ['year', 'years'],
}

/** "every month", "every 3 months". */
export function everyPeriod(period: string, count: number): string {
  const [one, many] = PERIOD_NOUN[period] ?? [period.toLowerCase(), period.toLowerCase()]
  return count > 1 ? `every ${count} ${many}` : `every ${one}`
}

/** `YYYY-MM-DD` as "Oct 20, 2026". */
export function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? day
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00`)
  date.setDate(date.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "Oct 20, 2026 → until cancelled". */
export function runsText(values: CreateSubscription, today: string): string {
  const end = values.phases[values.phases.length - 1]?.endDate
  return `${formatDay(values.startDate || today)} → ${end ? formatDay(end) : 'until cancelled'}`
}

export function moneyText(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(code) ? code : 'USD',
      currencyDisplay: 'narrowSymbol',
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
}

export interface FirstInvoiceEstimate {
  amount: number
  /** `YYYY-MM-DD` the invoice is raised on. */
  date: string
  /** What the figure is, and what it leaves out. */
  note: string
}

/**
 * What the first invoice bills up front, and when.
 *
 * Null until there is a plan, a currency and its charges to read.
 */
export function firstInvoiceEstimate(
  values: CreateSubscription,
  charges: readonly Charge[],
  today: string = localToday(),
): FirstInvoiceEstimate | null {
  if (!values.planId || !values.currency) return null
  const phase = values.phases[0]
  const trial = values.trialPeriodDays ?? 0
  const date = addDays(values.startDate || today, trial)

  let amount = 0
  for (const charge of charges) {
    if (charge.type !== PriceType.Fixed || charge.invoiceCadence !== InvoiceCadence.Advance)
      continue
    const override = phase?.priceOverrides.find((o) => o.priceId === charge.id)
    const unit =
      override?.billingModel === BillingModel.FlatFee
        ? Number(override.amount)
        : Number(charge.amount)
    const quantity = Number(phase?.quantities.find((q) => q.priceId === charge.id)?.quantity || 1)
    if (Number.isFinite(unit) && Number.isFinite(quantity)) amount += unit * quantity
  }
  for (const extra of phase?.extraCharges ?? []) {
    const { charge } = extra
    if (charge.type !== PriceType.Fixed || !('amount' in charge) || !charge.amount) continue
    const value = Number(charge.amount) * Number(extra.quantity || 1)
    if (Number.isFinite(value)) amount += value
  }

  const when =
    trial > 0 ? `On ${formatDay(date)}, after the ${trial}-day trial.` : `On ${formatDay(date)}.`
  const what =
    amount > 0
      ? 'Fixed charges billed up front; usage is billed at the end of the period.'
      : 'Nothing is billed up front; usage is billed at the end of the period.'
  const leftOut = [
    values.billingCycle === BillingCycle.Calendar ? 'proration to the 1st' : null,
    values.billingAnchor ? `proration to ${formatDay(values.billingAnchor)}` : null,
    values.addons.length > 0 ? 'add-ons' : null,
    values.phases.some((p) => p.discounts.length > 0) ? 'coupons' : null,
    values.taxes.length > 0 ? 'taxes' : null,
  ].filter(Boolean)
  const before = leftOut.length > 0 ? ` Before ${leftOut.join(', ')}.` : ''
  return { amount, date, note: `${when} ${what}${before}` }
}

/** The customer's name, without the email the picker shows beside it. */
function nameOf(label: string | undefined): string | undefined {
  return label?.split(' · ')[0]
}

export function ContractSummary({
  values,
  customerLabel,
  planLabel,
  charges,
  today = localToday(),
}: ContractSummaryProps) {
  const invoice = firstInvoiceEstimate(values, charges, today)
  const dash = '—'
  return (
    <div className="flex flex-col gap-4">
      <FormPreview title="Summary" variant="card">
        <PreviewRows>
          <PreviewRow label="Customer" value={nameOf(customerLabel) ?? dash} />
          <PreviewRow label="Plan" value={planLabel ?? dash} />
          <PreviewRow
            label="Billing"
            value={
              values.planId && values.currency
                ? `${values.currency.toUpperCase()}, ${everyPeriod(values.billingPeriod, values.billingPeriodCount)}`
                : dash
            }
          />
          <PreviewRow
            label="Bill on"
            value={
              values.billingAnchor
                ? formatDay(values.billingAnchor)
                : values.billingCycle === BillingCycle.Calendar
                  ? 'The 1st'
                  : 'Start date'
            }
          />
          <PreviewRow label="Runs" value={runsText(values, today)} />
          <PreviewRow
            label="Free trial"
            value={values.trialPeriodDays ? `${values.trialPeriodDays} days` : 'None'}
          />
        </PreviewRows>
      </FormPreview>
      {invoice ? (
        <section
          aria-label="First invoice"
          className="bg-background flex flex-col gap-1 rounded-xl border p-5"
        >
          <h2 className="text-muted-foreground text-xs">First invoice</h2>
          <p className="text-2xl font-medium tabular-nums">
            {moneyText(invoice.amount, values.currency)}
          </p>
          <p className="text-muted-foreground text-xs/relaxed">{invoice.note}</p>
        </section>
      ) : null}
    </div>
  )
}

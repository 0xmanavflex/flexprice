import { useMemo, useState, type ReactNode } from 'react'
import {
  AccountState,
  type CheckoutDetails,
  SELF_BILLING_PLAN,
  checkoutDetailsSchema,
  countryOptions,
  longDate,
  planRateText,
  usd,
} from '@fp/domain'
import flexpriceIcon from '@ui/assets/flexprice-icon.png'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Spinner } from '@ui/components/primitives/spinner'
import { Field } from '@ui/compositions/forms/Field'
import { InfoHint } from '@ui/compositions/forms/InfoHint'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
import { usePublishDetailTrail } from '@ui/compositions/shell/ShellDetailTrail'
import { ArrowLeftIcon, CheckIcon, LockIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * Upgrade: on the left (gray gradient) the price and how billing works, so it
 * is clear what is paid when; on the right the billing details. Every Upgrade
 * button lands here: the trial, the locked account, the pill.
 *
 * Company and address come from Settings → Organization: when they are there
 * the form opens filled in and says so; the first time it opens empty and says
 * what is typed is saved there. Continue hands the details to the caller, which
 * saves them and sends the browser to Stripe Checkout.
 */
export const UpgradeViewProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/button',
    'ui/input',
    'ui/spinner',
    'compositions/field',
    'compositions/info-hint',
    'compositions/option-combobox',
  ],
  note: 'Self-billing Upgrade page (reference go-live): offer on a gray gradient, billing details form.',
})

export interface UpgradeViewProps {
  state: AccountState
  /** The trial's event cap, when the summary has one. */
  eventCap: number | null
  /** The form's opening values: from Organization when it exists, else just the billing email. */
  defaultValues: CheckoutDetails
  /** Organization already holds the company and address. */
  fromOrganization: boolean
  /** Today, as `YYYY-MM-DD`: the first monthly invoice falls a month after it. */
  today: string
  /** Opening checkout: the button spins and waits. */
  submitting: boolean
  submitError?: string | null
  onBack: () => void
  onSubmit: (details: CheckoutDetails) => void
}

const GRAY_GROUND =
  'bg-[linear-gradient(160deg,var(--color-zinc-50)_0%,var(--color-zinc-100)_45%,var(--color-zinc-200)_100%)] dark:bg-[linear-gradient(160deg,var(--color-zinc-900)_0%,var(--color-zinc-950)_100%)]'

function monthAfter(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 10)
}

/** What is due now, and what every invoice after it is made of. */
function BillingBox({ today }: { today: string }) {
  const base = usd(SELF_BILLING_PLAN.base)
  const steps: [string, string, string][] = [
    ['Today', base, 'The platform fee for your first month.'],
    [
      `From ${longDate(monthAfter(today))}, monthly`,
      `${base} + ${planRateText}`,
      'The platform fee, plus a share of what you invoice your customers through Flexprice in production.',
    ],
  ]
  return (
    <div className="bg-background flex flex-col rounded-xl border shadow-xs">
      <div className="flex items-baseline justify-between gap-4 px-5 py-4">
        <span className="text-sm font-medium">Due today</span>
        <span className="text-xl font-medium tracking-tight tabular-nums">{base}</span>
      </div>
      <div className="border-t px-5 py-4">
        <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          How you&apos;re billed
        </h2>
        <ol className="flex flex-col">
          {steps.map(([when, amount, what], i) => (
            <li key={when} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 ? (
                <span aria-hidden className="bg-border absolute top-4 left-[3.5px] h-full w-px" />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  'relative mt-1.5 size-2 shrink-0 rounded-full',
                  i === 0 ? 'bg-primary' : 'bg-muted-foreground/40',
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-medium">{when}</span>
                  <span className="tabular-nums">{amount}</span>
                </div>
                <p className="text-muted-foreground text-xs">{what}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground mt-4 border-t border-dashed pt-3 text-xs">
          Events in your sandbox and during the trial are never charged.
        </p>
      </div>
    </div>
  )
}

function Offer({
  state,
  eventCap,
  today,
  onBack,
}: Pick<UpgradeViewProps, 'state' | 'eventCap' | 'today' | 'onBack'>) {
  const locked = state === AccountState.Suspended
  const benefits = [
    ...(locked ? ['Your account can be edited again'] : []),
    'A production environment is created',
    `The ${eventCap?.toLocaleString('en-US') ?? 'trial'} event limit is lifted`,
    'Your sandbox stays as it is',
  ]
  return (
    <section
      aria-label="Upgrade Flexprice"
      className={cn('flex flex-col gap-8 px-10 py-8 lg:border-r 2xl:px-14', GRAY_GROUND)}
    >
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground -ml-2.5 w-fit hover:bg-transparent"
        onClick={onBack}
      >
        <ArrowLeftIcon aria-hidden />
        Usage &amp; billing
      </Button>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-7 pb-6">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            {locked ? 'Upgrade to unlock your account' : 'Upgrade Flexprice'}
          </p>
          <p className="text-4xl font-medium tracking-tight tabular-nums">
            {usd(SELF_BILLING_PLAN.base)}
            <span className="text-muted-foreground text-base font-normal"> a month</span>
          </p>
          <p className="text-muted-foreground text-[13px]">
            {SELF_BILLING_PLAN.name}, plus {planRateText} of what you bill through Flexprice in
            production.
          </p>
        </div>
        <BillingBox today={today} />
        <ul className="flex flex-col gap-2 text-[13px]">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2">
              <CheckIcon aria-hidden className="text-success mt-0.5 size-3.5 shrink-0" />
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

type Errors = Partial<Record<keyof CheckoutDetails, string>>

function errorsOf(details: CheckoutDetails): Errors {
  const parsed = checkoutDetailsSchema.safeParse(details)
  if (parsed.success) return {}
  const errors: Errors = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof CheckoutDetails
    errors[key] ??= issue.message
  }
  return errors
}

export function UpgradeView({
  state,
  eventCap,
  defaultValues,
  fromOrganization,
  today,
  submitting,
  submitError,
  onBack,
  onSubmit,
}: UpgradeViewProps) {
  const [details, setDetails] = useState<CheckoutDetails>(defaultValues)
  const [tried, setTried] = useState(false)
  const countries = useMemo(
    () => countryOptions().map((o) => ({ value: o.code, label: o.label })),
    [],
  )
  const errors = tried ? errorsOf(details) : {}
  const addressError = errors.country ?? errors.line1 ?? errors.city ?? errors.postalCode
  const set = (key: keyof CheckoutDetails) => (value: string) =>
    setDetails((current) => ({ ...current, [key]: value }))
  // The header names the page: Settings › Usage & billing › Upgrade, the middle crumb the way back.
  usePublishDetailTrail([{ label: 'Usage & billing', onClick: onBack }, { label: 'Upgrade' }])

  const submit = () => {
    setTried(true)
    const parsed = checkoutDetailsSchema.safeParse(details)
    if (parsed.success) onSubmit(parsed.data)
  }

  const input = (
    key: keyof CheckoutDetails,
    props: { placeholder?: string; type?: string; label?: string } = {},
    field: { id?: string; 'aria-describedby'?: string | undefined } = {},
  ): ReactNode => (
    <Input
      {...field}
      type={props.type}
      placeholder={props.placeholder}
      aria-label={props.label}
      aria-invalid={errors[key] ? true : undefined}
      value={details[key]}
      onChange={(event) => set(key)(event.target.value)}
    />
  )

  return (
    // `flex-1`, not `min-h-full`: the shell's scroller also holds the header,
    // so a full-height page under it always overflowed by the header's height.
    <div className="grid flex-1 lg:grid-cols-2">
      <Offer state={state} eventCap={eventCap} today={today} onBack={onBack} />
      <section
        aria-labelledby="upgrade-billing-details"
        className="flex flex-col gap-8 px-10 py-8 2xl:px-14"
      >
        <div className="flex justify-end">
          <img src={flexpriceIcon} alt="Flexprice" className="size-7" />
        </div>
        <form
          noValidate
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 pb-6"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <h1
            id="upgrade-billing-details"
            className="flex items-center gap-2 text-xl font-medium tracking-tight"
          >
            Billing details
            <InfoHint>
              {fromOrganization
                ? 'Filled in from your organization details. A change here updates them too.'
                : "Saved to your organization details, so you won't enter them again."}
            </InfoHint>
          </h1>
          <Field
            label="Company name"
            hint="Shown on your Flexprice invoices. Kept in Settings → Organization."
            error={errors.name}
          >
            {(field) => input('name', {}, field)}
          </Field>
          <Field
            label="Billing email"
            hint="Receives Flexprice invoices and payment receipts."
            error={errors.email}
          >
            {(field) => input('email', { type: 'email' }, field)}
          </Field>
          <Field label="Address" hint="Kept in Settings → Organization." error={addressError}>
            {({ id }) => (
              <div className="flex flex-col gap-2">
                <OptionCombobox
                  id={id}
                  value={details.country || undefined}
                  onValueChange={set('country')}
                  options={countries}
                  placeholder="Country"
                  searchable
                  aria-invalid={errors.country ? true : undefined}
                />
                {input('line1', { placeholder: 'Street', label: 'Street' })}
                <div className="grid grid-cols-3 gap-2">
                  {input('city', { placeholder: 'City', label: 'City' })}
                  {input('state', { placeholder: 'State', label: 'State' })}
                  {input('postalCode', { placeholder: 'Postal code', label: 'Postal code' })}
                </div>
              </div>
            )}
          </Field>
          <Field label="Tax ID (optional)">
            {(field) => input('taxId', { placeholder: 'VAT, GST or EIN' }, field)}
          </Field>
          {submitError ? (
            <p role="alert" className="text-destructive text-sm">
              {submitError}
            </p>
          ) : null}
          <Button type="submit" className="mt-2 h-10" disabled={submitting}>
            {submitting ? <Spinner /> : null}
            {submitting ? 'Opening checkout…' : 'Continue to payment'}
          </Button>
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
            <LockIcon aria-hidden className="size-3" />
            You enter your card on Stripe&apos;s secure page next.
          </p>
        </form>
      </section>
    </div>
  )
}

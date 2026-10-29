import { type ReactNode } from 'react'
import {
  type CheckoutOutcome,
  type SelfBillingPlan,
  longDate,
  planFixedTotal,
  planMoney,
  planPriceText,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Spinner } from '@ui/components/primitives/spinner'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  ClockIcon,
  DownloadIcon,
} from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * Back from Stripe Checkout. The page polls the checkout until it settles:
 * confirming, then paid, declined or left; still confirming after about a
 * minute. Paid adds the receipt and the first steps in production.
 */
export const CheckoutReturnViewProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/spinner'],
  note: 'Self-billing checkout return page (reference checkout): five states, receipt and next steps.',
})

export type NextStep = 'api-key' | 'events' | 'plans'

export interface CheckoutReturnViewProps {
  outcome: CheckoutOutcome
  /** Where the receipt and the "we'll email you" go. */
  billingEmail: string
  /** The invoice the payment settled, once the summary lists it. */
  paidInvoice: { number: string; pdfUrl: string | null; total: number; currency: string } | null
  /** The plan the account is now on, from the billing summary. Null while unknown. */
  plan: SelfBillingPlan | null
  /** `YYYY-MM-DD` the next invoice is raised, when known. */
  nextInvoiceOn: string | null
  onBilling: () => void
  onUpgrade: () => void
  onCheckAgain: () => void
  onOpenProduction: () => void
  onNextStep: (step: NextStep) => void
}

/** What was paid: the settled invoice's total, else the plan's flat fees. Null when neither is known. */
function paidAmount({
  paidInvoice,
  plan,
}: Pick<CheckoutReturnViewProps, 'paidInvoice' | 'plan'>): string | null {
  if (paidInvoice) return planMoney(paidInvoice.total, paidInvoice.currency)
  const fixed = planFixedTotal(plan)
  return fixed ? planMoney(fixed.amount, fixed.currency) : null
}

interface Result {
  icon: ReactNode
  tone: string
  title: string
  body: ReactNode
  actions: ReactNode
}

function resultOf(props: CheckoutReturnViewProps): Result {
  const amount = paidAmount(props)
  const back = (
    <Button variant="outline" onClick={props.onBilling}>
      Usage &amp; billing
    </Button>
  )
  switch (props.outcome) {
    case 'processing':
      return {
        icon: <Spinner className="size-5" />,
        tone: 'text-muted-foreground bg-muted',
        title: 'Confirming your payment',
        body: `Stripe is confirming your payment${amount ? ` of ${amount}` : ''}. This usually takes a few seconds; keep this page open.`,
        actions: null,
      }
    case 'success':
      return {
        icon: <CircleCheckIcon aria-hidden />,
        tone: 'text-success bg-success/10',
        title: "You're live",
        body: (
          <>
            Thanks for upgrading Flexprice.{' '}
            <span className="text-foreground font-medium">
              Your production environment is ready
            </span>{' '}
            and the event limit is lifted.
          </>
        ),
        actions: (
          <Button onClick={props.onOpenProduction}>
            Open production
            <ArrowUpRightIcon aria-hidden />
          </Button>
        ),
      }
    case 'failed':
      return {
        icon: <CircleAlertIcon aria-hidden />,
        tone: 'text-destructive bg-destructive/10',
        title: "Your payment didn't go through",
        body: 'Your card was declined. Nothing was charged. Try again, or use another card.',
        actions: (
          <>
            {back}
            <Button onClick={props.onUpgrade}>Try again</Button>
          </>
        ),
      }
    case 'canceled':
      return {
        icon: <CircleSlashIcon aria-hidden />,
        tone: 'text-muted-foreground bg-muted',
        title: 'You left checkout before paying',
        body: 'Nothing was charged and your account is as it was.',
        actions: (
          <>
            {back}
            <Button onClick={props.onUpgrade}>Back to checkout</Button>
          </>
        ),
      }
    case 'slow':
      return {
        icon: <ClockIcon aria-hidden />,
        tone: 'text-warning-foreground bg-warning/15',
        title: 'Still confirming',
        body: `Your bank is taking longer than usual. You can keep working; we'll email ${props.billingEmail} when it's done.`,
        actions: (
          <>
            {back}
            <Button onClick={props.onCheckAgain}>Check again</Button>
          </>
        ),
      }
  }
}

/** Paid: the receipt, and when the next invoice comes. */
function Receipt({
  billingEmail,
  paidInvoice,
  plan,
  nextInvoiceOn,
}: Pick<CheckoutReturnViewProps, 'billingEmail' | 'paidInvoice' | 'plan' | 'nextInvoiceOn'>) {
  const amount = paidAmount({ paidInvoice, plan })
  const charges = planPriceText(plan)
  const rows: [string, ReactNode][] = [
    ...(amount ? ([['Paid', <span className="tabular-nums">{amount}</span>]] as [string, ReactNode][]) : []),
    ...(paidInvoice
      ? ([
          [
            'Paid invoice',
            paidInvoice.pdfUrl ? (
              <a
                href={paidInvoice.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                <span className="font-mono text-xs">{paidInvoice.number}</span>
                <span className="text-muted-foreground text-xs">Download</span>
                <DownloadIcon aria-hidden className="text-muted-foreground size-3.5" />
              </a>
            ) : (
              <span className="font-mono text-xs">{paidInvoice.number}</span>
            ),
          ],
        ] as [string, ReactNode][])
      : []),
    ['Event limit', 'Lifted'],
    ['Receipt sent to', billingEmail],
    ...(nextInvoiceOn
      ? ([
          [
            'Next invoice',
            <span className="flex flex-col items-end">
              <span className="tabular-nums">{longDate(nextInvoiceOn)}</span>
              {charges ? <span className="text-muted-foreground text-xs">{charges}</span> : null}
            </span>,
          ],
        ] as [string, ReactNode][])
      : []),
  ]
  return (
    <dl className="divide-border/70 w-full divide-y rounded-xl border text-left text-[13px]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const STEPS: [NextStep, string, string][] = [
  ['api-key', 'Create a production API key', "Your sandbox keys don't work in production."],
  ['events', 'Send events to production', 'Point your servers at the production key.'],
  ['plans', 'Set up your plans', 'Copy plans and features over from your sandbox.'],
]

/** Paid: what to do first in production. */
function NextSteps({ onNextStep }: Pick<CheckoutReturnViewProps, 'onNextStep'>) {
  return (
    <div className="flex w-full flex-col gap-2 text-left">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Next steps
      </h2>
      <ol className="divide-border/70 divide-y rounded-xl border">
        {STEPS.map(([step, title, body], i) => (
          <li key={step}>
            <button
              type="button"
              className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
              onClick={() => onNextStep(step)}
            >
              <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] font-medium">{title}</span>
                <span className="text-muted-foreground text-xs">{body}</span>
              </span>
              <ArrowRightIcon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function CheckoutReturnView(props: CheckoutReturnViewProps) {
  const result = resultOf(props)
  const paid = props.outcome === 'success'
  return (
    <div className="flex flex-1 justify-center px-10 py-16">
      <div
        className={cn(
          'flex w-full max-w-md flex-col items-center gap-6 text-center',
          !paid && 'my-auto',
        )}
      >
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-6">
          <span
            className={cn(
              'flex size-11 items-center justify-center rounded-full [&_svg]:size-5',
              result.tone,
            )}
          >
            {result.icon}
          </span>
          <div className="flex flex-col items-center gap-1.5">
            <h1 className="text-xl font-medium tracking-tight">{result.title}</h1>
            <p className="text-muted-foreground max-w-sm text-sm">{result.body}</p>
          </div>
        </div>
        {result.actions ? (
          <div className="flex flex-wrap justify-center gap-2">{result.actions}</div>
        ) : null}
        {paid ? (
          <>
            <Receipt
              billingEmail={props.billingEmail}
              paidInvoice={props.paidInvoice}
              plan={props.plan}
              nextInvoiceOn={props.nextInvoiceOn}
            />
            <NextSteps onNextStep={props.onNextStep} />
          </>
        ) : null}
      </div>
    </div>
  )
}

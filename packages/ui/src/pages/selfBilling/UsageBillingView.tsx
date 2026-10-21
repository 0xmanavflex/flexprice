import {
  AccountState,
  SELF_BILLING_PLAN,
  type SelfBillingInvoice,
  type SelfBillingSummary,
  URGENT_SHARE,
  daysUntil,
  lockReason,
  longDate,
  planRateText,
  usd,
} from '@fp/domain'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { Button } from '@ui/components/primitives/button'
import { SegmentMeter, SimpleTable } from '@ui/compositions/detail/DetailKit'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { Section } from '@ui/compositions/layout/Section'
import { DelayedHint, SettingsBlock } from '@ui/compositions/layout/SettingsBlock'
import { SettingRow, SettingsFieldGroup } from '@ui/compositions/layout/settingsSurface'
import {
  AlertCircleIcon,
  ArrowUpRightIcon,
  DownloadIcon,
  GaugeIcon,
  TrendingUpIcon,
} from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Status } from '../shared/cells'

/**
 * Settings → Usage & billing: the tenant's own Flexprice account — plan,
 * trial, usage, invoices, billing details. Not the Billing area for its
 * customers. Built as the other settings panels are: untitled settings blocks,
 * one info strip at the top of a block, actions in its footer bar.
 */
export const UsageBillingViewProvenance = provenance({
  source: 'composition',
  composes: [
    '@reui/alert',
    'ui/button',
    'compositions/detail-kit',
    'compositions/section-empty',
    'compositions/section',
    'compositions/settings-block',
    'compositions/settings-surface',
  ],
  note: 'Self-billing Usage & billing page (reference settings/billing): locked alert, plan, usage, invoices, billing details.',
})

export interface UsageBillingViewProps {
  summary: SelfBillingSummary
  /** Today, as `YYYY-MM-DD`; injectable for stories and tests. */
  today: string
  /** Settings → Organization's billing email. */
  billingEmail: string
  onUpgrade: () => void
  /** Opens the billing portal: pay an invoice, change the card. */
  onOpenPortal: () => void
  /** The portal link is being created. */
  portalPending?: boolean
  portalError?: string | null
}

const planPrice = `${usd(SELF_BILLING_PLAN.base)} a month + ${planRateText}`
const unpaid = (summary: SelfBillingSummary) => summary.invoices.find((i) => i.status !== 'paid')

/** Locked only: the page cannot open quietly on a read-only account. */
function LockedAlert({
  summary,
  today,
  onUpgrade,
}: Pick<UsageBillingViewProps, 'summary' | 'today' | 'onUpgrade'>) {
  if (summary.state !== AccountState.Suspended) return null
  const cap = summary.events?.cap?.toLocaleString('en-US') ?? ''
  return (
    <Alert variant="destructive" className="px-4 py-3.5">
      <AlertCircleIcon aria-hidden />
      <AlertTitle>Your account is locked and read-only</AlertTitle>
      <AlertDescription>
        <p className="max-w-md text-pretty">
          {lockReason(summary, today) === 'event_limit'
            ? `You used all ${cap} trial events. Events are still being recorded. Upgrade to make changes again and use production.`
            : `Your trial ended${summary.trialEndsOn ? ` on ${longDate(summary.trialEndsOn)}` : ''}. Events are still being recorded. Upgrade to make changes again and use production.`}
        </p>
      </AlertDescription>
      <div className="col-start-2 flex justify-end pt-2">
        <Button size="sm" onClick={onUpgrade}>
          Upgrade
        </Button>
      </div>
    </Alert>
  )
}

function PlanBlock({
  summary,
  today,
  onUpgrade,
  onOpenPortal,
  portalPending,
}: Omit<UsageBillingViewProps, 'billingEmail'>) {
  const { state } = summary
  const left = summary.trialEndsOn ? daysUntil(summary.trialEndsOn, today) : 0
  const ends = summary.trialEndsOn ? longDate(summary.trialEndsOn) : ''
  const byLimit = state === AccountState.Suspended && lockReason(summary, today) === 'event_limit'
  const nextInvoice = state === AccountState.Active ? (summary.period?.end ?? null) : null
  const due = unpaid(summary)
  return (
    <SettingsBlock
      label="Plan"
      flush
      info={
        state === AccountState.Trialing ? (
          <span>
            Your trial ends on {ends}, in {left} days. Then {usd(SELF_BILLING_PLAN.base)} a month +{' '}
            {planRateText} of what you bill through Flexprice.
          </span>
        ) : nextInvoice ? (
          <span>Next invoice on {longDate(nextInvoice)}.</span>
        ) : undefined
      }
      actions={
        state === AccountState.Trialing ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">
              Upgrade to use production and lift the event limit.
            </span>
            <Button onClick={onUpgrade}>Upgrade</Button>
          </div>
        ) : state === AccountState.Active ? (
          <Button variant="outline" disabled={portalPending} onClick={onOpenPortal}>
            Manage billing
            <ArrowUpRightIcon aria-hidden />
          </Button>
        ) : undefined
      }
    >
      <SettingsFieldGroup legend="Plan" description="Your Flexprice plan and its dates.">
        <SettingRow title="Plan">
          <span className="text-sm">
            {state === AccountState.Trialing || byLimit
              ? `Free trial, ${SELF_BILLING_PLAN.trialDays} days`
              : `${SELF_BILLING_PLAN.name} · ${planPrice}`}
          </span>
        </SettingRow>
        {state === AccountState.Active && !nextInvoice ? null : (
          <SettingRow
            title={
              state === AccountState.Active
                ? 'Next invoice'
                : state === AccountState.Trialing
                  ? 'Trial ends'
                  : 'Trial ended'
            }
          >
            <span
              className={cn(
                'text-sm tabular-nums',
                state === AccountState.Suspended && !byLimit && 'text-destructive',
              )}
            >
              {state === AccountState.Active && nextInvoice
                ? longDate(nextInvoice)
                : state === AccountState.Trialing
                  ? `${ends} · ${left} days left`
                  : byLimit
                    ? 'Event limit reached'
                    : `${ends}${due ? ` · ${usd(due.total)} overdue` : ''}`}
            </span>
          </SettingRow>
        )}
        <SettingRow
          title="Environments"
          titleAddon={
            <DelayedHint text="A production environment is created when you upgrade. Your sandbox stays as it is." />
          }
          last
        >
          <span className="text-sm">
            {state === AccountState.Active
              ? 'Sandbox, Production'
              : state === AccountState.Trialing
                ? 'Sandbox'
                : 'Sandbox, read-only'}
          </span>
        </SettingRow>
      </SettingsFieldGroup>
    </SettingsBlock>
  )
}

const meterTone = (share: number) =>
  share >= 1 ? 'bg-destructive' : share >= URGENT_SHARE ? 'bg-warning' : 'bg-primary'

/** The two things Flexprice meters on the tenant, side by side. */
function UsageBlock({ summary, today }: { summary: SelfBillingSummary; today: string }) {
  const used = summary.events?.used ?? 0
  const cap = summary.events?.cap ?? null
  const share = cap ? used / cap : 0
  const billed = summary.billed ?? 0
  const locked =
    summary.state === AccountState.Suspended && lockReason(summary, today) === 'event_limit'
  return (
    <SettingsBlock
      label="Usage"
      flush
      info={
        summary.period ? (
          <span>
            This period: {longDate(summary.period.start)} – {longDate(summary.period.end)}.
          </span>
        ) : undefined
      }
    >
      <div className="grid md:grid-cols-2 md:divide-x">
        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-muted-foreground flex items-center gap-2 text-[13px] [&_svg]:size-4">
            <GaugeIcon aria-hidden />
            Events ingested
            <DelayedHint
              text={
                cap
                  ? `The trial includes ${cap.toLocaleString('en-US')} events. When they're used up your account is locked until you upgrade. Events are still recorded.`
                  : 'Events your servers sent this period. Your plan has no limit.'
              }
            />
          </p>
          <p className="tabular-nums">
            <span className="text-2xl font-medium tracking-tight">
              {used.toLocaleString('en-US')}
            </span>
            {cap ? (
              <span className="text-muted-foreground text-sm">
                {' '}
                of {cap.toLocaleString('en-US')}
              </span>
            ) : null}
          </p>
          {locked ? (
            <p className="text-destructive text-[13px]">Limit reached</p>
          ) : cap ? (
            <SegmentMeter value={Math.min(1, share)} segments={40} color={meterTone(share)} />
          ) : (
            <p className="text-muted-foreground text-[13px]">No limit on your plan</p>
          )}
          {summary.state === AccountState.Trialing && cap && share >= URGENT_SHARE ? (
            <p className="text-warning-foreground text-[13px]">
              At {cap.toLocaleString('en-US')} your account is locked until you upgrade.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 border-t px-5 py-4 md:border-t-0">
          <p className="text-muted-foreground flex items-center gap-2 text-[13px] [&_svg]:size-4">
            <TrendingUpIcon aria-hidden />
            Billed through Flexprice
            <DelayedHint
              text={`What you invoiced your customers this period. Flexprice charges ${planRateText} of it once you're live.`}
            />
          </p>
          <p className="text-2xl font-medium tracking-tight tabular-nums">{usd(billed)}</p>
          <p className="text-muted-foreground text-[13px] tabular-nums">
            {summary.state === AccountState.Active
              ? `${planRateText} fee so far: ${usd(Math.round(billed * SELF_BILLING_PLAN.rate * 100) / 100)}`
              : 'No fee during the trial'}
          </p>
        </div>
      </div>
    </SettingsBlock>
  )
}

function InvoicesSection({
  summary,
  today,
  onOpenPortal,
  portalPending,
}: Pick<UsageBillingViewProps, 'summary' | 'today' | 'onOpenPortal' | 'portalPending'>) {
  const byLimit =
    lockReason(summary, today) === 'event_limit' && summary.state === AccountState.Suspended
  return (
    <Section title="Invoices" flush table showTitle>
      {summary.invoices.length > 0 ? (
        <SimpleTable<SelfBillingInvoice>
          rows={summary.invoices}
          columns={[
            {
              key: 'number',
              header: 'Invoice number',
              className: 'w-36',
              cell: (i) => <span className="font-mono text-xs">{i.number}</span>,
            },
            {
              key: 'due',
              header: 'Due date',
              className: 'w-32',
              cell: (i) => (
                <span className="text-muted-foreground">
                  {i.dueDate ? longDate(i.dueDate) : '—'}
                </span>
              ),
            },
            {
              key: 'amount',
              header: 'Amount',
              className: 'w-32',
              cell: (i) => <span className="tabular-nums">{usd(i.total)}</span>,
            },
            {
              key: 'status',
              header: 'Payment status',
              className: 'w-36',
              cell: (i) => <Status value={i.status} />,
            },
            {
              key: 'action',
              header: '',
              className: 'w-20',
              cell: (i) => (
                <div className="flex justify-end">
                  {i.status === 'paid' ? (
                    i.pdfUrl ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground size-7"
                        nativeButton={false}
                        render={
                          <a
                            href={i.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            role="link"
                            aria-label={`Download ${i.number}`}
                          />
                        }
                      >
                        <DownloadIcon aria-hidden />
                      </Button>
                    ) : null
                  ) : (
                    <Button
                      size="sm"
                      className="h-7"
                      disabled={portalPending}
                      onClick={onOpenPortal}
                    >
                      Pay
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      ) : (
        <SectionEmpty
          title="No invoices yet"
          description={
            byLimit || !summary.trialEndsOn
              ? 'Your first invoice is raised when you upgrade.'
              : `Your first invoice is raised when you upgrade, or when your trial ends on ${longDate(summary.trialEndsOn)}.`
          }
        />
      )}
    </Section>
  )
}

function BillingDetails({
  summary,
  billingEmail,
  onOpenPortal,
  portalPending,
}: Pick<UsageBillingViewProps, 'summary' | 'billingEmail' | 'onOpenPortal' | 'portalPending'>) {
  const active = summary.state === AccountState.Active
  return (
    <SettingsBlock
      label="Billing details"
      flush
      info={
        <span>The company name and address on your Flexprice invoices come from Organization.</span>
      }
      actions={
        <Button variant="outline" disabled={!active || portalPending} onClick={onOpenPortal}>
          Update in billing portal
          <ArrowUpRightIcon aria-hidden />
        </Button>
      }
    >
      <SettingsFieldGroup
        legend="Billing details"
        description="Where Flexprice sends invoices and how you pay."
      >
        <SettingRow
          title="Billing email"
          titleAddon={<DelayedHint text="Receives Flexprice invoices and payment receipts." />}
          last={active}
        >
          <span className={cn('text-sm', !billingEmail && 'text-muted-foreground')}>
            {billingEmail || '—'}
          </span>
        </SettingRow>
        {active ? null : (
          <SettingRow title="Payment method" last>
            <span className="text-muted-foreground text-sm">Added when you upgrade</span>
          </SettingRow>
        )}
      </SettingsFieldGroup>
    </SettingsBlock>
  )
}

export function UsageBillingView(props: UsageBillingViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <LockedAlert summary={props.summary} today={props.today} onUpgrade={props.onUpgrade} />
      {props.portalError ? (
        <p role="alert" className="text-destructive text-sm">
          {props.portalError}
        </p>
      ) : null}
      <PlanBlock {...props} />
      <UsageBlock summary={props.summary} today={props.today} />
      <InvoicesSection {...props} />
      <BillingDetails {...props} />
    </div>
  )
}

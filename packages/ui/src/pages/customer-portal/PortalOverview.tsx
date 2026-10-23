import {
  type PortalGateway,
  type PortalInvoice,
  type PortalPaymentMethod,
  type PortalSubscription,
  type PortalView,
  isPayable,
  periodProgress,
  totalDue,
} from '@fp/domain'
import {
  AlertCircleIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  CreditCardIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ReceiptIcon,
  RepeatIcon,
  StarIcon,
  Trash2Icon,
  WalletIcon,
} from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { IconTile } from '@ui/components/reui/icon-tile'
import { type SimpleColumn, SimpleTable } from '@ui/compositions/detail/DetailKit'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { Money } from '../shared/Money'
import { CardLogo } from './CardLogo'
import { formatDate, formatNumber, relativeDays } from './format'
import { Loaded, PortalEmpty, SubscriptionStatusPill, SummaryCell } from './parts'
import type { CustomerPortalData } from './types'

/**
 * The portal's first page, after the portal prototype (`portal/overview.tsx`):
 * a payment alert when an invoice is unpaid past its date, the account summary
 * (next billing and amount due coupled, credit balance on its own), saved
 * cards, and the plans on the account.
 */
export const PortalOverviewProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/Section',
    'compositions/detail/DetailKit',
    'primitives/dropdown-menu',
    'reui/icon-tile',
    'shared/Money',
  ],
  note: 'Customer portal overview, after the portal prototype: payment alert, account summary, payment methods, subscriptions.',
})

export interface PortalOverviewProps {
  brandName: string | null
  data: CustomerPortalData
  now: Date
  locale: string | undefined
  onGoTo: (view: PortalView) => void
  onPay: (invoice: PortalInvoice) => void
  onViewInvoice: (invoice: PortalInvoice) => void
  onAddCredits: () => void
  onAddCard: () => void
  onRemoveCard: (card: PortalPaymentMethod) => void
  onMakeDefault: (card: PortalPaymentMethod) => void
}

export function PortalOverview(props: PortalOverviewProps) {
  const invoices = props.data.invoices.status === 'ready' ? props.data.invoices.data : []
  const payable = invoices.filter(isPayable)
  // The one to chase: a failed payment first, then the oldest overdue.
  const attention =
    payable.find((i) => i.status === 'failed') ??
    [...payable]
      .filter((i) => i.status === 'overdue')
      .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))[0]

  return (
    <div className="flex flex-col gap-6">
      {attention ? <PaymentAlert invoice={attention} {...props} /> : null}
      <AccountSummary {...props} />
      <PaymentMethods {...props} />
      <Subscriptions {...props} />
    </div>
  )
}

/** A neutral card with a red signal: the alert should not paint the whole page red. */
function PaymentAlert({
  invoice,
  locale,
  onPay,
  onViewInvoice,
}: PortalOverviewProps & { invoice: PortalInvoice }) {
  const amount = <Money value={invoice.amountDue} {...(locale ? { locale } : {})} />
  return (
    <section
      role="alert"
      className="bg-background flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border p-4 pl-5 shadow-xs"
    >
      <IconTile
        size="default"
        variant="soft"
        className="text-destructive-foreground dark:text-destructive"
        aria-hidden="true"
      >
        <AlertCircleIcon />
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {invoice.status === 'failed'
            ? 'Your last payment didn’t go through'
            : 'An invoice is past its due date'}
        </p>
        <p className="text-muted-foreground text-[13px]">
          {invoice.number} for {amount}
          {invoice.dueAt ? <> was due {formatDate(invoice.dueAt, locale)}</> : null}. Pay it now to
          keep your service running.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="h-8 px-3" onClick={() => onViewInvoice(invoice)}>
          View invoice
        </Button>
        <Button className="h-8 px-3" onClick={() => onPay(invoice)}>
          Pay {amount}
        </Button>
      </div>
    </section>
  )
}

function CellSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-6 py-5" aria-hidden="true">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-24" />
    </div>
  )
}

/** Next billing and amount due coupled in one block; credit balance on its own. Three equal columns. */
function AccountSummary({ data, now, locale, onGoTo, onPay, onAddCredits }: PortalOverviewProps) {
  const money = (value: Parameters<typeof Money>[0]['value']) => (
    <Money value={value} {...(locale ? { locale } : {})} />
  )

  const next =
    data.subscriptions.status === 'ready'
      ? data.subscriptions.data
          .filter((s) => s.periodEnd && (s.status === 'active' || s.status === 'trialing'))
          .sort((a, b) => (a.periodEnd?.getTime() ?? 0) - (b.periodEnd?.getTime() ?? 0))[0]
      : undefined

  const invoices = data.invoices.status === 'ready' ? data.invoices.data : []
  const due = totalDue(invoices)
  const firstPayable = invoices.find(isPayable)
  const overdue = invoices.some(
    (i) => isPayable(i) && (i.status === 'overdue' || i.status === 'failed'),
  )

  const wallets = data.wallets.status === 'ready' ? data.wallets.data : []
  const wallet = wallets.find((w) => w.active)

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <section className="bg-background grid rounded-xl border sm:col-span-2 sm:grid-cols-2 sm:divide-x">
        {data.subscriptions.status !== 'ready' ? (
          <CellSkeleton />
        ) : (
          <SummaryCell
            icon={<CalendarClockIcon />}
            label="Next billing"
            value={
              next?.periodEnd ? (
                formatDate(next.periodEnd, locale)
              ) : (
                <span className="text-muted-foreground">No upcoming bill</span>
              )
            }
            hint={
              next?.periodEnd
                ? `${next.planName} plan · ${relativeDays(next.periodEnd, now)}`
                : 'You’re not on a plan yet'
            }
            action={next ? { label: 'See usage so far', run: () => onGoTo('usage') } : undefined}
          />
        )}
        <div className="border-t sm:border-t-0">
          {data.invoices.status !== 'ready' ? (
            <CellSkeleton />
          ) : due ? (
            <SummaryCell
              icon={<ReceiptIcon />}
              label="Amount due"
              value={money(due.amount)}
              hint={
                overdue
                  ? 'Overdue'
                  : firstPayable?.dueAt
                    ? `Due ${formatDate(firstPayable.dueAt, locale)}`
                    : 'Unpaid'
              }
              tone={overdue ? 'danger' : 'muted'}
              action={
                due.count + due.others > 1
                  ? { label: 'See unpaid invoices', run: () => onGoTo('invoices') }
                  : firstPayable
                    ? { label: 'Pay now', run: () => onPay(firstPayable) }
                    : undefined
              }
            />
          ) : (
            <SummaryCell
              icon={<ReceiptIcon />}
              label="Amount due"
              value={
                <>
                  <CircleCheckIcon
                    className="text-success-foreground dark:text-success size-5"
                    aria-hidden="true"
                  />
                  {invoices.length ? 'All paid up' : 'Nothing due'}
                </>
              }
              hint={invoices.length ? 'Every invoice is paid' : 'No invoices yet'}
              action={
                invoices.length
                  ? { label: 'View invoices', run: () => onGoTo('invoices') }
                  : undefined
              }
            />
          )}
        </div>
      </section>
      <section className="bg-background rounded-xl border">
        {data.wallets.status !== 'ready' ? (
          <CellSkeleton />
        ) : (
          <SummaryCell
            icon={<WalletIcon />}
            label="Credit balance"
            value={
              wallet ? (
                money(wallet.balance)
              ) : (
                <span className="text-muted-foreground">No credits</span>
              )
            }
            hint={
              wallet
                ? `${formatNumber(wallet.credits, locale)} credits`
                : 'Credits aren’t set up on your account'
            }
            action={wallet ? { label: 'Add credits', run: onAddCredits } : undefined}
          />
        )}
      </section>
    </div>
  )
}

/** Saved cards: default, remove, add. */
function PaymentMethods({ data, onAddCard, onRemoveCard, onMakeDefault }: PortalOverviewProps) {
  const gateways: PortalGateway[] = data.gateways.status === 'ready' ? data.gateways.data : []
  const canAdd = gateways.some((g) => g.savesCards)
  const managed = (card: PortalPaymentMethod) =>
    gateways.some((g) => g.provider === card.provider && g.savesCards)
  return (
    <Section
      title="Payment methods"
      description="Used for invoices and automatic top-ups"
      flush
      action={
        canAdd ? (
          <Button variant="outline" size="sm" className="h-8 px-3" onClick={onAddCard}>
            <PlusIcon aria-hidden="true" />
            Add card
          </Button>
        ) : undefined
      }
    >
      <Loaded load={data.paymentMethods} label="payment methods">
        {(cards) =>
          cards.length === 0 ? (
            <PortalEmpty
              icon={<CreditCardIcon />}
              title="No saved cards"
              description="Save a card to pay invoices in one click and turn on automatic top-ups."
            />
          ) : (
            <ul className="divide-border/50 divide-y">
              {cards.map((card) => {
                const label = `${card.brand} •••• ${card.last4}`
                return (
                  <li key={card.id} className="flex items-center gap-3 px-6 py-3.5">
                    <CardLogo network={card.network} label={card.brand} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm">
                        {label}
                        {card.isDefault ? (
                          <span className="bg-muted text-muted-foreground rounded-full px-2 py-px text-xs">
                            Default
                          </span>
                        ) : null}
                        {card.expired ? (
                          <span className="bg-destructive/10 text-destructive-foreground dark:text-destructive rounded-full px-2 py-px text-xs">
                            Expired
                          </span>
                        ) : null}
                      </p>
                      {card.expires ? (
                        <p className="text-muted-foreground text-xs">Expires {card.expires}</p>
                      ) : null}
                    </div>
                    {managed(card) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground size-8"
                              aria-label={`Options for ${label}`}
                            />
                          }
                        >
                          <MoreHorizontalIcon aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            disabled={card.isDefault || card.expired}
                            onClick={() => onMakeDefault(card)}
                          >
                            <StarIcon aria-hidden="true" />
                            Make default
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onRemoveCard(card)}
                          >
                            <Trash2Icon aria-hidden="true" />
                            Remove card
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )
        }
      </Loaded>
    </Section>
  )
}

/** Read-only, as the portal API allows: one row per plan with its period and renewal. */
function Subscriptions({ brandName, data, now, locale }: PortalOverviewProps) {
  return (
    <Section
      title="Subscriptions"
      description={`Plans on your account. To change a plan, contact ${brandName ?? 'your account team'}.`}
      flush
    >
      <Loaded load={data.subscriptions} label="subscriptions">
        {(subscriptions) =>
          subscriptions.length === 0 ? (
            <PortalEmpty
              icon={<RepeatIcon />}
              title="No active plan"
              description={`When ${brandName ?? 'your account team'} puts you on a plan, its billing period and renewal date show here.`}
            />
          ) : (
            <SimpleTable rows={subscriptions} columns={subscriptionColumns(now, locale)} />
          )
        }
      </Loaded>
    </Section>
  )
}

function subscriptionColumns(
  now: Date,
  locale: string | undefined,
): SimpleColumn<PortalSubscription>[] {
  return [
    {
      key: 'plan',
      header: 'Plan',
      cell: (s) => (
        <span className="flex items-center gap-3">
          <IconTile size="sm" variant="outline" className="text-foreground/70" aria-hidden="true">
            <RepeatIcon />
          </IconTile>
          <span>
            <span className="block text-sm font-medium">{s.planName}</span>
            {s.cadence ? (
              <span className="text-muted-foreground block text-xs">{s.cadence}</span>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (s) => <SubscriptionStatusPill status={s.status} label={s.statusLabel} />,
    },
    {
      key: 'period',
      header: 'Current period',
      cell: (s) => {
        const progress = periodProgress(s.periodStart, s.periodEnd, now)
        return (
          <span className="block w-56 space-y-1.5">
            <span className="text-muted-foreground flex justify-between text-xs tabular-nums">
              <span>
                {s.periodStart && s.periodEnd
                  ? `${formatDate(s.periodStart, locale)} – ${formatDate(s.periodEnd, locale)}`
                  : '—'}
              </span>
              {progress ? <span>Day {progress.day}</span> : null}
            </span>
            {progress ? (
              <span
                className="bg-muted block h-1 overflow-hidden rounded-full"
                role="progressbar"
                aria-label="Period elapsed"
                aria-valuemin={0}
                aria-valuemax={progress.days}
                aria-valuenow={progress.day}
              >
                <span
                  className="bg-primary block h-full rounded-full"
                  style={{ width: `${progress.fraction * 100}%` }}
                />
              </span>
            ) : null}
          </span>
        )
      },
    },
    {
      key: 'next',
      header: 'Next',
      cell: (s) => {
        const trialEnds = s.status === 'trialing' && s.trialEnd
        const next = trialEnds ? s.trialEnd : (s.cancelAt ?? s.periodEnd)
        const note = trialEnds
          ? 'Trial ends, billing starts'
          : s.cancelAt
            ? 'Plan ends'
            : s.status === 'paused'
              ? 'Paused'
              : 'Renews and invoices'
        return (
          <span>
            <span className="block text-sm">{next ? formatDate(next, locale) : '—'}</span>
            <span className="text-muted-foreground block text-xs">{note}</span>
          </span>
        )
      },
    },
  ]
}

import {
  type PortalGateway,
  type PortalInvoice,
  type PortalPaymentMethod,
  type PortalSubscription,
  type PortalView,
  type PortalWallet,
  isPayable,
  periodProgress,
} from '@fp/domain'
import {
  CalendarClockIcon,
  CircleAlertIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ReceiptTextIcon,
  RepeatIcon,
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@ui/components/primitives/item'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { Badge } from '@ui/components/reui/badge'
import { IconTile } from '@ui/components/reui/icon-tile'
import { type SimpleColumn, SimpleTable } from '@ui/compositions/detail/DetailKit'
import { provenance } from '@ui/provenance'
import { Money } from '../shared/Money'
import { formatDate, formatNumber, formatRange, relativeDays } from './format'
import {
  CardMark,
  FigureTile,
  FigureTileSkeleton,
  Loaded,
  PortalCard,
  PortalEmpty,
  SubscriptionStatusPill,
} from './parts'
import type { CustomerPortalData } from './types'

/**
 * The portal's first page: a banner when a payment failed, three figures
 * (next billing, amount due, credit balance), saved cards, and the plans on
 * the account.
 */
export const PortalOverviewProvenance = provenance({
  source: 'composition',
  composes: [
    'reui/alert',
    'primitives/item',
    'compositions/detail/DetailKit',
    'primitives/dropdown-menu',
    'reui/badge',
    'shared/Money',
  ],
  note: 'Customer portal overview, after the reference portal: payment banner, figure tiles, payment methods, subscriptions.',
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
  const { data, locale } = props
  const invoices = data.invoices.status === 'ready' ? data.invoices.data : []
  const payable = invoices.filter(isPayable)
  // The one to chase: a failed payment first, then the oldest overdue.
  const attention =
    payable.find((i) => i.status === 'failed') ??
    [...payable]
      .filter((i) => i.status === 'overdue')
      .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))[0]

  return (
    <>
      {attention ? (
        <PaymentBanner
          invoice={attention}
          locale={locale}
          onPay={props.onPay}
          onView={props.onViewInvoice}
        />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="bg-card grid overflow-hidden rounded-xl border max-sm:divide-y sm:grid-cols-2 sm:divide-x">
          <NextBilling {...props} />
          <AmountDue payable={payable} {...props} />
        </div>
        <div className="bg-card overflow-hidden rounded-xl border">
          <CreditBalance {...props} />
        </div>
      </div>
      <PaymentMethods {...props} />
      <Subscriptions {...props} />
    </>
  )
}

function PaymentBanner({
  invoice,
  locale,
  onPay,
  onView,
}: {
  invoice: PortalInvoice
  locale: string | undefined
  onPay: (invoice: PortalInvoice) => void
  onView: (invoice: PortalInvoice) => void
}) {
  const failed = invoice.status === 'failed'
  const amount = <Money value={invoice.amountDue} {...(locale ? { locale } : {})} />
  return (
    <Alert variant="destructive" className="bg-card px-5 py-4">
      <CircleAlertIcon aria-hidden="true" />
      <AlertTitle>
        {failed ? 'Your last payment didn’t go through' : 'You have an overdue invoice'}
      </AlertTitle>
      <AlertDescription>
        <p>
          {invoice.number} for {amount}
          {invoice.dueAt ? ` was due ${formatDate(invoice.dueAt, locale)}` : ' is unpaid'}. Pay it
          now to keep your service running.
        </p>
      </AlertDescription>
      <AlertAction>
        <Button variant="outline" onClick={() => onView(invoice)}>
          View invoice
        </Button>
        <Button onClick={() => onPay(invoice)}>Pay {amount}</Button>
      </AlertAction>
    </Alert>
  )
}

function NextBilling({ data, now, locale, onGoTo }: PortalOverviewProps) {
  if (data.subscriptions.status !== 'ready') return <FigureTileSkeleton />
  const next = data.subscriptions.data
    .filter((s) => s.periodEnd && (s.status === 'active' || s.status === 'trialing'))
    .sort((a, b) => (a.periodEnd?.getTime() ?? 0) - (b.periodEnd?.getTime() ?? 0))[0]
  return (
    <FigureTile
      icon={<CalendarClockIcon />}
      label="Next billing"
      value={next?.periodEnd ? formatDate(next.periodEnd, locale) : 'No active plan'}
      caption={
        next?.periodEnd
          ? `${next.planName} plan · ${relativeDays(next.periodEnd, now)}`
          : 'Nothing is scheduled to bill.'
      }
      action={
        next ? (
          <Button variant="link" size="sm" onClick={() => onGoTo('usage')}>
            See usage so far
          </Button>
        ) : null
      }
    />
  )
}

function AmountDue({
  data,
  payable,
  locale,
  onPay,
  onGoTo,
}: PortalOverviewProps & { payable: PortalInvoice[] }) {
  if (data.invoices.status !== 'ready') return <FigureTileSkeleton />
  // Amounts in more than one currency are not summed: the tile shows the first, and says there is more.
  const first = payable[0]
  if (!first) {
    const currency = data.invoices.data[0]?.currency ?? 'USD'
    return (
      <FigureTile
        icon={<ReceiptTextIcon />}
        label="Amount due"
        value={<Money value={{ amount: '0', currency }} {...(locale ? { locale } : {})} />}
        caption="You’re all paid up"
        action={
          <Button variant="link" size="sm" onClick={() => onGoTo('invoices')}>
            View invoices
          </Button>
        }
      />
    )
  }
  const overdue = payable.some((i) => i.status === 'overdue' || i.status === 'failed')
  const more = payable.length - 1
  return (
    <FigureTile
      icon={<ReceiptTextIcon />}
      label="Amount due"
      value={<Money value={first.amountDue} {...(locale ? { locale } : {})} />}
      caption={
        overdue
          ? more > 0
            ? `Overdue · ${more} more unpaid`
            : 'Overdue'
          : first.dueAt
            ? `Due ${formatDate(first.dueAt, locale)}${more > 0 ? ` · ${more} more unpaid` : ''}`
            : 'Unpaid'
      }
      captionTone={overdue ? 'danger' : 'muted'}
      action={
        <Button
          variant="link"
          size="sm"
          onClick={() => (more > 0 ? onGoTo('invoices') : onPay(first))}
        >
          {more > 0 ? 'See unpaid invoices' : 'Pay now'}
        </Button>
      }
    />
  )
}

function CreditBalance({ data, locale, onAddCredits, onGoTo }: PortalOverviewProps) {
  if (data.wallets.status !== 'ready') return <FigureTileSkeleton />
  const wallet: PortalWallet | undefined =
    data.wallets.data.find((w) => w.active) ?? data.wallets.data[0]
  if (!wallet) {
    return (
      <FigureTile
        icon={<WalletIcon />}
        label="Credit balance"
        value="No wallet"
        caption="Prepaid credits show up here once you have a wallet."
      />
    )
  }
  return (
    <FigureTile
      icon={<WalletIcon />}
      label="Credit balance"
      value={<Money value={wallet.balance} {...(locale ? { locale } : {})} />}
      caption={`${formatNumber(wallet.credits, locale)} credits`}
      action={
        wallet.active ? (
          <Button variant="link" size="sm" onClick={onAddCredits}>
            Add credits
          </Button>
        ) : (
          <Button variant="link" size="sm" onClick={() => onGoTo('credits')}>
            View credits
          </Button>
        )
      }
    />
  )
}

function PaymentMethods({ data, onAddCard, onRemoveCard, onMakeDefault }: PortalOverviewProps) {
  const gateways: PortalGateway[] = data.gateways.status === 'ready' ? data.gateways.data : []
  const canAdd = gateways.some((g) => g.savesCards)
  const managed = (card: PortalPaymentMethod) =>
    gateways.some((g) => g.provider === card.provider && g.savesCards)
  return (
    <PortalCard
      title="Payment methods"
      description="Used for invoices and automatic top-ups"
      action={
        canAdd ? (
          <Button variant="outline" onClick={onAddCard}>
            <PlusIcon aria-hidden="true" />
            Add card
          </Button>
        ) : null
      }
    >
      <Loaded load={data.paymentMethods} label="payment methods">
        {(cards) =>
          cards.length === 0 ? (
            <PortalEmpty
              title="No saved cards"
              description={
                canAdd
                  ? 'Save a card to pay invoices in one click and turn on automatic top-ups.'
                  : 'Cards you save at checkout show up here.'
              }
            />
          ) : (
            <ItemGroup className="gap-0 divide-y">
              {cards.map((card) => (
                <Item key={card.id} role="listitem" className="rounded-none px-6 py-4">
                  <ItemMedia>
                    <CardMark mark={card.mark} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {card.brand} •••• {card.last4}
                      {card.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                      {card.expired ? <Badge variant="destructive-light">Expired</Badge> : null}
                    </ItemTitle>
                    {card.expires ? (
                      <ItemDescription>Expires {card.expires}</ItemDescription>
                    ) : null}
                  </ItemContent>
                  {managed(card) ? (
                    <ItemActions>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${card.brand} ending ${card.last4}`}
                            />
                          }
                        >
                          <MoreHorizontalIcon aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={card.isDefault || card.expired}
                            onClick={() => onMakeDefault(card)}
                          >
                            Make default
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onRemoveCard(card)}
                          >
                            Remove card
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ItemActions>
                  ) : null}
                </Item>
              ))}
            </ItemGroup>
          )
        }
      </Loaded>
    </PortalCard>
  )
}

function Subscriptions({ brandName, data, now, locale }: PortalOverviewProps) {
  return (
    <PortalCard
      title="Subscriptions"
      description={`Plans on your account. To change a plan, contact ${brandName ?? 'your account team'}.`}
    >
      <Loaded load={data.subscriptions} label="subscriptions">
        {(subscriptions) =>
          subscriptions.length === 0 ? (
            <PortalEmpty
              title="No active plans"
              description="When you subscribe to a plan, its period and renewal date show up here."
            />
          ) : (
            <SimpleTable rows={subscriptions} columns={subscriptionColumns(now, locale)} />
          )
        }
      </Loaded>
    </PortalCard>
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
        <div className="flex items-center gap-3">
          <IconTile size="sm" variant="outline" aria-hidden="true">
            <RepeatIcon />
          </IconTile>
          <div>
            <p className="font-medium">{s.planName}</p>
            {s.cadence ? <p className="text-muted-foreground text-xs">{s.cadence}</p> : null}
          </div>
        </div>
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
          <div className="flex w-56 flex-col gap-1.5">
            <div className="text-muted-foreground flex justify-between gap-3 text-xs">
              <span>{formatRange(s.periodStart, s.periodEnd, locale)}</span>
              {progress ? <span>Day {progress.day}</span> : null}
            </div>
            {progress ? (
              <div
                className="bg-muted h-1 overflow-hidden rounded-full"
                role="progressbar"
                aria-label="Period elapsed"
                aria-valuemin={0}
                aria-valuemax={progress.days}
                aria-valuenow={progress.day}
              >
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${progress.fraction * 100}%` }}
                />
              </div>
            ) : null}
          </div>
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
          <>
            <p>{next ? formatDate(next, locale) : '—'}</p>
            <p className="text-muted-foreground text-xs">{note}</p>
          </>
        )
      },
    },
  ]
}

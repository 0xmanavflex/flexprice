import { type ReactNode, useState } from 'react'
import {
  type PortalTopUp,
  type PortalTransactionDirection,
  type PortalWallet,
  creditsCost,
  walletFlows,
} from '@fp/domain'
import { PlusIcon, WalletIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { Section } from '@ui/compositions/layout/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { DetailTable, type DetailColumn } from '../shared/DetailTable'
import { Money } from '../shared/Money'
import { formatDate, formatNumber } from './format'
import { LedgerRow, Loaded, PortalEmpty } from './parts'
import type { CustomerPortalData } from './types'

/**
 * One credit wallet, after the portal prototype (`portal/credits.tsx`): name
 * and actions on top, then the balance beside what was added and used this
 * billing period; below, every top-up with what is left of it, or every
 * transaction.
 */
export const PortalCreditsProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/Section',
    'pages/shared/DetailTable',
    'primitives/select',
    'primitives/tabs',
    'shared/Money',
  ],
  note: 'Customer portal credits, after the portal prototype: wallet panel, top-ups table, transaction history.',
})

export interface PortalCreditsProps {
  data: CustomerPortalData
  walletId: string | null
  /** The current billing period's start: "Added since …" and "Used since …". */
  periodStart: Date | null
  onWalletChange: (walletId: string) => void
  onAddCredits: () => void
  onAutoTopup: () => void
  onShowMore: () => void
  locale: string | undefined
}

export function PortalCredits(props: PortalCreditsProps) {
  return (
    <Loaded load={props.data.wallets} label="credits" rows={4}>
      {(wallets) => {
        const wallet = wallets.find((w) => w.id === props.walletId) ?? wallets[0]
        if (!wallet) {
          return (
            <Section title="Credits" flush>
              <PortalEmpty
                icon={<WalletIcon />}
                title="No credit wallet yet"
                description="Prepaid credits show up here once your account has a wallet. Contact your account team to set one up."
              />
            </Section>
          )
        }
        return <Wallet {...props} wallets={wallets} wallet={wallet} />
      }}
    </Loaded>
  )
}

function Wallet(props: PortalCreditsProps & { wallets: PortalWallet[]; wallet: PortalWallet }) {
  const { data, wallets, wallet, locale } = props
  const [view, setView] = useState<'topups' | 'transactions'>('topups')
  const [kind, setKind] = useState<'all' | PortalTransactionDirection>('all')

  return (
    <div className="flex flex-col gap-5">
      <WalletPanel {...props} wallets={wallets} wallet={wallet} />
      <Section
        title={view === 'topups' ? 'Top-ups' : 'Transaction history'}
        description={
          view === 'topups'
            ? 'Every credit added, what is left of it, and when it expires.'
            : 'Every credit added to and used from this wallet'
        }
        flush
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {view === 'transactions' ? (
              <Tabs value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
                <TabsList aria-label="Show" className="bg-muted/60 h-9 rounded-lg p-1">
                  <TabsTrigger value="all" className="h-7 px-3 text-[13px] font-normal">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="in" className="h-7 px-3 text-[13px] font-normal">
                    Added
                  </TabsTrigger>
                  <TabsTrigger value="out" className="h-7 px-3 text-[13px] font-normal">
                    Used
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}
            <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
              <TabsList aria-label="View" className="bg-muted/60 h-9 rounded-lg p-1">
                <TabsTrigger value="topups" className="h-7 px-3 text-[13px] font-normal">
                  Top-ups
                </TabsTrigger>
                <TabsTrigger value="transactions" className="h-7 px-3 text-[13px] font-normal">
                  All transactions
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
      >
        {view === 'topups' ? (
          <TopUps topUps={data.topUps} wallet={wallet} locale={locale} />
        ) : (
          <Transactions {...props} kind={kind} />
        )}
      </Section>
    </div>
  )
}

/** The wallet's name and actions, then balance beside what was added and used this period. */
function WalletPanel({
  data,
  wallets,
  wallet,
  periodStart,
  onWalletChange,
  onAddCredits,
  onAutoTopup,
  locale,
}: PortalCreditsProps & { wallets: PortalWallet[]; wallet: PortalWallet }) {
  const money = (value: PortalWallet['balance']) => (
    <Money value={value} {...(locale ? { locale } : {})} />
  )
  const transactions = data.transactions.status === 'ready' ? data.transactions.data.items : null
  const flows = transactions ? walletFlows(transactions, wallet.currency) : null
  const since = periodStart ? ` since ${formatDate(periodStart, locale)}` : ''
  const on = wallet.autoTopup?.enabled ?? false

  return (
    <section className="bg-background rounded-xl border" aria-label={wallet.name}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div className="flex items-center gap-2 text-sm">
          {wallets.length > 1 ? (
            // With more than one wallet, the name is the switcher.
            <Select
              value={wallet.id}
              onValueChange={(value) => value !== null && onWalletChange(value)}
            >
              <SelectTrigger
                size="sm"
                className="hover:bg-muted/60 -ml-2 h-8 gap-1.5 border-transparent px-2 text-sm font-medium shadow-none"
                aria-label="Wallet"
              >
                <SelectValue>{(value) => wallets.find((w) => w.id === value)?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                {wallets.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="font-medium">{wallet.name}</span>
          )}
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[13px]">
            <span
              className={cn(
                'size-1.5 rounded-full',
                wallet.active ? 'bg-success' : 'bg-muted-foreground',
              )}
              aria-hidden="true"
            />
            <span>{wallet.statusLabel}</span>
            <span aria-hidden="true">·</span>
            <span>
              1 credit = {money({ amount: wallet.creditPrice, currency: wallet.currency })}
            </span>
          </span>
        </div>
        {wallet.active ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-8 px-3" onClick={onAutoTopup}>
              <span
                className={cn('size-1.5 rounded-full', on ? 'bg-success' : 'bg-muted-foreground')}
                aria-hidden="true"
              />
              Auto top-up {on ? 'on' : 'off'}
            </Button>
            <Button className="h-8 px-3.5" onClick={onAddCredits}>
              <PlusIcon aria-hidden="true" />
              Add credits
            </Button>
          </div>
        ) : null}
      </div>
      <div className="grid sm:grid-cols-3 sm:divide-x">
        <Figure
          label="Balance"
          big
          value={money(wallet.balance)}
          credits={formatNumber(wallet.credits, locale)}
        />
        <Figure
          label={`Added${since}`}
          tone="text-success-foreground dark:text-success"
          value={flows ? money(flows.in.amount) : null}
          credits={flows ? formatNumber(flows.in.credits, locale) : null}
        />
        <Figure
          label={`Used${since}`}
          value={flows ? money(flows.out.amount) : null}
          credits={flows ? formatNumber(flows.out.credits, locale) : null}
        />
      </div>
    </section>
  )
}

function Figure({
  label,
  value,
  credits,
  tone,
  big = false,
}: {
  label: string
  value: ReactNode | null
  credits: string | null
  tone?: string
  big?: boolean
}) {
  return (
    <div className="space-y-1 border-b px-6 py-5 last:border-b-0 sm:border-b-0">
      <p className="text-muted-foreground text-[13px]">{label}</p>
      <p
        className={cn(
          'font-medium tracking-tight tabular-nums',
          big ? 'text-3xl' : 'text-xl',
          tone,
        )}
      >
        {value ?? '—'}
      </p>
      <p className="text-muted-foreground text-xs tabular-nums">
        {credits === null ? ' ' : `${credits} credits`}
      </p>
    </div>
  )
}

/** Every credit added, what remains of it, how much is consumed and when it expires. */
function TopUps({
  topUps,
  wallet,
  locale,
}: {
  topUps: CustomerPortalData['topUps']
  wallet: PortalWallet
  locale: string | undefined
}) {
  const worth = (credits: string) => {
    const value = creditsCost(credits, wallet.creditPrice, wallet.currency)
    return value ? <Money value={value} {...(locale ? { locale } : {})} /> : null
  }
  const columns: DetailColumn<PortalTopUp>[] = [
    {
      key: 'topup',
      header: 'Top-up',
      width: 320,
      text: (t) => `${t.title} ${t.detail ?? ''}`,
      cell: (t) => (
        <span className="block min-w-0">
          <span className="block truncate text-sm font-medium">{t.title}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {[t.detail, t.at ? `added ${formatDate(t.at, locale)}` : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      ),
    },
    {
      key: 'credits',
      header: 'Credits',
      align: 'end',
      sortBy: (t) => Number(t.granted),
      cell: (t) => (
        <span className="block text-right">
          <span className="text-success-foreground dark:text-success block tabular-nums">
            +{formatNumber(t.granted, locale)}
          </span>
          <span className="text-muted-foreground block text-xs tabular-nums">
            {worth(t.granted)}
          </span>
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'Remaining',
      align: 'end',
      sortBy: (t) => Number(t.remaining),
      cell: (t) => (
        <span className="block text-right">
          <span className="block tabular-nums">{formatNumber(t.remaining, locale)}</span>
          <span className="text-muted-foreground block text-xs tabular-nums">
            {worth(t.remaining)}
          </span>
        </span>
      ),
    },
    {
      key: 'consumed',
      header: 'Consumed',
      align: 'end',
      sortBy: (t) => t.consumed,
      cell: (t) => {
        const warn = t.state === 'expiring soon' || t.state === 'running low'
        return (
          <span className="flex w-full items-center justify-end gap-2">
            <span
              className="bg-muted-foreground/15 flex h-1.5 w-16 flex-none overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <span
                className={cn(
                  'h-full',
                  warn
                    ? 'bg-warning'
                    : t.state === 'expired'
                      ? 'bg-destructive/70'
                      : 'bg-foreground/55',
                )}
                style={{ width: `${t.consumed * 100}%` }}
              />
            </span>
            <span
              className={cn(
                'w-11 text-right text-[13px] tabular-nums',
                warn ? 'text-warning-foreground dark:text-warning' : 'text-muted-foreground',
              )}
            >
              {Math.round(t.consumed * 1000) / 10}%
            </span>
          </span>
        )
      },
    },
    {
      key: 'expires',
      header: 'Expires',
      sortBy: (t) => t.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      cell: (t) =>
        t.expiresAt ? (
          <span className="block">
            <span className="block">{formatDate(t.expiresAt, locale)}</span>
            {t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 14 && t.remaining !== '0' ? (
              <span className="text-warning-foreground dark:text-warning block text-xs">
                in {t.daysLeft} {t.daysLeft === 1 ? 'day' : 'days'}
              </span>
            ) : t.state === 'expired' ? (
              <span className="text-muted-foreground block text-xs">Expired</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Never</span>
        ),
    },
  ]

  return (
    <Loaded load={topUps} label="top-ups" rows={4}>
      {({ items }) =>
        items.length === 0 ? (
          <PortalEmpty
            icon={<WalletIcon />}
            title="Nothing here yet"
            description="Credits you add or are granted will be listed here."
          />
        ) : (
          <>
            <DetailTable
              label="Top-ups"
              noun="top-ups"
              rows={items}
              columns={columns}
              compact
              pageSize={50}
            />
            <p className="text-muted-foreground border-t px-6 py-3 text-[13px]">
              Usage draws on the top-up that expires soonest, among those it is allowed to use.
            </p>
          </>
        )
      }
    </Loaded>
  )
}

function Transactions({
  data,
  kind,
  onShowMore,
  locale,
}: PortalCreditsProps & { kind: 'all' | PortalTransactionDirection }) {
  return (
    <Loaded load={data.transactions} label="transactions" rows={5}>
      {({ items, total }) => {
        const shown = kind === 'all' ? items : items.filter((t) => t.direction === kind)
        if (shown.length === 0) {
          return (
            <PortalEmpty
              icon={<WalletIcon />}
              title="Nothing here yet"
              description="Credits you add or use will be listed here."
            />
          )
        }
        return (
          <>
            <ul className="divide-border/50 divide-y">
              {shown.map((t) => (
                <LedgerRow
                  key={t.id}
                  reason={t.title}
                  detail={[
                    t.detail,
                    t.expiresAt ? `expires ${formatDate(t.expiresAt, locale)}` : null,
                    t.pending ? 'pending' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  date={t.at ? formatDate(t.at, locale) : ''}
                  incoming={t.direction === 'in'}
                  amount={<Money value={t.amount} {...(locale ? { locale } : {})} />}
                  credits={formatNumber(t.credits, locale)}
                />
              ))}
            </ul>
            {items.length < total ? (
              <div className="border-t px-6 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-8 px-2"
                  onClick={onShowMore}
                >
                  Show more
                </Button>
              </div>
            ) : null}
          </>
        )
      }}
    </Loaded>
  )
}

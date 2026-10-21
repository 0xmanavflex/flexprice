import { useState } from 'react'
import {
  type PortalTransactionDirection,
  type PortalWallet,
  type PortalWalletTransaction,
  walletFlows,
} from '@fp/domain'
import { ArrowDownRightIcon, ArrowUpRightIcon, PlusIcon, ZapIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { Badge } from '@ui/components/reui/badge'
import { IconTile } from '@ui/components/reui/icon-tile'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Money } from '../shared/Money'
import { formatDate, formatNumber } from './format'
import { FigureTile, FigureTileSkeleton, Loaded, PortalCard, PortalEmpty } from './parts'
import type { CustomerPortalData } from './types'

/**
 * A credit wallet: its balance, what was added and used across the history
 * shown, and the transactions themselves.
 */
export const PortalCreditsProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/select',
    'primitives/tabs',
    'reui/badge',
    'reui/icon-tile',
    'shared/Money',
  ],
  note: 'Customer portal credits, after the reference portal: wallet header, balance tiles, transaction history.',
})

export interface PortalCreditsProps {
  data: CustomerPortalData
  walletId: string | null
  onWalletChange: (walletId: string) => void
  onAddCredits: () => void
  onShowMore: () => void
  locale: string | undefined
}

export function PortalCredits(props: PortalCreditsProps) {
  const { data } = props
  return (
    <Loaded load={data.wallets} label="credits" rows={4}>
      {(wallets) => {
        const wallet = wallets.find((w) => w.id === props.walletId) ?? wallets[0]
        if (!wallet) {
          return (
            <div className="bg-card rounded-xl border">
              <PortalEmpty
                title="No credit wallet yet"
                description="Prepaid credits show up here once your account has a wallet. Contact your account team to set one up."
              />
            </div>
          )
        }
        return <Wallet {...props} wallets={wallets} wallet={wallet} />
      }}
    </Loaded>
  )
}

function Wallet({
  data,
  wallets,
  wallet,
  onWalletChange,
  onAddCredits,
  onShowMore,
  locale,
}: PortalCreditsProps & { wallets: PortalWallet[]; wallet: PortalWallet }) {
  const [filter, setFilter] = useState<'all' | PortalTransactionDirection>('all')
  const money = (value: PortalWallet['balance']) => (
    <Money value={value} {...(locale ? { locale } : {})} />
  )
  const transactions = data.transactions.status === 'ready' ? data.transactions.data.items : null
  const flows = transactions ? walletFlows(transactions, wallet.currency) : null
  const oldest = transactions?.at(-1)?.at ?? null
  const since = oldest ? ` since ${formatDate(oldest, locale)}` : ''
  const price = money({ amount: wallet.creditPrice, currency: wallet.currency })

  return (
    <>
      {wallets.length > 1 ? (
        <Select
          value={wallet.id}
          onValueChange={(value) => value !== null && onWalletChange(value)}
        >
          <SelectTrigger className="h-9 w-64" aria-label="Wallet">
            <SelectValue>
              {(value) => wallets.find((w) => w.id === value)?.name ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {wallets.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name} · {w.currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <section className="bg-card overflow-hidden rounded-xl border" aria-label={wallet.name}>
        <header className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <h2 className="font-medium">{wallet.name}</h2>
            <Badge variant={wallet.active ? 'success-light' : 'secondary'}>
              {wallet.statusLabel}
            </Badge>
            <span className="text-muted-foreground">· 1 credit = {price}</span>
            {wallet.autoTopup?.enabled ? (
              <Badge variant="outline">
                <ZapIcon aria-hidden="true" />
                Auto top-up on
              </Badge>
            ) : null}
          </div>
          {wallet.active ? (
            <Button onClick={onAddCredits}>
              <PlusIcon aria-hidden="true" />
              Add credits
            </Button>
          ) : null}
        </header>
        <div className="grid max-sm:divide-y sm:grid-cols-3 sm:divide-x">
          <FigureTile
            label="Balance"
            value={money(wallet.balance)}
            caption={`${formatNumber(wallet.credits, locale)} credits`}
          />
          {flows ? (
            <>
              <FigureTile
                label={`Added${since}`}
                value={money(flows.in.amount)}
                caption={`${formatNumber(flows.in.credits, locale)} credits`}
              />
              <FigureTile
                label={`Used${since}`}
                value={money(flows.out.amount)}
                caption={`${formatNumber(flows.out.credits, locale)} credits`}
              />
            </>
          ) : (
            <>
              <FigureTileSkeleton />
              <FigureTileSkeleton />
            </>
          )}
        </div>
      </section>

      <PortalCard
        title="Transaction history"
        description="Every credit added to and used from this wallet"
        action={
          <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <TabsList aria-label="Show">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="in">Added</TabsTrigger>
              <TabsTrigger value="out">Used</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <Loaded load={data.transactions} label="transactions" rows={5}>
          {({ items, total }) => {
            const shown = filter === 'all' ? items : items.filter((t) => t.direction === filter)
            if (shown.length === 0) {
              return (
                <PortalEmpty
                  title={
                    items.length === 0
                      ? 'No transactions yet'
                      : `No ${filter === 'in' ? 'added' : 'used'} credits`
                  }
                  description="Credits added to and used from this wallet show up here."
                />
              )
            }
            return (
              <>
                <ul className="divide-y">
                  {shown.map((t) => (
                    <TransactionRow key={t.id} transaction={t} locale={locale} />
                  ))}
                </ul>
                {items.length < total ? (
                  <div className="border-t p-3 text-center">
                    <Button variant="ghost" size="sm" onClick={onShowMore}>
                      Show more
                    </Button>
                  </div>
                ) : null}
              </>
            )
          }}
        </Loaded>
      </PortalCard>
    </>
  )
}

function TransactionRow({
  transaction: t,
  locale,
}: {
  transaction: PortalWalletTransaction
  locale: string | undefined
}) {
  const incoming = t.direction === 'in'
  const sign = incoming ? '+' : '−'
  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <IconTile size="sm" variant="outline" aria-hidden="true">
        {incoming ? <ArrowDownRightIcon className="text-success" /> : <ArrowUpRightIcon />}
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {t.title}
          {t.pending ? <Badge variant="warning-light">Pending</Badge> : null}
        </p>
        {t.detail ? <p className="text-muted-foreground truncate text-xs">{t.detail}</p> : null}
      </div>
      <p className="text-muted-foreground hidden shrink-0 text-sm sm:block">
        {t.at ? formatDate(t.at, locale) : ''}
      </p>
      <div className="w-32 shrink-0 text-right">
        <p
          className={cn(
            'text-sm font-medium tabular-nums',
            incoming ? 'text-success-foreground dark:text-success' : '',
          )}
        >
          {sign} <Money value={t.amount} {...(locale ? { locale } : {})} />
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {sign}
          {formatNumber(t.credits, locale)} credits
        </p>
      </div>
    </li>
  )
}

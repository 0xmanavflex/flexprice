import { useState } from 'react'
import { ArrowDownLeftIcon, ArrowUpRightIcon, InfoIcon, MoreHorizontalIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Label } from '@ui/components/primitives/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Progress } from '@ui/components/primitives/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { FormDialog, Section } from '../../compositions'
import { ChoiceCards, Composer } from '../../compositions/DetailKit'

export interface WalletTransaction {
  id: string
  direction: 'in' | 'out'
  credits: number
  value: string
  source: 'invoice' | 'top-up' | 'grant' | 'expiry'
  date: string
}

export interface WalletModel {
  currentBalance: number
  ongoingBalance: number
  usedSinceInvoice: number
  conversionRate: string
  topUpRate: string
  autoTopUp: string
  expiringSoon: string
  transactions: WalletTransaction[]
}

export type WalletAction = 'create-wallet' | 'auto-top-up' | 'alerts' | 'manual-debit' | 'terminate'

export interface TopUpRequest {
  kind: 'purchased' | 'free'
  credits: number
}

export interface CustomerWalletViewProps {
  wallet: WalletModel
  onTopUp?: (request: TopUpRequest) => void
  onAction?: (action: WalletAction) => void
}

const ACTIONS: { id: WalletAction; label: string }[] = [
  { id: 'create-wallet', label: 'Create wallet' },
  { id: 'auto-top-up', label: 'Auto top-up' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'manual-debit', label: 'Manual debit' },
  { id: 'terminate', label: 'Terminate wallet' },
]

const SOURCE_LABEL = { invoice: 'Invoice', 'top-up': 'Top-up', grant: 'Grant', expiry: 'Expiry' }
const fmt = (n: number) => n.toLocaleString('en-US')

export function CustomerWalletView({ wallet, onTopUp, onAction }: CustomerWalletViewProps) {
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [kind, setKind] = useState<'purchased' | 'free'>('purchased')
  const [credits, setCredits] = useState('1000')
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all')
  const rows = wallet.transactions.filter((t) => filter === 'all' || t.direction === filter)

  const usedPct =
    wallet.currentBalance > 0 ? (wallet.usedSinceInvoice / wallet.currentBalance) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Select value="prepaid">
          <SelectTrigger className="h-9 w-56" aria-label="Wallet">
            <SelectValue>{() => 'Prepaid credits · USD'}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="prepaid">Prepaid credits · USD</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button onClick={() => setTopUpOpen(true)}>Top up wallet</Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" aria-label="Wallet actions" />}
            >
              <MoreHorizontalIcon aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuGroup>
                {ACTIONS.map((action) => (
                  <DropdownMenuItem key={action.id} onClick={() => onAction?.(action.id)}>
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-card grid gap-6 rounded-xl border p-5 lg:grid-cols-3">
        <Balance
          label="Current balance"
          hint="The balance when the last invoice was finalized."
          value={fmt(wallet.currentBalance)}
        />
        <Balance
          label="Ongoing balance"
          hint="Current balance minus usage recorded since then."
          value={fmt(wallet.ongoingBalance)}
        />
        <div className="flex flex-col justify-center gap-2">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>Since the last invoice</span>
            <span className="tabular-nums">{usedPct.toFixed(1)}% used</span>
          </div>
          <Progress value={usedPct} />
          <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
            <span>{fmt(wallet.usedSinceInvoice)} used</span>
            <span>{fmt(wallet.ongoingBalance)} available</span>
          </div>
        </div>
      </div>

      <dl className="bg-card grid grid-cols-2 gap-6 rounded-xl border p-5 text-sm lg:grid-cols-4">
        {[
          ['Conversion', wallet.conversionRate],
          ['Top-up rate', wallet.topUpRate],
          ['Auto top-up', wallet.autoTopUp],
          ['Expiring soon', wallet.expiringSoon],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <Section
        title="Transactions"
        description="Credits in and out of this wallet"
        actions={
          <Select
            value={filter}
            onValueChange={(value) => value !== null && setFilter(value as 'all' | 'in' | 'out')}
          >
            <SelectTrigger className="h-8 w-36" aria-label="Filter transactions">
              <SelectValue>
                {(value) =>
                  ({ all: 'All activity', in: 'Credits in', out: 'Debits out' })[value as 'all'] ??
                  value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All activity</SelectItem>
              <SelectItem value="in">Credits in</SelectItem>
              <SelectItem value="out">Debits out</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <ul className="flex flex-col divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3 text-sm">
              <span
                aria-hidden
                className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg border"
              >
                {row.direction === 'in' ? (
                  <ArrowDownLeftIcon className="size-4 text-emerald-600" />
                ) : (
                  <ArrowUpRightIcon className="size-4 text-red-600" />
                )}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="font-medium">{SOURCE_LABEL[row.source]}</span>
                <span className="text-muted-foreground text-xs">{row.value}</span>
              </div>
              <span className="text-muted-foreground ml-auto text-xs">{row.date}</span>
              <span
                className={`w-32 text-right tabular-nums ${row.direction === 'in' ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {row.direction === 'in' ? '+' : '-'}
                {fmt(row.credits)} credits
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <FormDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        title="Top up wallet"
        description="Add credits to this customer's wallet."
      >
        <Composer
          submitLabel="Top up"
          onCancel={() => setTopUpOpen(false)}
          onSubmit={() => {
            onTopUp?.({ kind, credits: Number(credits) || 0 })
            setTopUpOpen(false)
          }}
        >
          <ChoiceCards
            label="Credit type"
            value={kind}
            onChange={setKind}
            choices={[
              { value: 'purchased', title: 'Purchased', description: 'Charged to the customer.' },
              { value: 'free', title: 'Free', description: 'Granted at no charge.' },
            ]}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="topup-credits">Credits</Label>
            <Input
              id="topup-credits"
              inputMode="numeric"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </div>
        </Composer>
      </FormDialog>
    </div>
  )
}

function Balance({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {label}
        <Tooltip>
          <TooltipTrigger render={<span aria-label={hint} className="inline-flex" />}>
            <InfoIcon aria-hidden className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
      </div>
      <span className="text-2xl font-medium tabular-nums">{value}</span>
    </div>
  )
}

export const DEMO_WALLET: WalletModel = {
  currentBalance: 12000,
  ongoingBalance: 9350,
  usedSinceInvoice: 2650,
  conversionRate: '1 credit = $0.01',
  topUpRate: '1 credit = $0.01',
  autoTopUp: 'Off',
  expiringSoon: '500 credits · Jun 30',
  transactions: [
    {
      id: 't1',
      direction: 'out',
      credits: 2650,
      value: '$26.50',
      source: 'invoice',
      date: 'May 12, 2026',
    },
    {
      id: 't2',
      direction: 'in',
      credits: 10000,
      value: '$100.00',
      source: 'top-up',
      date: 'May 2, 2026',
    },
    {
      id: 't3',
      direction: 'in',
      credits: 2000,
      value: '$20.00',
      source: 'grant',
      date: 'May 1, 2026',
    },
    {
      id: 't4',
      direction: 'out',
      credits: 300,
      value: '$3.00',
      source: 'expiry',
      date: 'Apr 30, 2026',
    },
  ],
}

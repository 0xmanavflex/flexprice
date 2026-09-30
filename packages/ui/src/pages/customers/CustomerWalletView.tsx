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
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { FormDialog, Section } from '../../compositions'
import { ChoiceCards, Composer, SplitMeter } from '../../compositions/DetailKit'

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end gap-2">
        <Button onClick={() => setTopUpOpen(true)}>Top up wallet</Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Wallet actions" />}>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Balance">
          <div className="grid grid-cols-2 gap-6">
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
          </div>
        </Section>
        <Section title="Since the last invoice">
          <SplitMeter
            used={wallet.usedSinceInvoice}
            total={wallet.currentBalance}
            usedLabel={`${fmt(wallet.usedSinceInvoice)} used`}
            availableLabel={`${fmt(wallet.ongoingBalance)} available`}
          />
        </Section>
      </div>

      <Section title="Terms">
        <dl className="grid grid-cols-2 gap-6 text-sm lg:grid-cols-4">
          {[
            ['Conversion rate', wallet.conversionRate],
            ['Top-up rate', wallet.topUpRate],
            ['Auto top-up', wallet.autoTopUp],
            ['Credits expiring soon', wallet.expiringSoon],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="Transactions"
        actions={
          <div className="flex gap-1" role="group" aria-label="Filter transactions">
            {(['all', 'in', 'out'] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? 'secondary' : 'ghost'}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {{ all: 'All activity', in: 'Credits in', out: 'Debits out' }[value]}
              </Button>
            ))}
          </div>
        }
      >
        <ul className="flex flex-col divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-4 py-3 text-sm">
              {row.direction === 'in' ? (
                <ArrowDownLeftIcon aria-hidden className="size-4 text-emerald-600" />
              ) : (
                <ArrowUpRightIcon aria-hidden className="size-4 text-red-600" />
              )}
              <span className={row.direction === 'in' ? 'font-medium text-emerald-700 tabular-nums' : 'font-medium text-red-700 tabular-nums'}>
                {row.direction === 'in' ? '+' : '-'}
                {fmt(row.credits)} credits
              </span>
              <span className="text-muted-foreground tabular-nums">{row.value}</span>
              <span className="ml-auto text-muted-foreground">{SOURCE_LABEL[row.source]}</span>
              <span className="w-28 text-right text-muted-foreground">{row.date}</span>
            </li>
          ))}
        </ul>
      </Section>

      <FormDialog open={topUpOpen} onOpenChange={setTopUpOpen} title="Top up wallet" description="Add credits to this customer's wallet.">
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
            <Input id="topup-credits" inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value)} />
          </div>
        </Composer>
      </FormDialog>
    </div>
  )
}

function Balance({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
    { id: 't1', direction: 'out', credits: 2650, value: '$26.50', source: 'invoice', date: 'May 12, 2026' },
    { id: 't2', direction: 'in', credits: 10000, value: '$100.00', source: 'top-up', date: 'May 2, 2026' },
    { id: 't3', direction: 'in', credits: 2000, value: '$20.00', source: 'grant', date: 'May 1, 2026' },
    { id: 't4', direction: 'out', credits: 300, value: '$3.00', source: 'expiry', date: 'Apr 30, 2026' },
  ],
}

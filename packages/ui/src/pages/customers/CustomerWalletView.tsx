import { useState } from 'react'
import { LabelWithHint } from '@ui/compositions/LabelWithHint'
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  InfoIcon,
  MoreHorizontalIcon,
  PlusIcon,
  WalletIcon,
  XCircleIcon,
} from 'lucide-react'
import {
  type CreateWallet,
  type TopUpWallet,
  type Wallet,
  type WalletTransaction,
  WALLET_STATUS_LABEL,
  WalletStatus,
  createWalletSchema,
  emptyTopUp,
  emptyWallet,
  formatMoney,
  topUpWalletSchema,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Field } from '@ui/components/primitives/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import { cn } from '@ui/lib/cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import {
  AppFailure,
  ConfirmDialog,
  EmptyState,
  FormDialog,
  LoadingRows,
  OptionSelect,
  Section,
} from '../../compositions'
import { ChoiceCards, Composer, SplitMeter } from '../../compositions/DetailKit'

export interface CustomerWalletViewProps {
  wallets: Wallet[]
  isLoading?: boolean
  failed?: boolean
  onRetry?: () => void
  selectedId: string | null
  onSelect: (walletId: string) => void
  transactions: WalletTransaction[]
  transactionsLoading?: boolean
  /** Each action resolves when done and rejects on failure; the matching error is a sentence. */
  onCreateWallet: (draft: CreateWallet) => Promise<unknown>
  createError?: string | null
  onTopUp: (draft: TopUpWallet) => Promise<unknown>
  topUpError?: string | null
  onTerminate: () => Promise<unknown>
  terminateError?: string | null
  /** Called when a dialog opens, so a stale error from the last attempt is cleared. */
  onResetErrors?: () => void
}

type Dialog = 'create' | 'top-up' | 'terminate' | null

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'].map((code) => ({ value: code, label: code }))

// `Intl.NumberFormat` formats a decimal string exactly; the cast bridges a lib typing gap.
const credits = (value: string) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value as unknown as number)

const day = (value: Date | null) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value) : ''

export function CustomerWalletView({
  wallets,
  isLoading = false,
  failed = false,
  onRetry,
  selectedId,
  onSelect,
  transactions,
  transactionsLoading = false,
  onCreateWallet,
  createError = null,
  onTopUp,
  topUpError = null,
  onTerminate,
  terminateError = null,
  onResetErrors,
}: CustomerWalletViewProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [pending, setPending] = useState(false)
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all')

  const open = (next: Exclude<Dialog, null>) => {
    onResetErrors?.()
    setDialog(next)
  }
  const close = () => setDialog(null)
  const run = async (action: () => Promise<unknown>) => {
    setPending(true)
    try {
      await action()
      close()
    } catch {
      // The container surfaces the failure through its `*Error` prop.
    } finally {
      setPending(false)
    }
  }

  if (isLoading) return <LoadingRows />
  if (failed) {
    return (
      <AppFailure
        title="Wallets could not be loaded"
        detail="The rest of the console still works. Try again."
        {...(onRetry ? { onRetry } : {})}
      />
    )
  }

  const createDialog = (
    <CreateWalletDialog
      open={dialog === 'create'}
      onClose={close}
      pending={pending}
      error={createError}
      onSubmit={(draft) => run(() => onCreateWallet(draft))}
    />
  )

  const wallet = wallets.find((candidate) => candidate.id === selectedId) ?? wallets[0]
  if (!wallet) {
    return (
      <>
        <EmptyState
          size="inline"
          title="No wallet yet"
          description="A wallet holds prepaid credits this customer's usage draws down."
          action={<Button onClick={() => open('create')}>Create wallet</Button>}
        />
        {createDialog}
      </>
    )
  }

  const closed = wallet.status === WalletStatus.Closed
  const rows = transactions.filter((t) => filter === 'all' || t.direction === filter)
  const current = Number(wallet.creditBalance) || 0
  const ongoing = Number(wallet.realTimeCreditBalance) || 0
  const pendingUsage = Math.max(0, current - ongoing)
  const usedShare =
    current > 0 ? Math.min(100, Math.round((pendingUsage / current) * 1000) / 10) : 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {wallets.length > 1 ? (
          <Select value={wallet.id} onValueChange={(value) => value !== null && onSelect(value)}>
            <SelectTrigger className="h-9 w-64" aria-label="Wallet">
              <SelectValue>
                {(value) => {
                  const chosen = wallets.find((candidate) => candidate.id === value)
                  return chosen
                    ? `${chosen.description || 'Prepaid credits'} · ${chosen.currency}`
                    : value
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              {wallets.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.description || 'Prepaid credits'} · {candidate.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{wallet.description || 'Prepaid credits'}</p>
            <p className="text-muted-foreground text-xs">{wallet.currency}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button className="h-8 px-3.5" onClick={() => open('top-up')} disabled={closed}>
            <PlusIcon aria-hidden="true" />
            Top up wallet
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Wallet actions"
                />
              }
            >
              <MoreHorizontalIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => open('create')}>
                <WalletIcon className="text-muted-foreground" aria-hidden="true" />
                Create wallet
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={closed}
                onClick={() => open('terminate')}
              >
                <XCircleIcon aria-hidden="true" />
                Terminate wallet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <section className="bg-background rounded-xl border">
        {/* Balances on the left, usage since the last invoice on the right: one row, equal halves. */}
        <div className="grid lg:grid-cols-2 lg:divide-x">
          <div className="grid grid-cols-2 divide-x">
            <div className="p-6">
              <Balance
                label="Current balance"
                hint="Balance when the most recent invoice was finalized. It does not include usage recorded after that."
                credits={wallet.creditBalance}
                value={formatMoney(wallet.balance)}
              />
            </div>
            <div className="p-6">
              <Balance
                label="Ongoing balance"
                hint="Current balance minus usage recorded since the last invoice. This is what the next charge draws from."
                credits={wallet.realTimeCreditBalance}
                value={formatMoney(wallet.realTimeBalance)}
              />
            </div>
          </div>
          <div className="flex flex-col justify-center gap-3 border-t p-6 lg:border-t-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-muted-foreground text-xs">Since the last invoice</p>
              <p className="text-muted-foreground text-xs tabular-nums">{usedShare}% used</p>
            </div>
            <SplitMeter
              segments={56}
              parts={[
                { value: pendingUsage, color: 'bg-success', label: 'Used, not yet invoiced' },
                { value: Math.max(0, ongoing), color: 'bg-muted', label: 'Available' },
              ]}
            />
            <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="bg-success size-2 rounded-full" aria-hidden="true" />
                {credits(String(pendingUsage))} used, not yet invoiced
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="bg-muted-foreground/30 size-2 rounded-full" aria-hidden="true" />
                {credits(String(Math.max(0, ongoing)))} available
              </span>
            </div>
          </div>
        </div>
        <dl className="text-muted-foreground grid gap-4 border-t px-6 py-4 text-xs sm:grid-cols-4">
          {[
            ['Status', WALLET_STATUS_LABEL[wallet.status]],
            ['Conversion', `1 credit = ${wallet.conversionRate} ${wallet.currency}`],
            ['Top-up rate', `1 credit = ${wallet.topupConversionRate} ${wallet.currency}`],
            ['Auto top-up', wallet.autoTopup ? 'On' : 'Off'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="text-foreground mt-0.5 text-[13px]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Section
        title="Transactions"
        flush
        action={
          <Select
            value={filter}
            onValueChange={(value) => value !== null && setFilter(value as 'all' | 'in' | 'out')}
          >
            <SelectTrigger className="h-8 w-40" aria-label="Filter transactions">
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
        {transactionsLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground px-6 py-10 text-center text-sm">
            No transactions yet.
          </p>
        ) : (
          <ul className="divide-border/50 divide-y">
            {rows.map((row) => (
              <LedgerRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </Section>

      {createDialog}
      <TopUpDialog
        open={dialog === 'top-up'}
        onClose={close}
        pending={pending}
        error={topUpError}
        onSubmit={(draft) => run(() => onTopUp(draft))}
      />
      <ConfirmDialog
        open={dialog === 'terminate'}
        onOpenChange={(next) => (next ? undefined : close())}
        title="Terminate this wallet?"
        description="Remaining credits are forfeited and the wallet stops drawing down usage. This cannot be undone."
        confirmLabel="Terminate wallet"
        destructive
        isPending={pending}
        error={terminateError}
        onConfirm={() => void run(onTerminate)}
      />
    </div>
  )
}

/** list-5 row: tone tile, reason and detail, date, signed amount with credits underneath. */
function LedgerRow({ row }: { row: WalletTransaction }) {
  const credit = row.direction === 'in'
  const sign = credit ? '+' : '−'
  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <span
        aria-hidden="true"
        className={cn(
          'border-background flex size-9 shrink-0 items-center justify-center rounded-lg border-2 shadow-[0_1px_3px_0_rgba(0,0,0,0.12)] [&_svg]:size-4',
          credit ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
        )}
      >
        {credit ? <ArrowUpRightIcon /> : <ArrowDownRightIcon />}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{row.reason}</p>
        {row.description ? (
          <p className="text-muted-foreground truncate text-xs">{row.description}</p>
        ) : null}
      </div>
      <span className="text-muted-foreground hidden w-28 text-xs sm:block">
        {day(row.createdAt)}
      </span>
      <div className="w-32 space-y-0.5">
        <p
          className={cn(
            'text-[15px] font-medium tabular-nums',
            credit ? 'text-success' : 'text-destructive',
          )}
        >
          {sign} {formatMoney(row.amount)}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {sign}
          {credits(row.credits)} credits
        </p>
      </div>
    </li>
  )
}

function CreateWalletDialog({
  open,
  onClose,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  pending: boolean
  error: string | null
  onSubmit: (draft: CreateWallet) => void
}) {
  const [draft, setDraft] = useState<CreateWallet>(emptyWallet())
  const [problem, setProblem] = useState<string | null>(null)
  const set = (patch: Partial<CreateWallet>) => setDraft((current) => ({ ...current, ...patch }))

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Create wallet"
    >
      <Composer
        submitLabel="Create wallet"
        onCancel={onClose}
        submitting={pending}
        onSubmit={() => {
          const parsed = createWalletSchema.safeParse(draft)
          if (!parsed.success)
            return setProblem(parsed.error.issues[0]?.message ?? 'Check the form')
          setProblem(null)
          onSubmit(parsed.data)
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <LabelWithHint
              htmlFor="wallet-currency"
              hint="The currency the wallet balance is valued in."
            >
              Currency
            </LabelWithHint>
            <OptionSelect
              id="wallet-currency"
              value={draft.currency}
              onValueChange={(currency) => set({ currency })}
              options={CURRENCIES}
            />
          </Field>
          <Field>
            <LabelWithHint htmlFor="wallet-rate" hint="How much money one credit is worth.">
              Conversion rate
            </LabelWithHint>
            <InputGroup className="h-9">
              <InputGroupAddon align="inline-start">1 credit =</InputGroupAddon>
              <InputGroupInput
                id="wallet-rate"
                inputMode="decimal"
                value={draft.conversionRate}
                onChange={(event) => set({ conversionRate: event.target.value })}
              />
              <InputGroupAddon align="inline-end">{draft.currency}</InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <LabelWithHint
              htmlFor="wallet-initial"
              hint="Credits added as soon as the wallet is created. Optional."
            >
              Initial credits
            </LabelWithHint>
            <Input
              id="wallet-initial"
              className="h-9"
              inputMode="decimal"
              value={draft.initialCredits}
              onChange={(event) => set({ initialCredits: event.target.value })}
            />
          </Field>
          <Field>
            <LabelWithHint
              htmlFor="wallet-description"
              hint="A note about what this wallet is for. Optional."
            >
              Description
            </LabelWithHint>
            <Input
              id="wallet-description"
              className="h-9"
              value={draft.description}
              onChange={(event) => set({ description: event.target.value })}
            />
          </Field>
        </div>
        {problem || error ? (
          <p role="alert" className="text-destructive text-sm">
            {problem ?? error}
          </p>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

function TopUpDialog({
  open,
  onClose,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  pending: boolean
  error: string | null
  onSubmit: (draft: TopUpWallet) => void
}) {
  const [draft, setDraft] = useState<TopUpWallet>(emptyTopUp())
  const [problem, setProblem] = useState<string | null>(null)
  const set = (patch: Partial<TopUpWallet>) => setDraft((current) => ({ ...current, ...patch }))

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Top up wallet"
    >
      <Composer
        submitLabel="Top up"
        onCancel={onClose}
        submitting={pending}
        onSubmit={() => {
          const parsed = topUpWalletSchema.safeParse(draft)
          if (!parsed.success)
            return setProblem(parsed.error.issues[0]?.message ?? 'Check the form')
          setProblem(null)
          onSubmit(parsed.data)
        }}
      >
        <ChoiceCards
          label="Credit type"
          value={draft.kind}
          onChange={(kind) => set({ kind })}
          choices={[
            {
              value: 'purchased',
              title: 'Purchased',
              description: 'The customer pays for these.',
              icon: <PlusIcon aria-hidden="true" />,
            },
            {
              value: 'free',
              title: 'Free',
              description: 'Goodwill or promotional.',
              icon: <ArrowUpRightIcon aria-hidden="true" />,
            },
          ]}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <LabelWithHint htmlFor="topup-credits" hint="How many credits to add to the wallet.">
              Credits
            </LabelWithHint>
            <Input
              id="topup-credits"
              className="h-9"
              inputMode="decimal"
              value={draft.credits}
              onChange={(event) => set({ credits: event.target.value })}
            />
          </Field>
          <Field>
            <LabelWithHint htmlFor="topup-note" hint="Why the credits are being added. Optional.">
              Note
            </LabelWithHint>
            <Input
              id="topup-note"
              className="h-9"
              value={draft.description}
              onChange={(event) => set({ description: event.target.value })}
            />
          </Field>
        </div>
        {problem || error ? (
          <p role="alert" className="text-destructive text-sm">
            {problem ?? error}
          </p>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

function Balance({
  label,
  hint,
  credits: creditValue,
  value,
}: {
  label: string
  hint: string
  credits: string
  value: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {label}
        <Tooltip>
          <TooltipTrigger render={<span aria-label={hint} className="inline-flex" />}>
            <InfoIcon className="size-3.5" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent className="max-w-60">{hint}</TooltipContent>
        </Tooltip>
      </p>
      <p className="text-3xl font-medium tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs tabular-nums">{credits(creditValue)} credits</p>
    </div>
  )
}

import { useState } from 'react'
import { ArrowDownLeftIcon, ArrowUpRightIcon, InfoIcon, MoreHorizontalIcon } from 'lucide-react'
import { MENU_CONTENT, MENU_ITEM } from '@ui/compositions/shell/menuSurface'
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
import { Label } from '@ui/components/primitives/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
import { ChoiceCards, Composer } from '../../compositions/DetailKit'

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
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
          <div className="flex flex-col">
            <span className="text-sm font-medium">{wallet.description || 'Prepaid credits'}</span>
            <span className="text-muted-foreground text-xs">
              {wallet.currency} · {WALLET_STATUS_LABEL[wallet.status]}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button onClick={() => open('top-up')} disabled={closed}>
            Top up wallet
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" aria-label="Wallet actions" />}
            >
              <MoreHorizontalIcon aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className={MENU_CONTENT}>
              <DropdownMenuGroup>
                <DropdownMenuItem className={MENU_ITEM} onClick={() => open('create')}>
                  Create wallet
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={MENU_ITEM}
                  disabled={closed}
                  onClick={() => open('terminate')}
                >
                  Terminate wallet
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <Balance
            label="Current balance"
            hint="The balance when the last invoice was finalized."
            credits={wallet.creditBalance}
            value={formatMoney(wallet.balance)}
          />
          <Balance
            label="Ongoing balance"
            hint="Current balance minus usage recorded since then."
            credits={wallet.realTimeCreditBalance}
            value={formatMoney(wallet.realTimeBalance)}
          />
        </div>
        <dl className="grid grid-cols-2 gap-6 border-t p-5 text-sm lg:grid-cols-3">
          {[
            ['Conversion', `1 credit = ${wallet.conversionRate} ${wallet.currency}`],
            ['Top-up rate', `1 credit = ${wallet.topupConversionRate} ${wallet.currency}`],
            ['Auto top-up', wallet.autoTopup ? 'On' : 'Off'],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

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
        {transactionsLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No transactions yet.</p>
        ) : (
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
                  <span className="font-medium">{row.reason}</span>
                  {row.description ? (
                    <span className="text-muted-foreground truncate text-xs">
                      {row.description}
                    </span>
                  ) : null}
                </div>
                <span className="text-muted-foreground ml-auto text-xs">{day(row.createdAt)}</span>
                <span className="flex w-36 flex-col items-end tabular-nums">
                  <span
                    className={`font-medium ${row.direction === 'in' ? 'text-emerald-700' : 'text-red-700'}`}
                  >
                    {row.direction === 'in' ? '+' : '-'} {formatMoney(row.amount)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {row.direction === 'in' ? '+' : '-'}
                    {credits(row.credits)} credits
                  </span>
                </span>
              </li>
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
      description="A prepaid wallet in one currency. Credits convert to money at the rate you set."
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="wallet-currency">Currency</Label>
          <OptionSelect
            id="wallet-currency"
            value={draft.currency}
            onValueChange={(currency) => set({ currency })}
            options={CURRENCIES}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="wallet-rate">Conversion rate</Label>
          <Input
            id="wallet-rate"
            inputMode="decimal"
            value={draft.conversionRate}
            onChange={(event) => set({ conversionRate: event.target.value })}
          />
          <p className="text-muted-foreground text-xs">Currency value of one credit.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="wallet-initial">Initial credits (optional)</Label>
          <Input
            id="wallet-initial"
            inputMode="decimal"
            value={draft.initialCredits}
            onChange={(event) => set({ initialCredits: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="wallet-description">Description (optional)</Label>
          <Input
            id="wallet-description"
            value={draft.description}
            onChange={(event) => set({ description: event.target.value })}
          />
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
      description="Add credits to this customer's wallet."
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
            { value: 'purchased', title: 'Purchased', description: 'Charged to the customer.' },
            { value: 'free', title: 'Free', description: 'Granted at no charge.' },
          ]}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="topup-credits">Credits</Label>
          <Input
            id="topup-credits"
            inputMode="decimal"
            value={draft.credits}
            onChange={(event) => set({ credits: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="topup-note">Note (optional)</Label>
          <Input
            id="topup-note"
            value={draft.description}
            onChange={(event) => set({ description: event.target.value })}
          />
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
    <div className="flex flex-col gap-1 p-5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {label}
        <Tooltip>
          <TooltipTrigger render={<span aria-label={hint} className="inline-flex" />}>
            <InfoIcon aria-hidden className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
      </div>
      <span className="text-3xl font-medium tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {credits(creditValue)} credits
      </span>
    </div>
  )
}

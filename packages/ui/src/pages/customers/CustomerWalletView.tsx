import { useState, type ReactNode } from 'react'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import {
  ArrowUpRightIcon,
  InfoIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RepeatIcon,
  WalletIcon,
  XCircleIcon,
} from '@ui/icons'
import {
  type AutoTopup,
  type CreateWallet,
  type TopUpWallet,
  type Wallet,
  type WalletTransaction,
  WALLET_STATUS_LABEL,
  WalletStatus,
  autoTopupSchema,
  createWalletSchema,
  emptyTopUp,
  emptyWallet,
  formatMoney,
  topUpWalletSchema,
  currencyCodes,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Field } from '@ui/components/primitives/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
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
import { ChoiceCards, Composer, SplitMeter } from '../../compositions/detail/DetailKit'
import { Pill, type PillTone } from '../shared/cells'
import {
  WalletLedgerTable,
  WalletTransactionsTable,
  expiringSoon,
  formatCredits,
  formatDay,
} from './WalletLedgerTable'
import { SubTabState, truncationNote } from '../../compositions/detail/SubTabState'
import type { ErrorKind } from '../../compositions/feedback/States'

export interface CustomerWalletViewProps {
  wallets: Wallet[]
  isLoading?: boolean
  failed?: boolean
  onRetry?: () => void
  selectedId: string | null
  onSelect: (walletId: string) => void
  transactions: WalletTransaction[]
  /** The moment expiries are measured from; defaults to now. */
  now?: Date
  transactionsLoading?: boolean
  /** The ledger read failed: the Top-ups section shows it with a retry, never "No top-ups yet". */
  transactionsError?: string | null
  transactionsErrorKind?: ErrorKind
  onRetryTransactions?: () => void
  /** Each action resolves when done and rejects on failure; the matching error is a sentence. */
  onCreateWallet: (draft: CreateWallet) => Promise<unknown>
  createError?: string | null
  onTopUp: (draft: TopUpWallet) => Promise<unknown>
  topUpError?: string | null
  onTerminate: () => Promise<unknown>
  terminateError?: string | null
  onSaveAutoTopup: (draft: AutoTopup) => Promise<unknown>
  autoTopupError?: string | null
  /** Called when a dialog opens, so a stale error from the last attempt is cleared. */
  onResetErrors?: () => void
}

type Dialog = 'create' | 'top-up' | 'auto-topup' | 'terminate' | null

const CURRENCIES = currencyCodes().map((code) => ({ value: code, label: code }))

const credits = formatCredits

/** A per-credit rate keeps its small decimals: 0.009 is "$0.009", not "$0.01". */
function rate(value: string, currency: string): string {
  if (toNumber(value) === null) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currencyDisplay: 'narrowSymbol',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value as unknown as number)
  } catch {
    return `${value} ${currency}`
  }
}

export function CustomerWalletView({
  wallets,
  isLoading = false,
  failed = false,
  onRetry,
  selectedId,
  onSelect,
  transactions,
  now,
  transactionsLoading = false,
  transactionsError = null,
  transactionsErrorKind,
  onRetryTransactions,
  onCreateWallet,
  createError = null,
  onTopUp,
  topUpError = null,
  onTerminate,
  terminateError = null,
  onSaveAutoTopup,
  autoTopupError = null,
  onResetErrors,
}: CustomerWalletViewProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [pending, setPending] = useState(false)
  // Every open remounts the dialogs (their `key`), so a draft or a validation
  // message from the last time never greets the next one.
  const [opens, setOpens] = useState(0)

  const open = (next: Exclude<Dialog, null>) => {
    onResetErrors?.()
    setOpens((count) => count + 1)
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

  // Wallets on screen win over a failed refetch; with none, error beats loading.
  if (failed && wallets.length === 0) {
    return (
      <AppFailure
        title="Wallets could not be loaded"
        detail="The rest of the console still works. Try again."
        {...(onRetry ? { onRetry } : {})}
      />
    )
  }
  if (isLoading && wallets.length === 0) return <LoadingRows />

  const createDialog = (
    <CreateWalletDialog
      key={`create:${opens}`}
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
          scene="customers"
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
  const currency = wallet.currency.toUpperCase()
  const asOf = now ?? new Date()
  const topUps = transactions
    .filter((t) => t.direction === 'in')
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
  // An unreadable balance is "unknown", never a 0: the meter is left out rather
  // than drawn as an untouched wallet.
  const current = toNumber(wallet.creditBalance)
  const ongoing = toNumber(wallet.realTimeCreditBalance)
  const meterKnown = current !== null && ongoing !== null
  const pendingUsage = meterKnown ? Math.max(0, current - ongoing) : 0
  const usedShare =
    meterKnown && current > 0 ? Math.min(100, Math.round((pendingUsage / current) * 1000) / 10) : 0
  const availableNow = meterKnown ? Math.max(0, ongoing) : 0
  const expiring = expiringSoon(topUps, asOf)
  const ledgerCapped = truncationNote(transactions.length, TRANSACTIONS_LIMIT)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={wallet.id} onValueChange={(value) => value !== null && onSelect(value)}>
          <SelectTrigger className="h-9 w-64" aria-label="Wallet">
            <SelectValue>
              {(value) => {
                const chosen = wallets.find((candidate) => candidate.id === value)
                return chosen
                  ? `${chosen.description || 'Prepaid credits'} · ${chosen.currency.toUpperCase()}`
                  : value
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {wallets.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.description || 'Prepaid credits'} · {candidate.currency.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <DropdownMenuItem disabled={closed} onClick={() => open('auto-topup')}>
                <RepeatIcon className="text-muted-foreground" aria-hidden="true" />
                Auto top-up settings
              </DropdownMenuItem>
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
                label="Real-time balance"
                hint="Last invoiced balance minus usage recorded since the last invoice. This is what the next charge draws from."
                credits={wallet.realTimeCreditBalance}
                value={formatMoney(wallet.realTimeBalance)}
              />
            </div>
            <div className="p-6">
              <Balance
                label="Last invoiced balance"
                hint="Balance when the most recent invoice was finalized. It does not include usage recorded after that."
                credits={wallet.creditBalance}
                value={formatMoney(wallet.balance)}
              />
            </div>
          </div>
          <div className="flex flex-col justify-center gap-3 border-t p-6 lg:border-t-0">
            {meterKnown ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-muted-foreground text-xs">Since the last invoice</p>
                  <p className="text-muted-foreground text-xs tabular-nums">{usedShare}% used</p>
                </div>
                <SplitMeter
                  segments={56}
                  parts={[
                    { value: pendingUsage, color: 'bg-success', label: 'Used, not yet invoiced' },
                    { value: availableNow, color: 'bg-muted', label: 'Available' },
                  ]}
                />
                <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-success size-2 rounded-full" aria-hidden="true" />
                    {credits(String(pendingUsage))} used, not yet invoiced
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="bg-muted-foreground/30 size-2 rounded-full"
                      aria-hidden="true"
                    />
                    {credits(String(availableNow))} available
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-xs">Since the last invoice</p>
                <p className="text-muted-foreground text-sm">
                  Usage since the last invoice is unavailable: a balance could not be read.
                </p>
              </>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t px-6 py-4 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-x-12">
          <Detail label="Status">
            <Pill tone={STATUS_TONE[wallet.status]}>{WALLET_STATUS_LABEL[wallet.status]}</Pill>
          </Detail>
          <Detail label="Consumption rate">
            1 credit = {rate(wallet.conversionRate, currency)}
          </Detail>
          <Detail label="Top-up rate">
            1 credit = {rate(wallet.topupConversionRate, currency)}
          </Detail>
          <Detail label="Auto top-up">
            <button
              type="button"
              disabled={closed}
              onClick={() => open('auto-topup')}
              aria-label={`Auto top-up ${wallet.autoTopup.enabled ? 'on' : 'off'}. Edit settings`}
              className="focus-visible:ring-ring/50 rounded-sm text-left underline-offset-4 outline-none hover:underline focus-visible:ring-3 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
            >
              {wallet.autoTopup.enabled
                ? `Below ${credits(wallet.autoTopup.threshold)} credits, add ${credits(wallet.autoTopup.amount)}`
                : 'Off'}
            </button>
          </Detail>
          {expiring ? (
            <Detail label="Expiring soon">
              <span className="text-warning-foreground dark:text-warning">
                {credits(expiring.credits)} credits on {formatDay(expiring.date, false)}
              </span>
            </Detail>
          ) : null}
        </dl>
      </section>

      <Section table title="Top-ups">
        <SubTabState
          hasData={topUps.length > 0}
          isLoading={transactionsLoading}
          error={transactionsError}
          errorKind={transactionsErrorKind}
          onRetry={onRetryTransactions}
          columns={5}
          loadingLabel="Loading top-ups"
          truncation={ledgerCapped}
          empty={{
            scene: 'customers',
            title: ledgerCapped ? 'No top-ups in the latest transactions' : 'No top-ups yet',
            description: ledgerCapped
              ? 'Older transactions are not listed here.'
              : 'Credits added to this wallet appear here.',
          }}
        >
          <WalletLedgerTable topUps={topUps} now={asOf} />
        </SubTabState>
      </Section>

      {/* A failed ledger read is reported once, in Top-ups above. */}
      {transactionsError ? null : (
        <Section table title="All transactions">
          <SubTabState
            hasData={transactions.length > 0}
            isLoading={transactionsLoading}
            error={transactionsError}
            errorKind={transactionsErrorKind}
            onRetry={onRetryTransactions}
            columns={5}
            loadingLabel="Loading transactions"
            truncation={ledgerCapped}
            empty={{
              scene: 'customers',
              title: 'No transactions yet',
              description: 'Credits added and usage drawn from this wallet appear here.',
            }}
          >
            <WalletTransactionsTable transactions={transactions} />
          </SubTabState>
        </Section>
      )}

      {createDialog}
      <TopUpDialog
        key={`top-up:${opens}`}
        open={dialog === 'top-up'}
        onClose={close}
        pending={pending}
        error={topUpError}
        onSubmit={(draft) => run(() => onTopUp(draft))}
      />
      <AutoTopupDialog
        key={`${wallet.id}:${opens}`}
        open={dialog === 'auto-topup'}
        onClose={close}
        pending={pending}
        error={autoTopupError}
        initial={wallet.autoTopup}
        currency={currency}
        onSubmit={(draft) => run(() => onSaveAutoTopup(draft))}
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

const STATUS_TONE: Record<WalletStatus, PillTone> = {
  [WalletStatus.Active]: 'success',
  [WalletStatus.Frozen]: 'warning',
  [WalletStatus.Closed]: 'neutral',
}

/** How many ledger rows the wallet panel asks for; at this count older entries are cut off. */
export const TRANSACTIONS_LIMIT = 200

/** A decimal string as a number, or null when it is blank or unreadable. */
function toNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function AutoTopupDialog({
  open,
  onClose,
  pending,
  error,
  initial,
  currency,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  pending: boolean
  error: string | null
  initial: AutoTopup
  currency: string
  onSubmit: (draft: AutoTopup) => void
}) {
  const [draft, setDraft] = useState<AutoTopup>(initial)
  const [problem, setProblem] = useState<string | null>(null)
  const set = (patch: Partial<AutoTopup>) => setDraft((current) => ({ ...current, ...patch }))

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Auto top-up"
    >
      <Composer
        submitLabel="Save"
        onCancel={onClose}
        submitting={pending}
        onSubmit={() => {
          const parsed = autoTopupSchema.safeParse(draft)
          if (!parsed.success)
            return setProblem(parsed.error.issues[0]?.message ?? 'Check the form')
          setProblem(null)
          onSubmit(parsed.data)
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="auto-topup-enabled" className="text-sm font-medium">
              Top up automatically
            </label>
            <p className="text-muted-foreground text-xs">
              Add credits whenever the balance runs low, so usage is never cut off.
            </p>
          </div>
          <Switch
            id="auto-topup-enabled"
            checked={draft.enabled}
            onCheckedChange={(enabled) => set({ enabled })}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <LabelWithHint
              htmlFor="auto-topup-threshold"
              hint="When the balance falls to this many credits, a top-up is triggered."
            >
              Below
            </LabelWithHint>
            <InputGroup className="h-9">
              <InputGroupInput
                id="auto-topup-threshold"
                inputMode="decimal"
                value={draft.threshold}
                onChange={(event) => set({ threshold: event.target.value })}
              />
              <InputGroupAddon align="inline-end">credits</InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <LabelWithHint
              htmlFor="auto-topup-amount"
              hint="How many credits each automatic top-up adds."
            >
              Add
            </LabelWithHint>
            <InputGroup className="h-9">
              <InputGroupInput
                id="auto-topup-amount"
                inputMode="decimal"
                value={draft.amount}
                onChange={(event) => set({ amount: event.target.value })}
              />
              <InputGroupAddon align="inline-end">credits</InputGroupAddon>
            </InputGroup>
          </Field>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="auto-topup-invoicing" className="text-sm font-medium">
              Invoice each top-up
            </label>
            <p className="text-muted-foreground text-xs">
              Charge the customer in {currency} for the credits. Off grants them as free credits.
            </p>
          </div>
          <Switch
            id="auto-topup-invoicing"
            checked={draft.invoicing}
            disabled={!draft.enabled}
            onCheckedChange={(invoicing) => set({ invoicing })}
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

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
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
      <p className="text-3xl font-medium tabular-nums">
        {credits(creditValue)}{' '}
        <span className="text-muted-foreground text-base font-normal">credits</span>
      </p>
      <p className="text-muted-foreground text-sm tabular-nums">{value}</p>
    </div>
  )
}

import { useState } from 'react'
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
import { DetailPills } from '../../compositions/detail/pillSize'
import { Pill, type PillTone } from '../shared/cells'
import { DetailTable } from '../shared/DetailTable'

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
  onSaveAutoTopup: (draft: AutoTopup) => Promise<unknown>
  autoTopupError?: string | null
  /** Called when a dialog opens, so a stale error from the last attempt is cleared. */
  onResetErrors?: () => void
}

type Dialog = 'create' | 'top-up' | 'auto-topup' | 'terminate' | null

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
  onSaveAutoTopup,
  autoTopupError = null,
  onResetErrors,
}: CustomerWalletViewProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [pending, setPending] = useState(false)
  const [autoTopupOpens, setAutoTopupOpens] = useState(0)

  const open = (next: Exclude<Dialog, null>) => {
    onResetErrors?.()
    if (next === 'auto-topup') setAutoTopupOpens((count) => count + 1)
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
  const topUps = transactions
    .filter((t) => t.direction === 'in')
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
  const current = Number(wallet.creditBalance) || 0
  const ongoing = Number(wallet.realTimeCreditBalance) || 0
  const pendingUsage = Math.max(0, current - ongoing)
  const usedShare =
    current > 0 ? Math.min(100, Math.round((pendingUsage / current) * 1000) / 10) : 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      <DetailPills className="-mt-2">
        <Pill tone={STATUS_TONE[wallet.status]}>{WALLET_STATUS_LABEL[wallet.status]}</Pill>
        <Pill>
          <span className="text-muted-foreground font-normal">Consumption rate</span>1 credit ={' '}
          {wallet.conversionRate} {wallet.currency}
        </Pill>
        <Pill>
          <span className="text-muted-foreground font-normal">Top-up rate</span>1 credit ={' '}
          {wallet.topupConversionRate} {wallet.currency}
        </Pill>
        <button
          type="button"
          disabled={closed}
          onClick={() => open('auto-topup')}
          aria-label={`Auto top-up ${wallet.autoTopup.enabled ? 'on' : 'off'}. Edit settings`}
          className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Pill
            icon={<RepeatIcon aria-hidden="true" />}
            className="hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <span className="text-muted-foreground font-normal">Auto top-up</span>
            {wallet.autoTopup.enabled
              ? `${credits(wallet.autoTopup.amount)} credits below ${credits(wallet.autoTopup.threshold)}`
              : 'Off'}
          </Pill>
        </button>
      </DetailPills>

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
      </section>

      <Section table title="Top-ups">
        <DetailTable
          compact
          label="Top-ups"
          noun="top-ups"
          rows={topUps}
          isLoading={transactionsLoading}
          empty="No top-ups yet."
          columns={[
            {
              key: 'topup',
              header: 'Top-up',
              cell: (row) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.reason}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {[row.description, row.createdAt ? `added ${day(row.createdAt)}` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ),
            },
            {
              key: 'credits',
              header: 'Credits',
              sortBy: (row) => Number(row.credits),
              cell: (row) => (
                <div>
                  <p className="text-success text-sm font-medium tabular-nums">
                    +{credits(row.credits)}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatMoney(row.amount)}
                  </p>
                </div>
              ),
            },
            { key: 'remaining', header: 'Remaining', cell: () => <NotTracked /> },
            { key: 'consumed', header: 'Consumed', cell: () => <NotTracked /> },
            { key: 'expires', header: 'Expires', cell: () => <NotTracked /> },
          ]}
        />
        <p className="text-muted-foreground border-t px-6 py-3 text-xs">
          Usage draws on the top-up that expires soonest, among those it is allowed to use.
        </p>
      </Section>

      {createDialog}
      <TopUpDialog
        open={dialog === 'top-up'}
        onClose={close}
        pending={pending}
        error={topUpError}
        onSubmit={(draft) => run(() => onTopUp(draft))}
      />
      <AutoTopupDialog
        key={`${wallet.id}:${autoTopupOpens}`}
        open={dialog === 'auto-topup'}
        onClose={close}
        pending={pending}
        error={autoTopupError}
        initial={wallet.autoTopup}
        currency={wallet.currency}
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

/** The API reports no per-top-up remaining, consumed or expiry, so these read as absent. */
const NotTracked = () => <span className="text-muted-foreground">—</span>

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

import { useState } from 'react'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { DateInput } from '@ui/compositions/forms/DateInput'
import {
  BellIcon,
  ArrowUpRightIcon,
  InfoIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RepeatIcon,
  WalletIcon,
  XCircleIcon,
} from '@ui/icons'
import {
  AUTO_TOPUP_COOLDOWN_UNIT_LABEL,
  WALLET_KIND_LABEL,
  AutoTopupCooldownUnit,
  type AutoTopup,
  type CreateWallet,
  type DebitWallet,
  type TopUpWallet,
  type Wallet,
  type WalletTransaction,
  WALLET_STATUS_LABEL,
  WalletStatus,
  autoTopupSchema,
  createWalletSchema,
  debitWalletSchema,
  emptyDebit,
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
import { ChoiceCards, Composer } from '../../compositions/detail/DetailKit'
import { MetadataCard } from '../../compositions/detail/MetadataCard'
import { Pill, type PillTone } from '../shared/cells'
import { WalletLedgerTable, formatCredits } from './WalletLedgerTable'
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
  /** The ledger read failed: the Transactions section shows it with a retry, never "No transactions yet". */
  transactionsError?: string | null
  transactionsErrorKind?: ErrorKind
  onRetryTransactions?: () => void
  /** Each action resolves when done and rejects on failure; the matching error is a sentence. */
  onCreateWallet: (draft: CreateWallet) => Promise<unknown>
  createError?: string | null
  onTopUp: (draft: TopUpWallet) => Promise<unknown>
  topUpError?: string | null
  onDebit: (draft: DebitWallet) => Promise<unknown>
  debitError?: string | null
  onTerminate: () => Promise<unknown>
  terminateError?: string | null
  onSaveAutoTopup: (draft: AutoTopup) => Promise<unknown>
  autoTopupError?: string | null
  /** More menu: the selected wallet's balance alerts. Omitted, the item is hidden. */
  onAlertSettings?: () => void
  /**
   * View only (an archived customer): every write is disabled, while picking
   * another wallet and reading its balance and ledger still work.
   */
  readOnly?: boolean
  /** Saves the selected wallet's metadata (the whole map). Omitted, the card is read-only. */
  onSaveMetadata?: (metadata: Record<string, string>) => Promise<unknown>
  /** Called when a dialog opens, so a stale error from the last attempt is cleared. */
  onResetErrors?: () => void
}

type Dialog = 'create' | 'top-up' | 'debit' | 'auto-topup' | 'terminate' | null

const CURRENCIES = currencyCodes().map((code) => ({ value: code, label: code }))

const credits = formatCredits

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
  onDebit,
  debitError = null,
  onTerminate,
  onAlertSettings,
  onSaveMetadata,
  readOnly = false,
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
    // The create action sits where the wallet's own actions do once one
    // exists, top right; the empty state only says what a wallet is.
    return (
      <div className="flex flex-col gap-5">
        <div className="flex justify-end">
          <Button className="h-8 px-3.5" onClick={() => open('create')} disabled={readOnly}>
            <PlusIcon aria-hidden="true" />
            Create wallet
          </Button>
        </div>
        <EmptyState
          scene="customers"
          size="inline"
          title="No wallet yet"
          description="A wallet holds prepaid credits this customer's usage draws down."
        />
        {createDialog}
      </div>
    )
  }

  // A terminated wallet, or a read-only page: no writes either way.
  const closed = wallet.status === WalletStatus.Closed || readOnly
  const currency = wallet.currency.toUpperCase()
  const asOf = now ?? new Date()
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
          <Button
            variant="outline"
            className="h-8 px-3.5"
            onClick={() => open('debit')}
            disabled={closed}
          >
            <MinusIcon aria-hidden="true" />
            Debit wallet
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
              {onAlertSettings ? (
                <DropdownMenuItem disabled={closed} onClick={onAlertSettings}>
                  <BellIcon className="text-muted-foreground" aria-hidden="true" />
                  Alert settings
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem disabled={readOnly} onClick={() => open('create')}>
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
        <div className="flex flex-wrap items-center gap-2 border-t px-6 py-4">
          <Pill tone={STATUS_TONE[wallet.status]}>{WALLET_STATUS_LABEL[wallet.status]}</Pill>
          {wallet.walletType ? <Pill>{WALLET_KIND_LABEL[wallet.walletType]}</Pill> : null}
          {/* The chip is also the way in: off never dead-ends, it opens the settings. */}
          <button
            type="button"
            disabled={closed}
            onClick={() => open('auto-topup')}
            aria-label={`Auto top-up ${wallet.autoTopup.enabled ? 'on' : 'off'}. Edit settings`}
            className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Pill tone={wallet.autoTopup.enabled ? 'success' : 'neutral'}>
              {wallet.autoTopup.enabled ? 'Auto top-up on' : 'Auto top-up off'}
            </Pill>
          </button>
        </div>
      </section>

      <Section table title="Transactions">
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
          <WalletLedgerTable transactions={transactions} now={asOf} />
        </SubTabState>
      </Section>

      <MetadataCard
        // One card per wallet: switching wallets mid-edit must not carry a draft across.
        key={wallet.id}
        description="Your own key/value fields on this wallet, for reporting or your systems."
        metadata={wallet.metadata}
        {...(onSaveMetadata && !closed ? { onSave: onSaveMetadata } : {})}
      />

      {createDialog}
      <TopUpDialog
        key={`top-up:${opens}`}
        open={dialog === 'top-up'}
        onClose={close}
        pending={pending}
        error={topUpError}
        onSubmit={(draft) => run(() => onTopUp(draft))}
      />
      <DebitDialog
        key={`debit:${opens}`}
        open={dialog === 'debit'}
        onClose={close}
        pending={pending}
        error={debitError}
        onSubmit={(draft) => run(() => onDebit(draft))}
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
        <ChoiceCards
          label="Wallet type"
          value={draft.walletType}
          onChange={(walletType) => set({ walletType })}
          choices={[
            {
              value: 'PRE_PAID',
              title: 'Prepaid',
              description: 'Credits are bought up front; usage draws them down in real time.',
              icon: <WalletIcon aria-hidden="true" />,
            },
            {
              value: 'POST_PAID',
              title: 'Postpaid',
              description: 'Credits are applied to invoices at the end of the billing cycle.',
              icon: <RepeatIcon aria-hidden="true" />,
            },
          ]}
        />
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
              htmlFor="wallet-topup-rate"
              hint="What one credit costs when it is bought, if that differs from the conversion rate. Optional."
            >
              Top-up rate
            </LabelWithHint>
            <InputGroup className="h-9">
              <InputGroupAddon align="inline-start">1 credit =</InputGroupAddon>
              <InputGroupInput
                id="wallet-topup-rate"
                inputMode="decimal"
                placeholder={draft.conversionRate}
                value={draft.topupConversionRate}
                onChange={(event) => set({ topupConversionRate: event.target.value })}
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
              htmlFor="wallet-initial-expiry"
              hint="The initial credits lapse on this day if they are not used. Optional."
            >
              Initial credits expire on
            </LabelWithHint>
            <DateInput
              id="wallet-initial-expiry"
              value={draft.initialCreditsExpiry}
              onValueChange={(initialCreditsExpiry) => set({ initialCreditsExpiry })}
              placeholder="Never"
              disabled={draft.initialCredits.trim() === ''}
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

function DebitDialog({
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
  onSubmit: (draft: DebitWallet) => void
}) {
  const [draft, setDraft] = useState<DebitWallet>(() => ({
    ...emptyDebit(),
    idempotencyKey: crypto.randomUUID(),
  }))
  const [problem, setProblem] = useState<string | null>(null)
  const set = (patch: Partial<DebitWallet>) => setDraft((current) => ({ ...current, ...patch }))

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Debit wallet"
    >
      <Composer
        submitLabel="Debit"
        onCancel={onClose}
        submitting={pending}
        onSubmit={() => {
          const parsed = debitWalletSchema.safeParse(draft)
          if (!parsed.success)
            return setProblem(parsed.error.issues[0]?.message ?? 'Check the form')
          setProblem(null)
          onSubmit(parsed.data)
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <LabelWithHint
              htmlFor="debit-credits"
              hint="How many credits to remove from the wallet."
            >
              Credits
            </LabelWithHint>
            <Input
              id="debit-credits"
              className="h-9"
              inputMode="decimal"
              value={draft.credits}
              onChange={(event) => set({ credits: event.target.value })}
            />
          </Field>
          <Field>
            <LabelWithHint htmlFor="debit-note" hint="Why the credits are being removed. Optional.">
              Note
            </LabelWithHint>
            <Input
              id="debit-note"
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
          <Field>
            <LabelWithHint
              htmlFor="topup-expiry"
              hint="The credits lapse on this day if they are not used. Optional."
            >
              Expires on
            </LabelWithHint>
            <DateInput
              id="topup-expiry"
              value={draft.expiryDate}
              onValueChange={(expiryDate) => set({ expiryDate })}
              placeholder="Never"
            />
          </Field>
          <Field>
            <LabelWithHint
              htmlFor="topup-priority"
              hint="Which credits are used first. A lower number is used sooner. Optional."
            >
              Priority
            </LabelWithHint>
            <Input
              id="topup-priority"
              className="h-9"
              inputMode="numeric"
              value={draft.priority}
              onChange={(event) => set({ priority: event.target.value })}
            />
          </Field>
          <Field className="sm:col-span-2">
            <LabelWithHint
              htmlFor="topup-reference"
              hint="A unique reference, such as a purchase order number. The same reference is never applied twice. Optional."
            >
              Reference ID
            </LabelWithHint>
            <Input
              id="topup-reference"
              className="h-9"
              value={draft.referenceId}
              onChange={(event) => set({ referenceId: event.target.value })}
            />
          </Field>
        </div>
        {draft.kind === 'purchased' ? (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <label htmlFor="topup-invoice" className="text-sm font-medium">
                Invoice the customer
              </label>
              <p className="text-muted-foreground text-xs">
                Raise an invoice for these credits. Off records them as already paid.
              </p>
            </div>
            <Switch
              id="topup-invoice"
              checked={draft.invoice}
              onCheckedChange={(invoice) => set({ invoice })}
            />
          </div>
        ) : null}
        {problem || error ? (
          <p role="alert" className="text-destructive text-sm">
            {problem ?? error}
          </p>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

const COOLDOWN_UNIT_OPTIONS = Object.values(AutoTopupCooldownUnit).map((value) => ({
  value,
  label: AUTO_TOPUP_COOLDOWN_UNIT_LABEL[value],
}))

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
            <InputGroup className="h-9" aria-disabled={!draft.enabled || undefined}>
              <InputGroupInput
                id="auto-topup-threshold"
                inputMode="decimal"
                value={draft.threshold}
                // Nothing to set until auto top-up is on.
                disabled={!draft.enabled}
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
            <InputGroup className="h-9" aria-disabled={!draft.enabled || undefined}>
              <InputGroupInput
                id="auto-topup-amount"
                inputMode="decimal"
                value={draft.amount}
                // Nothing to set until auto top-up is on.
                disabled={!draft.enabled}
                onChange={(event) => set({ amount: event.target.value })}
              />
              <InputGroupAddon align="inline-end">credits</InputGroupAddon>
            </InputGroup>
          </Field>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="auto-topup-cooldown-enabled" className="text-sm font-medium">
              Cool-off
            </label>
            <p className="text-muted-foreground text-xs">
              A least time between two automatic top-ups, so a burst of usage cannot trigger several
              in a row.
            </p>
          </div>
          <Switch
            id="auto-topup-cooldown-enabled"
            checked={draft.cooldownEnabled === true}
            disabled={!draft.enabled}
            onCheckedChange={(cooldownEnabled) =>
              set({
                cooldownEnabled,
                ...(cooldownEnabled && !draft.cooldownUnit
                  ? { cooldownUnit: AutoTopupCooldownUnit.Hour }
                  : {}),
              })
            }
          />
        </div>
        {draft.enabled && draft.cooldownEnabled ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <LabelWithHint
                htmlFor="auto-topup-cooldown"
                hint="How long to wait after a top-up before another may run."
              >
                Duration
              </LabelWithHint>
              <Input
                id="auto-topup-cooldown"
                inputMode="numeric"
                value={draft.cooldownValue ?? ''}
                onChange={(event) => set({ cooldownValue: event.target.value })}
              />
            </Field>
            <Field>
              <LabelWithHint
                htmlFor="auto-topup-cooldown-unit"
                hint="What the cool-off is counted in."
              >
                Unit
              </LabelWithHint>
              <OptionSelect
                id="auto-topup-cooldown-unit"
                value={draft.cooldownUnit ?? AutoTopupCooldownUnit.Hour}
                onValueChange={(cooldownUnit) =>
                  set({ cooldownUnit: cooldownUnit as AutoTopupCooldownUnit })
                }
                options={COOLDOWN_UNIT_OPTIONS}
              />
            </Field>
          </div>
        ) : null}
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

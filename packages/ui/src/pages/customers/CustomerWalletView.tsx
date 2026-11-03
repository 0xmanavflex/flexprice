import { useState } from 'react'
import { toast } from 'sonner'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { DateInput } from '@ui/compositions/forms/DateInput'
import {
  BellIcon,
  ArrowUpRightIcon,
  CopyIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RepeatIcon,
  WalletIcon,
  XCircleIcon,
} from '@ui/icons'
import {
  AUTO_TOPUP_COOLDOWN_UNIT_LABEL,
  AutoTopupCooldownUnit,
  type AutoTopup,
  type BonusCreditsConfig,
  type CreateWallet,
  type DebitWallet,
  type TopUpWallet,
  type Wallet,
  type WalletTransaction,
  WALLET_KIND_LABEL,
  WALLET_STATUS_LABEL,
  walletLabel,
  WalletStatus,
  autoTopupSchema,
  bonusExpiryText,
  bonusText,
  createWalletSchema,
  debitWalletSchema,
  emptyDebit,
  emptyTopUp,
  emptyWallet,
  formatMoney,
  money,
  resolveBonus,
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
import { InfoHint } from '@ui/compositions/forms/InfoHint'
import {
  AppFailure,
  ConfirmDialog,
  EmptyState,
  FormDialog,
  LoadingRows,
  OptionSelect,
} from '../../compositions'
import { ChoiceCards, Composer, Properties } from '../../compositions/detail/DetailKit'
import { MetadataCard } from '../../compositions/detail/MetadataCard'
import { Pill } from '../shared/cells'
import { WalletLedgerTable, formatCredits } from './WalletLedgerTable'
import { SubTabState } from '../../compositions/detail/SubTabState'
import type { ErrorKind } from '../../compositions/feedback/States'
import { WALLET_STATUS_TONE } from '../shared/statusTones'

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
  /** Settings → Wallets → Bonus credits, to preview the bonus a purchased top-up earns. */
  bonusConfig?: BonusCreditsConfig | null
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

/**
 * Wallet fields are amounts, rates and notes, never credentials. Without this a
 * browser or password manager offers saved logins on them and draws its key
 * icon, so they read as password fields.
 */
const NOT_A_LOGIN = {
  autoComplete: 'off',
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-bwignore': true,
  'data-form-type': 'other',
} as const

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
  bonusConfig = null,
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={wallet.id} onValueChange={(value) => value !== null && onSelect(value)}>
          <SelectTrigger className="h-9 w-64" aria-label="Wallet">
            <SelectValue>
              {(value) => {
                const chosen = wallets.find((candidate) => candidate.id === value)
                return chosen ? walletLabel(chosen) : value
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {wallets.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {walletLabel(candidate)}
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
              {/* Read-only, so it stays available on a closed wallet. */}
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard?.writeText(wallet.id)
                  toast.success('Wallet ID copied')
                }}
              >
                <CopyIcon className="text-muted-foreground" aria-hidden="true" />
                Copy wallet ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
        <UsageSinceInvoice wallet={wallet} />
        <div className="border-t px-6 py-4">
          <Properties
            columns={5}
            items={[
              {
                label: 'Status',
                value: (
                  <Pill tone={WALLET_STATUS_TONE[wallet.status]}>
                    {WALLET_STATUS_LABEL[wallet.status]}
                  </Pill>
                ),
              },
              {
                label: 'Type',
                value: wallet.walletType ? WALLET_KIND_LABEL[wallet.walletType] : '—',
              },
              { label: 'Consumption rate', value: creditRate(wallet.conversionRate, currency) },
              { label: 'Top-up rate', value: creditRate(wallet.topupConversionRate, currency) },
              {
                label: 'Auto top-up',
                value: (
                  <button
                    type="button"
                    disabled={closed}
                    onClick={() => open('auto-topup')}
                    aria-label={`Auto top-up ${wallet.autoTopup.enabled ? 'on' : 'off'}. Edit settings`}
                    className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm text-left outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {autoTopupSummary(wallet, currency)}
                  </button>
                ),
              },
            ]}
          />
        </div>
      </section>

      <section className="bg-background overflow-hidden rounded-xl border">
        <SubTabState
          hasData={transactions.length > 0}
          isLoading={transactionsLoading}
          error={transactionsError}
          errorKind={transactionsErrorKind}
          onRetry={onRetryTransactions}
          columns={5}
          loadingLabel="Loading transactions"
          empty={{
            scene: 'customers',
            title: 'No transactions yet',
            description:
              'Top-ups and debits on this wallet appear here. Open a debit to see which top-ups it drew from.',
          }}
        >
          <WalletLedgerTable transactions={transactions} now={asOf} noun="transactions" />
        </SubTabState>
      </section>

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
        bonusConfig={bonusConfig}
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
        {/* Currency, then what the wallet is for; the two rates side by side; the
            initial credits beside their expiry. */}
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
            <LabelWithHint
              htmlFor="wallet-description"
              hint="A note about what this wallet is for. Optional."
            >
              Description
            </LabelWithHint>
            <Input
              id="wallet-description"
              type="text"
              {...NOT_A_LOGIN}
              className="h-9"
              value={draft.description}
              onChange={(event) => set({ description: event.target.value })}
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
                type="text"
                {...NOT_A_LOGIN}
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
                type="text"
                {...NOT_A_LOGIN}
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
              type="text"
              {...NOT_A_LOGIN}
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
              type="text"
              {...NOT_A_LOGIN}
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
              type="text"
              {...NOT_A_LOGIN}
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
  bonusConfig,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  pending: boolean
  error: string | null
  bonusConfig: BonusCreditsConfig | null
  onSubmit: (draft: TopUpWallet) => void
}) {
  const [draft, setDraft] = useState<TopUpWallet>(emptyTopUp())
  // What the bonus settings would grant this top-up, when nothing is typed over them.
  const settled = resolveBonus(bonusConfig, draft.credits)
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
              type="text"
              {...NOT_A_LOGIN}
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
              type="text"
              {...NOT_A_LOGIN}
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
              type="text"
              {...NOT_A_LOGIN}
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
              type="text"
              {...NOT_A_LOGIN}
              className="h-9"
              value={draft.referenceId}
              onChange={(event) => set({ referenceId: event.target.value })}
            />
          </Field>
        </div>
        {draft.kind === 'purchased' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <LabelWithHint
                htmlFor="topup-bonus"
                hint="Extra credits granted with this top-up. Blank uses the bonus settings; a number here replaces them."
              >
                Bonus credits
              </LabelWithHint>
              <Input
                id="topup-bonus"
                type="text"
                {...NOT_A_LOGIN}
                className="h-9"
                inputMode="decimal"
                placeholder={settled ? settled.credits : 'From bonus settings'}
                value={draft.bonusCredits}
                onChange={(event) => set({ bonusCredits: event.target.value })}
              />
            </Field>
            <Field>
              <LabelWithHint
                htmlFor="topup-bonus-expiry"
                hint="The bonus credits lapse on this day. Overrides the expiry a bonus slab sets. Optional."
              >
                Bonus expires on
              </LabelWithHint>
              <DateInput
                id="topup-bonus-expiry"
                value={draft.bonusExpiryDate}
                onValueChange={(bonusExpiryDate) => set({ bonusExpiryDate })}
                placeholder={settled ? 'As the slab sets' : 'Never'}
              />
            </Field>
            {/* Said only once there is a bonus to describe: no line pointing at a
                setting that is not on this screen. */}
            <p
              className="text-muted-foreground text-xs empty:hidden sm:col-span-2"
              aria-live="polite"
            >
              {draft.bonusCredits.trim()
                ? `${draft.bonusCredits.trim()} bonus credits, as entered. The bonus settings are skipped for this top-up.`
                : settled
                  ? `Earns ${settled.credits} bonus credits: ${bonusText(settled.slab)}, ${draft.bonusExpiryDate ? 'expiring on the date above' : bonusExpiryText(settled.slab)}.`
                  : null}
            </p>
          </div>
        ) : null}
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
                type="text"
                {...NOT_A_LOGIN}
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
                type="text"
                {...NOT_A_LOGIN}
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
                type="text"
                {...NOT_A_LOGIN}
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

function creditRate(rate: string, currency: string): string {
  const trimmed = rate.trim()
  const value = Number(trimmed)
  if (!trimmed || !Number.isFinite(value)) return '—'
  const fraction = trimmed.split('.')[1]?.length ?? 0
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.min(6, Math.max(2, fraction)),
  }).format(value)
  return `1 credit = ${formatted}`
}

function autoTopupSummary(wallet: Wallet, currency: string): string {
  if (!wallet.autoTopup.enabled) return 'Off'
  const whole = (amount: string) => formatMoney(money(amount, currency)).replace(/\.00$/, '')
  return `Below ${whole(wallet.autoTopup.threshold)}, add ${whole(wallet.autoTopup.amount)}`
}

/**
 * Usage recorded since the last invoice, against what is still available.
 *
 * The share is used ÷ last invoiced balance, where used = last invoiced balance
 * − real-time balance (credits). The bar draws it and the legend states it.
 */
function UsageSinceInvoice({ wallet }: { wallet: Wallet }) {
  const invoiced = Number(wallet.creditBalance)
  const live = Number(wallet.realTimeCreditBalance)
  const used = Number.isFinite(invoiced) && Number.isFinite(live) ? Math.max(0, invoiced - live) : 0
  const available = Number.isFinite(live) ? Math.max(0, live) : 0
  const share = invoiced > 0 ? Math.min(1, used / invoiced) : 0
  const percent = invoiced > 0 ? Math.round(share * 100) : null
  const usedMoney = Math.max(
    0,
    Number(wallet.balance.amount) - Number(wallet.realTimeBalance.amount),
  )
  const usedLabel = formatCredits(String(used))
  const availableLabel = formatCredits(String(available))
  const usedValue = Number.isFinite(usedMoney)
    ? formatMoney(money(usedMoney.toFixed(2), wallet.balance.currency))
    : '—'
  return (
    <div className="flex flex-col gap-2 border-t px-6 py-4">
      <div
        className="bg-muted flex h-2 overflow-hidden rounded-full"
        role="img"
        aria-label={`${usedLabel} used, not yet invoiced${percent === null ? '' : ` (${percent}% of the last invoiced balance)`}. ${availableLabel} available.`}
      >
        <div className="bg-success h-full" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-success size-2 rounded-sm" aria-hidden />
          {usedLabel} used, not yet invoiced ({usedValue})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-muted-foreground/30 size-2 rounded-sm" aria-hidden />
          {availableLabel} available
        </span>
        {percent === null ? null : (
          <span className="ml-auto tabular-nums">{percent}% of the last invoiced balance used</span>
        )}
      </div>
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
        <InfoHint>{hint}</InfoHint>
      </p>
      <p className="text-3xl font-medium tabular-nums">
        {credits(creditValue)}{' '}
        <span className="text-muted-foreground text-base font-normal">credits</span>
      </p>
      <p className="text-muted-foreground text-sm tabular-nums">{value}</p>
    </div>
  )
}

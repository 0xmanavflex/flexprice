import { type ReactNode, useState } from 'react'
import {
  type PortalGateway,
  type PortalInvoice,
  type PortalPaymentMethod,
  type PortalWallet,
  creditsAfter,
  creditsCost,
  parseCreditAmount,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/components/primitives/dialog'
import { Field, FieldError, FieldLabel } from '@ui/components/primitives/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@ui/components/primitives/input-group'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { Spinner } from '@ui/components/primitives/spinner'
import { Textarea } from '@ui/components/primitives/textarea'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Money } from '../shared/Money'
import { formatNumber } from './format'
import type { PayVia } from './types'

/**
 * The portal's dialogs: pay an invoice, add credits, add a card, remove a card.
 * Each one runs its action, shows the error in place if it fails, and closes
 * when it is done or handed to the gateway's page.
 */
export const PortalDialogsProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/dialog',
    'primitives/radio-group',
    'primitives/input-group',
    'primitives/field',
    'compositions/feedback/ConfirmDialog',
  ],
  note: 'Customer portal pay, add-credits and add-card dialogs, after the reference portal.',
})

const GENERIC = 'Something went wrong. Please try again.'

/** Runs an action with a pending flag and an error message. */
function useRun(onDone: () => void) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => Promise<void>) => {
    setPending(true)
    setError(null)
    try {
      await action()
      onDone()
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : GENERIC)
    } finally {
      setPending(false)
    }
  }
  return { pending, error, run }
}

function PortalDialog({
  open,
  onOpenChange,
  pending,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  title: string
  description: ReactNode
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (pending && !next ? undefined : onOpenChange(next))}
    >
      <DialogContent
        showCloseButton={!pending}
        className="flex max-h-[90svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-base font-medium">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {children}
        </div>
        <DialogFooter className="border-t px-6 py-4">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface ChoiceOption {
  value: string
  label: ReactNode
  description?: ReactNode
  aside?: ReactNode
  disabled?: boolean
}

/** Radio cards: one bordered row per option, the chosen one ringed. */
export function OptionCards({
  label,
  value,
  onChange,
  options,
  columns = 1,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: ChoiceOption[]
  columns?: 1 | 2 | 4
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(String(next))}
        className={cn(
          'grid gap-2',
          columns === 2 && 'sm:grid-cols-2',
          columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors',
              value === option.value
                ? 'border-primary/60 bg-primary/4 ring-primary/20 ring-2'
                : 'hover:bg-muted/40',
              option.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <RadioGroupItem value={option.value} disabled={option.disabled ?? false} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium">{option.label}</span>
              {option.description ? (
                <span className="text-muted-foreground text-xs">{option.description}</span>
              ) : null}
            </span>
            {option.aside ? (
              <span className="text-muted-foreground shrink-0 text-xs">{option.aside}</span>
            ) : null}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

/* ---- Pay an invoice ------------------------------------------------------- */

export function PayInvoiceDialog({
  invoice,
  gateways,
  brandName,
  locale,
  onClose,
  onPay,
}: {
  invoice: PortalInvoice | null
  gateways: PortalGateway[]
  brandName: string | null
  locale: string | undefined
  onClose: () => void
  onPay: (invoice: PortalInvoice, provider: string | null) => Promise<void>
}) {
  const options = gateways.filter((g) => g.paysInvoices)
  const [provider, setProvider] = useState<string>('')
  const chosen = options.find((g) => g.provider === provider) ?? options[0] ?? null
  const { pending, error, run } = useRun(onClose)
  const amount = invoice ? (
    <Money value={invoice.amountDue} {...(locale ? { locale } : {})} />
  ) : null

  return (
    <PortalDialog
      open={invoice !== null}
      onOpenChange={(open) => !open && onClose()}
      pending={pending}
      title={invoice ? `Pay ${invoice.number}` : 'Pay invoice'}
      description={<>{amount} due</>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending || !invoice || options.length === 0}
            onClick={() => invoice && void run(() => onPay(invoice, chosen?.provider ?? null))}
          >
            {pending ? <Spinner /> : null}
            Pay {amount}
          </Button>
        </>
      }
    >
      {options.length === 0 ? (
        <Alert>
          <AlertDescription>
            Online payment isn’t set up for this account. Contact {brandName ?? 'your account team'}{' '}
            to pay this invoice.
          </AlertDescription>
        </Alert>
      ) : (
        <OptionCards
          label="Pay with"
          value={chosen?.provider ?? ''}
          onChange={setProvider}
          options={options.map((g) => ({
            value: g.provider,
            label: g.label,
            description: 'Opens a secure payment page in a new tab. Saved cards are offered there.',
          }))}
        />
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </PortalDialog>
  )
}

/* ---- Add credits ---------------------------------------------------------- */

const PRESETS = ['1000', '2500', '5000', '10000']

export function AddCreditsDialog({
  wallet,
  gateways,
  defaultCard,
  locale,
  onClose,
  onAdd,
}: {
  wallet: PortalWallet | null
  gateways: PortalGateway[]
  /** The saved card a top-up can charge right away, if any. */
  defaultCard: PortalPaymentMethod | null
  locale: string | undefined
  onClose: () => void
  onAdd: (wallet: PortalWallet, credits: string, via: PayVia, note: string) => Promise<void>
}) {
  const [raw, setRaw] = useState('5000')
  const [via, setVia] = useState<string>(defaultCard ? 'saved' : '')
  const [note, setNote] = useState('')
  const { pending, error, run } = useRun(onClose)
  const checkouts = gateways.filter((g) => g.checkout)
  const methods = [
    ...(defaultCard
      ? [
          {
            value: 'saved',
            label: `${defaultCard.brand} •••• ${defaultCard.last4}`,
            description: 'Charged now',
          },
        ]
      : []),
    ...checkouts.map((g) => ({
      value: g.provider,
      label: `${g.label} checkout`,
      description: 'Opens in a new tab',
    })),
  ]
  const method = methods.find((m) => m.value === via) ?? methods[0]
  const credits = parseCreditAmount(raw)
  const money = (value: PortalWallet['balance']) => (
    <Money value={value} {...(locale ? { locale } : {})} />
  )
  const cost = wallet && credits ? creditsCost(credits, wallet.creditPrice, wallet.currency) : null
  const after = wallet && credits ? creditsAfter(wallet.credits, credits) : null

  const submit = () => {
    if (!wallet || !credits || !method) return
    const payVia: PayVia =
      method.value === 'saved' ? { kind: 'saved' } : { kind: 'checkout', provider: method.value }
    void run(() => onAdd(wallet, credits, payVia, note))
  }

  return (
    <PortalDialog
      open={wallet !== null}
      onOpenChange={(open) => !open && onClose()}
      pending={pending}
      title="Add credits"
      description={
        wallet ? (
          <>
            To {wallet.name}. 1 credit ={' '}
            {money({ amount: wallet.creditPrice, currency: wallet.currency })}.
          </>
        ) : null
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending || !credits || !method || !cost} onClick={submit}>
            {pending ? <Spinner /> : null}
            {cost ? <>Pay {money(cost)}</> : 'Pay'}
          </Button>
        </>
      }
    >
      {wallet ? (
        <>
          <OptionCards
            label="Credits"
            value={PRESETS.includes(credits ?? '') ? (credits ?? '') : ''}
            onChange={setRaw}
            columns={4}
            options={PRESETS.map((p) => {
              const price = creditsCost(p, wallet.creditPrice, wallet.currency)
              return {
                value: p,
                label: formatNumber(p, locale),
                description: price ? money(price) : null,
              }
            })}
          />
          <Field>
            <FieldLabel htmlFor="portal-credits">Or enter an amount</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="portal-credits"
                inputMode="numeric"
                value={raw}
                aria-invalid={!credits}
                onChange={(event) => setRaw(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>credits</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {!credits ? <FieldError>Enter a number of credits above zero.</FieldError> : null}
          </Field>
          {methods.length > 0 && method ? (
            <OptionCards
              label="Pay with"
              value={method.value}
              onChange={setVia}
              options={methods}
            />
          ) : (
            <Alert>
              <AlertDescription>
                Buying credits online isn’t set up for this account.
              </AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="portal-credits-note">Note (optional)</FieldLabel>
            <Textarea
              id="portal-credits-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <dl className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-4 text-sm">
            <Row label="Credits" value={credits ? formatNumber(credits, locale) : '—'} />
            <Row
              label="New balance"
              value={after ? `${formatNumber(after, locale)} credits` : '—'}
            />
            <Row label="You pay" value={cost ? money(cost) : '—'} strong />
          </dl>
          {error ? <FieldError>{error}</FieldError> : null}
        </>
      ) : null}
    </PortalDialog>
  )
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string
  value: ReactNode
  strong?: boolean
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('tabular-nums', strong && 'font-medium')}>{value}</dd>
    </div>
  )
}

/* ---- Cards ---------------------------------------------------------------- */

export function AddCardDialog({
  open,
  gateways,
  onClose,
  onAdd,
}: {
  open: boolean
  gateways: PortalGateway[]
  onClose: () => void
  onAdd: (provider: string) => Promise<void>
}) {
  const options = gateways.filter((g) => g.savesCards)
  const [provider, setProvider] = useState('')
  const chosen = options.find((g) => g.provider === provider) ?? options[0] ?? null
  const { pending, error, run } = useRun(onClose)
  return (
    <PortalDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      pending={pending}
      title="Add a card"
      description="Card details are entered on the payment provider’s page, never here."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending || !chosen}
            onClick={() => chosen && void run(() => onAdd(chosen.provider))}
          >
            {pending ? <Spinner /> : null}
            Continue
          </Button>
        </>
      }
    >
      <OptionCards
        label="Provider"
        value={chosen?.provider ?? ''}
        onChange={setProvider}
        options={options.map((g) => ({
          value: g.provider,
          label: g.label,
          description: g.autoCharge
            ? 'Can pay invoices and top-ups automatically'
            : 'Used at checkout only',
        }))}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </PortalDialog>
  )
}

export function RemoveCardDialog({
  card,
  onClose,
  onRemove,
}: {
  card: PortalPaymentMethod | null
  onClose: () => void
  onRemove: (card: PortalPaymentMethod) => Promise<void>
}) {
  const { pending, error, run } = useRun(onClose)
  return (
    <ConfirmDialog
      open={card !== null}
      onOpenChange={(open) => !open && !pending && onClose()}
      title="Remove this card?"
      description={
        card
          ? `${card.brand} •••• ${card.last4} will no longer pay invoices or automatic top-ups.${card.isDefault ? ' It is your default card.' : ''}`
          : undefined
      }
      confirmLabel="Remove card"
      pendingLabel="Removing…"
      destructive
      isPending={pending}
      error={error}
      onConfirm={() => card && void run(() => onRemove(card))}
    />
  )
}

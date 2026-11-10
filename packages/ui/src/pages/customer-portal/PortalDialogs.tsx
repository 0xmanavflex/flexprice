import { type ReactNode, useState } from 'react'
import {
  type PortalCooldownUnit,
  type PortalGateway,
  type PortalOpenCheckout,
  type PortalInvoice,
  type PortalPaymentMethod,
  type PortalWallet,
  creditsAfter,
  creditsCost,
  moneyFormatLocale,
  parseCreditAmount,
} from '@fp/domain'
import { ExternalLinkIcon, FileTextIcon, SheetIcon, TriangleAlertIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Spinner } from '@ui/components/primitives/spinner'
import { Field, FieldError, FieldLabel } from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@ui/components/primitives/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Switch } from '@ui/components/primitives/switch'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Money } from '../shared/Money'
import { IntegrationMark } from '../customers/IntegrationMark'
import { CardLogo } from './CardLogo'
import { formatNumber } from './format'
import { CheckoutLinkPanel, RadioRows } from './parts'
import type { AddCreditsResult, AutoTopupSettings, PayVia } from './types'

/**
 * The portal's dialogs, after the portal prototype (`portal/flows.tsx`): pay an
 * invoice, add credits, auto top-up, add a card, remove a card and download.
 * Each is the kit's FormDialog and Composer; a write that hands off to a
 * gateway's page keeps the link on screen (CheckoutLinkPanel) until the
 * customer says they have paid.
 */
export const PortalDialogsProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/forms/FormDialog',
    'compositions/detail/DetailKit',
    'compositions/feedback/ConfirmDialog',
    'primitives/input-group',
    'primitives/switch',
    'primitives/select',
    'reui/alert',
  ],
  note: 'Customer portal flows, after the portal prototype: pay, add credits (checkout-3), auto top-up, add card, remove card, download.',
})

const GENERIC = 'Something went wrong. Please try again.'

/** Runs a write with a pending flag and an error; resolves what the write did. */
function useRun() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setPending(true)
    setError(null)
    try {
      return await action()
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : GENERIC)
      return undefined
    } finally {
      setPending(false)
    }
  }
  return { pending, error, run, reset: () => setError(null) }
}

function copy(url: string, onCopied: () => void) {
  void navigator.clipboard?.writeText(url).then(onCopied, () => undefined)
}

/* ---- Pay an invoice ------------------------------------------------------ */

/** `POST /invoices/{id}/pay`: a payment page from the chosen gateway, in this tab. */
export function PayInvoiceDialog({
  invoice,
  gateways,
  brandName,
  locale,
  onClose,
  onPay,
  onPaid,
  onCopied,
}: {
  invoice: PortalInvoice | null
  gateways: PortalGateway[]
  brandName: string | null
  locale: string | undefined
  onClose: () => void
  onPay: (invoice: PortalInvoice, provider: string | null) => Promise<string | null>
  /** "I've paid": refresh and close. */
  onPaid: () => void
  onCopied: () => void
}) {
  const options = gateways.filter((g) => g.paysInvoices)
  const [provider, setProvider] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const chosen = options.find((g) => g.provider === provider) ?? options[0] ?? null
  const { pending, error, run } = useRun()
  const amount = invoice ? (
    <Money value={invoice.amountDue} {...(locale ? { locale } : {})} />
  ) : null
  const close = () => {
    setLink(null)
    onClose()
  }

  return (
    <FormDialog
      open={invoice !== null}
      onOpenChange={(open) => !open && close()}
      title={link ? 'Complete your payment' : invoice ? `Pay ${invoice.number}` : 'Pay invoice'}
      description={link ? undefined : <>{amount} due</>}
      size="sm"
      isPending={pending}
    >
      {link ? (
        <CheckoutLinkPanel
          url={link}
          amount={amount}
          onCopy={() => copy(link, onCopied)}
          onDone={() => {
            onPaid()
            close()
          }}
        />
      ) : (
        <Composer
          submitLabel={invoice ? `Pay ${amountText(invoice, locale)}` : 'Pay'}
          onCancel={close}
          submitting={pending}
          disabled={!invoice || options.length === 0}
          onSubmit={() => {
            if (!invoice) return
            void run(() => onPay(invoice, chosen?.provider ?? null)).then((url) => {
              if (url) setLink(url)
              else if (url === null) close()
            })
          }}
        >
          {options.length === 0 ? (
            <Alert>
              <AlertDescription>
                Online payment isn’t set up for this account. Contact{' '}
                {brandName ?? 'your account team'} to pay this invoice.
              </AlertDescription>
            </Alert>
          ) : options.length === 1 && options[0] ? (
            <OnlyMethod
              media={<GatewayMark provider={options[0].provider} label={options[0].label} />}
              label={`Pay with ${options[0].label}`}
              description="Opens a secure payment page. Saved cards are offered there."
            />
          ) : (
            <RadioRows
              label="Payment method"
              value={chosen?.provider ?? ''}
              onChange={setProvider}
              options={options.map((g) => ({
                value: g.provider,
                media: <GatewayMark provider={g.provider} label={g.label} />,
                label: `Pay with ${g.label}`,
                description: 'Opens a secure payment page. Saved cards are offered there.',
              }))}
            />
          )}
          {error ? <FieldError>{error}</FieldError> : null}
        </Composer>
      )}
    </FormDialog>
  )
}

function amountText(invoice: PortalInvoice, locale: string | undefined): string {
  void locale
  return new Intl.NumberFormat(moneyFormatLocale(invoice.amountDue.currency), {
    style: 'currency',
    currency: invoice.amountDue.currency,
  }).format(Number(invoice.amountDue.amount))
}

/** A payment gateway's logo, from the same files as the Integrations page. */
function GatewayMark({ provider, label }: { provider: string; label: string }) {
  return (
    <IntegrationMark
      integration={{ id: provider.toLowerCase(), name: label }}
      className="size-8 rounded-md"
    />
  )
}

/**
 * The one way to pay, when there is no choice to make: the same row as a
 * `RadioRows` option, without the radio.
 */
function OnlyMethod({
  media,
  label,
  description,
}: {
  media: ReactNode
  label: string
  description: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3.5 py-3">
      {media}
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  )
}

/**
 * The API made no new checkout because one is already open for this wallet,
 * possibly at another gateway: finish that one, or cancel it and pay as picked.
 */
function OpenCheckoutStep({
  checkout,
  picked,
  payLabel,
  pending,
  error,
  onContinue,
  onReplace,
}: {
  checkout: PortalOpenCheckout
  /** The gateway picked in the form, when it is a checkout. */
  picked: string | null
  /** "Pay $5,000.00". */
  payLabel: string
  pending: boolean
  error: string | null
  onContinue: () => void
  onReplace: () => void
}) {
  const until = checkout.expiresAt
    ? checkout.expiresAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null
  const otherGateway = picked !== null && picked !== checkout.label
  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">
        You started a {checkout.label} checkout for this wallet that isn’t finished yet, so no new
        one was made. Finish that one, or cancel it and{' '}
        {otherGateway ? `pay with ${picked}` : 'start again'}.
      </p>
      <OnlyMethod
        media={<GatewayMark provider={checkout.provider} label={checkout.label} />}
        label={`${checkout.label} checkout`}
        description={until ? `Open until ${until}` : 'Still open'}
      />
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-5">
        {checkout.url ? (
          <Button
            variant="outline"
            className="h-8 px-3"
            disabled={pending}
            nativeButton={false}
            render={
              <a
                href={checkout.url}
                target="_blank"
                rel="noopener noreferrer"
                role="link"
                onClick={onContinue}
              />
            }
          >
            <ExternalLinkIcon aria-hidden="true" />
            Open {checkout.label} checkout
          </Button>
        ) : null}
        <Button className="h-8 px-3" disabled={pending} onClick={onReplace}>
          {pending ? <Spinner aria-hidden className="size-3.5" /> : null}
          Cancel it and {payLabel.charAt(0).toLowerCase()}
          {payLabel.slice(1)}
          {otherGateway ? ` with ${picked}` : ''}
        </Button>
      </div>
    </div>
  )
}

/* ---- Add credits --------------------------------------------------------- */

const PRESETS = ['1000', '2500', '5000', '10000']

/**
 * Add credits: an amount (with presets), what it costs and how to pay, in one
 * step (ReUI checkout-3). `POST /wallets/{id}/top-up`, with the saved card or a
 * gateway's checkout.
 */
export function AddCreditsDialog({
  wallet,
  gateways,
  defaultCard,
  locale,
  onClose,
  onAdd,
  onPaid,
  onCopied,
}: {
  wallet: PortalWallet | null
  gateways: PortalGateway[]
  /** The saved card a top-up can charge right away, if any. */
  defaultCard: PortalPaymentMethod | null
  locale: string | undefined
  onClose: () => void
  onAdd: (
    wallet: PortalWallet,
    credits: string,
    via: PayVia,
    note: string,
  ) => Promise<AddCreditsResult>
  onPaid: () => void
  onCopied: () => void
}) {
  const [raw, setRaw] = useState('5000')
  /** The checkout the API answered with instead of making a new one. */
  const [alreadyOpen, setAlreadyOpen] = useState<PortalOpenCheckout | null>(null)
  /** The open checkout was continued, so the amount is not this form's. */
  const [continued, setContinued] = useState(false)
  const [via, setVia] = useState(defaultCard ? 'saved' : '')
  const [note, setNote] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const { pending, error, run } = useRun()
  const checkouts = gateways.filter((g) => g.checkout)
  const credits = parseCreditAmount(raw)
  const money = (value: PortalWallet['balance']) => (
    <Money value={value} {...(locale ? { locale } : {})} />
  )
  const cost = wallet && credits ? creditsCost(credits, wallet.creditPrice, wallet.currency) : null
  const after = wallet && credits ? creditsAfter(wallet.credits, credits) : null
  const methods = [...(defaultCard ? ['saved'] : []), ...checkouts.map((g) => g.provider)]
  const method = methods.includes(via) ? via : (methods[0] ?? '')
  const methodOptions = [
    ...(defaultCard
      ? [
          {
            value: 'saved',
            media: <CardLogo network={defaultCard.network} label={defaultCard.brand} />,
            label: `${defaultCard.brand} •••• ${defaultCard.last4}`,
            description: 'Charged now · credits land right away',
          },
        ]
      : []),
    ...checkouts.map((g) => ({
      value: g.provider,
      media: <GatewayMark provider={g.provider} label={g.label} />,
      label: `${g.label} checkout`,
      description: `Pay on ${g.label}’s secure page`,
    })),
  ]
  const close = () => {
    setLink(null)
    setAlreadyOpen(null)
    setContinued(false)
    onClose()
  }
  const payLabel = cost
    ? `Pay ${new Intl.NumberFormat(moneyFormatLocale(cost.currency), { style: 'currency', currency: cost.currency }).format(Number(cost.amount))}`
    : 'Pay'
  const submit = (replace: boolean) => {
    if (!wallet || !credits || !method) return
    const payVia: PayVia =
      method === 'saved' && defaultCard
        ? { kind: 'saved', provider: defaultCard.provider }
        : { kind: 'checkout', provider: method, ...(replace ? { replace: true } : {}) }
    void run(() => onAdd(wallet, credits, payVia, note)).then((result) => {
      if (result === undefined) return
      if (result === null) close()
      else if (typeof result === 'string') {
        setAlreadyOpen(null)
        setLink(result)
      } else setAlreadyOpen(result.alreadyOpen)
    })
  }
  const picked = checkouts.find((g) => g.provider === method)

  return (
    <FormDialog
      open={wallet !== null}
      onOpenChange={(open) => !open && close()}
      title={
        link ? 'Complete your payment' : alreadyOpen ? 'A checkout is already open' : 'Add credits'
      }
      description={
        link || alreadyOpen || !wallet ? undefined : (
          <>
            To {wallet.name}. 1 credit ={' '}
            {money({ amount: wallet.creditPrice, currency: wallet.currency })}.
          </>
        )
      }
      size="sm"
      isPending={pending}
    >
      {link ? (
        <CheckoutLinkPanel
          url={link}
          // A saved card's link is its bank's approval page; a checkout's is the gateway's.
          purpose={method === 'saved' ? 'confirm' : 'pay'}
          amount={continued ? null : cost ? money(cost) : null}
          onCopy={() => copy(link, onCopied)}
          onDone={() => {
            onPaid()
            close()
          }}
        />
      ) : alreadyOpen ? (
        <OpenCheckoutStep
          checkout={alreadyOpen}
          picked={picked?.label ?? null}
          payLabel={payLabel}
          pending={pending}
          error={error}
          onContinue={() => {
            setContinued(true)
            setLink(alreadyOpen.url)
            setAlreadyOpen(null)
          }}
          onReplace={() => submit(true)}
        />
      ) : wallet ? (
        <Composer
          submitLabel={payLabel}
          onCancel={close}
          submitting={pending}
          disabled={!credits || !cost || !method}
          onSubmit={() => submit(false)}
        >
          <Field>
            <FieldLabel>Credits</FieldLabel>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="radiogroup"
              aria-label="Credit amount"
            >
              {PRESETS.map((p) => {
                const price = creditsCost(p, wallet.creditPrice, wallet.currency)
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={credits === p}
                    onClick={() => setRaw(p)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-left transition-colors',
                      credits === p
                        ? 'border-primary/60 bg-primary/4 ring-primary/20 ring-2'
                        : 'hover:bg-muted/40',
                    )}
                  >
                    <span className="block text-sm font-medium tabular-nums">
                      {formatNumber(p, locale)}
                    </span>
                    <span className="text-muted-foreground block text-xs tabular-nums">
                      {price ? money(price) : null}
                    </span>
                  </button>
                )
              })}
            </div>
            <InputGroup className="mt-1 h-9">
              <InputGroupInput
                inputMode="numeric"
                value={raw}
                aria-invalid={!credits}
                onChange={(event) => setRaw(event.target.value)}
                aria-label="Custom amount of credits"
                placeholder="Or enter an amount"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>credits</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {!credits ? <FieldError>Enter how many credits to add.</FieldError> : null}
          </Field>

          <Field>
            <FieldLabel>Pay with</FieldLabel>
            {methodOptions.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Buying credits online isn’t set up for this account.
                </AlertDescription>
              </Alert>
            ) : methodOptions.length === 1 && methodOptions[0] ? (
              <OnlyMethod {...methodOptions[0]} />
            ) : (
              <RadioRows
                label="Payment method"
                value={method}
                onChange={setVia}
                options={methodOptions}
              />
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="portal-credits-note">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </FieldLabel>
            <Input
              id="portal-credits-note"
              className="h-9"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What is this top-up for?"
            />
          </Field>

          <dl className="bg-muted/40 grid grid-cols-[1fr_auto] gap-y-1.5 rounded-lg border px-4 py-3 text-[13px]">
            <dt className="text-muted-foreground">Credits</dt>
            <dd className="text-right tabular-nums">
              {credits ? formatNumber(credits, locale) : '—'}
            </dd>
            <dt className="text-muted-foreground">New balance</dt>
            <dd className="text-right tabular-nums">
              {after ? `${formatNumber(after, locale)} credits` : '—'}
            </dd>
            <dt className="mt-1.5 border-t pt-2 text-sm font-medium">You pay</dt>
            <dd className="mt-1.5 border-t pt-2 text-right text-sm font-medium tabular-nums">
              {cost ? money(cost) : '—'}
            </dd>
          </dl>
          {error ? <FieldError>{error}</FieldError> : null}
        </Composer>
      ) : null}
    </FormDialog>
  )
}

/* ---- Auto top-up --------------------------------------------------------- */

const UNITS: PortalCooldownUnit[] = ['second', 'minute', 'hour', 'day']

/** `PUT /wallets/{id}/auto-topup` {enabled, threshold, amount, cooldown}. Needs a card that can be charged. */
export function AutoTopupDialog({
  wallet,
  card,
  locale,
  onClose,
  onSave,
}: {
  wallet: PortalWallet | null
  card: PortalPaymentMethod | null
  locale: string | undefined
  onClose: () => void
  onSave: (wallet: PortalWallet, settings: AutoTopupSettings) => Promise<void>
}) {
  const a = wallet?.autoTopup ?? null
  const { pending, error, run } = useRun()
  const money = (credits: string) => {
    const value = wallet ? creditsCost(credits || '0', wallet.creditPrice, wallet.currency) : null
    return value ? <Money value={value} {...(locale ? { locale } : {})} /> : null
  }
  const cardLabel = card ? `${card.brand} •••• ${card.last4}` : null

  return (
    <FormDialog
      open={wallet !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Auto top-up"
      description={
        a?.enabled && a.threshold && a.credits ? (
          <>
            When your balance falls below {formatNumber(a.threshold, locale)} credits (
            {money(a.threshold)}), we add {formatNumber(a.credits, locale)} credits (
            {money(a.credits)}){cardLabel ? ` using ${cardLabel}` : ''}.
          </>
        ) : (
          'Turn it on to refill your balance automatically, so usage never pauses.'
        )
      }
      isPending={pending}
    >
      {wallet ? (
        <AutoTopupForm
          // The form starts from the saved settings. When they arrive or change
          // (a refetch after a save), it starts again from them rather than
          // keep showing what was on screen before.
          key={savedKey(a, card)}
          wallet={wallet}
          saved={a}
          card={card}
          cardLabel={cardLabel}
          money={money}
          pending={pending}
          error={error}
          run={run}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </FormDialog>
  )
}

/** What the form is seeded from: the saved settings, or (with none) whether a card can be charged. */
function savedKey(saved: PortalWallet['autoTopup'], card: PortalPaymentMethod | null): string {
  return saved ? JSON.stringify(saved) : `none:${card ? 'card' : 'no-card'}`
}

function AutoTopupForm({
  wallet,
  saved: a,
  card,
  cardLabel,
  money,
  pending,
  error,
  run,
  onClose,
  onSave,
}: {
  wallet: PortalWallet
  saved: PortalWallet['autoTopup']
  card: PortalPaymentMethod | null
  cardLabel: string | null
  money: (credits: string) => ReactNode
  pending: boolean
  error: string | null
  run: ReturnType<typeof useRun>['run']
  onClose: () => void
  onSave: (wallet: PortalWallet, settings: AutoTopupSettings) => Promise<void>
}) {
  const [enabled, setEnabled] = useState(a?.enabled ?? Boolean(card))
  const [threshold, setThreshold] = useState(a?.threshold ?? '500')
  const [amount, setAmount] = useState(a?.credits ?? '2000')
  const [cool, setCool] = useState(Boolean(a?.cooldown))
  const [coolValue, setCoolValue] = useState(String(a?.cooldown?.value ?? 6))
  const [coolUnit, setCoolUnit] = useState<PortalCooldownUnit>(a?.cooldown?.unit ?? 'hour')
  return (
    <Composer
      submitLabel="Save"
      onCancel={onClose}
      submitting={pending}
      disabled={enabled && !card}
      onSubmit={() =>
        void run(async () => {
          const below = parseCreditAmount(threshold)
          const add = parseCreditAmount(amount)
          if (enabled && (!below || !add)) {
            throw new Error('Enter a balance and an amount of credits, both more than zero.')
          }
          await onSave(wallet, {
            enabled,
            threshold: below,
            credits: add,
            // Off clears a wait already saved (`0`); with none saved there is nothing to send.
            cooldown: cool
              ? { value: Math.max(1, Math.floor(Number(coolValue)) || 1), unit: coolUnit }
              : a?.cooldown
                ? { value: 0, unit: a.cooldown.unit }
                : null,
          })
          onClose()
        })
      }
    >
      <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
        <span>
          <span className="block text-sm">Top up automatically</span>
          <span className="text-muted-foreground block text-xs">
            {cardLabel ? `Charged to ${cardLabel}` : 'Needs a saved card'}
          </span>
        </span>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable auto top-up" />
      </label>

      {!card ? (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>No saved card</AlertTitle>
          <AlertDescription>
            Add a card on the Overview tab to turn on automatic top-ups.
          </AlertDescription>
        </Alert>
      ) : null}

      <fieldset
        disabled={!enabled}
        className={cn('grid gap-5 sm:grid-cols-2', !enabled && 'opacity-50')}
      >
        <Field>
          <FieldLabel htmlFor="auto-threshold">When balance falls below</FieldLabel>
          <InputGroup className="h-9">
            <InputGroupInput
              id="auto-threshold"
              inputMode="numeric"
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>credits</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <p className="text-muted-foreground text-xs tabular-nums">
            {money(parseCreditAmount(threshold) ?? '0')}
          </p>
        </Field>
        <Field>
          <FieldLabel htmlFor="auto-amount">Add</FieldLabel>
          <InputGroup className="h-9">
            <InputGroupInput
              id="auto-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>credits</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <p className="text-muted-foreground text-xs tabular-nums">
            Charged {money(parseCreditAmount(amount) ?? '0')} each time
          </p>
        </Field>
      </fieldset>

      <fieldset disabled={!enabled} className={cn('space-y-3', !enabled && 'opacity-50')}>
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm">Wait between top-ups</span>
            <span className="text-muted-foreground block text-xs">
              Avoids several charges in a burst of usage
            </span>
          </span>
          <Switch checked={cool} onCheckedChange={setCool} aria-label="Wait between top-ups" />
        </label>
        {cool ? (
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <Input
              className="h-9"
              inputMode="numeric"
              value={coolValue}
              onChange={(event) => setCoolValue(event.target.value)}
              aria-label="Wait duration"
            />
            <Select
              value={coolUnit}
              onValueChange={(value) => value && setCoolUnit(value as PortalCooldownUnit)}
            >
              <SelectTrigger className="h-9 w-full" aria-label="Wait unit">
                <SelectValue>{(value) => `${String(value)}s`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}s
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </fieldset>
      {error ? <FieldError>{error}</FieldError> : null}
    </Composer>
  )
}

/* ---- Cards --------------------------------------------------------------- */

/**
 * After "Add card": the portal is on its way to the gateway's secure card form
 * (V1's flow, no step before it). This keeps its link on screen in case the
 * page does not open, and "I've added it" refreshes the cards.
 */
export function CardLinkDialog({
  url,
  onClose,
  onAdded,
  onCopied,
}: {
  url: string | null
  onClose: () => void
  onAdded: () => void
  onCopied: () => void
}) {
  return (
    <FormDialog
      open={url !== null}
      onOpenChange={(next) => !next && onClose()}
      title="Add your card"
      size="sm"
    >
      {url ? (
        <CheckoutLinkPanel
          url={url}
          amount={null}
          purpose="card"
          onCopy={() => copy(url, onCopied)}
          onDone={() => {
            onAdded()
            onClose()
          }}
        />
      ) : null}
    </FormDialog>
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
  const { pending, error, run } = useRun()
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
      onConfirm={() =>
        card &&
        void run(async () => {
          await onRemove(card)
          onClose()
        })
      }
    />
  )
}

/* ---- Download ------------------------------------------------------------ */

/** The invoice as a PDF (`GET /invoices/{id}/pdf`), or its lines as a CSV built here. */
export function DownloadDialog({
  invoice,
  onClose,
  onPdf,
}: {
  invoice: PortalInvoice | null
  onClose: () => void
  onPdf: (invoice: PortalInvoice) => Promise<void>
}) {
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf')
  const { pending, error, run } = useRun()
  return (
    <FormDialog
      open={invoice !== null}
      onOpenChange={(open) => !open && onClose()}
      title={invoice ? `Download ${invoice.number}` : 'Download'}
      size="sm"
      isPending={pending}
    >
      {invoice ? (
        <Composer
          submitLabel="Download"
          onCancel={onClose}
          submitting={pending}
          onSubmit={() =>
            void run(async () => {
              if (format === 'pdf') await onPdf(invoice)
              else downloadCsv(invoice)
              onClose()
            })
          }
        >
          <RadioRows
            label="Format"
            value={format}
            onChange={(value) => setFormat(value as 'pdf' | 'csv')}
            options={[
              {
                value: 'pdf',
                media: <FileTextIcon className="text-muted-foreground size-4" aria-hidden="true" />,
                label: 'PDF',
                description: 'The invoice as sent, for your records',
              },
              {
                value: 'csv',
                media: <SheetIcon className="text-muted-foreground size-4" aria-hidden="true" />,
                label: 'CSV',
                description: 'Line items, to import into a spreadsheet',
              },
            ]}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Composer>
      ) : null}
    </FormDialog>
  )
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** The invoice's lines as CSV, saved in the browser: item, type, quantity, amount, currency. */
function downloadCsv(invoice: PortalInvoice): void {
  const rows: string[][] = [['Item', 'Type', 'Quantity', 'Amount', 'Currency']]
  for (const line of invoice.lines) {
    rows.push([line.name, line.kind ?? '', line.quantity, line.amount.amount, line.amount.currency])
  }
  const text = rows.map((row) => row.map((cell) => csvCell(String(cell))).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${invoice.number}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

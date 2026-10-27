import { useState, type ReactNode } from 'react'
import {
  BILLING_PERIOD_LABEL,
  BUCKET_SIZE_LABEL,
  BillingPeriod,
  BucketSize,
  COMMITMENT_KIND_LABEL,
  type ChargeCommitment,
  type CommitmentPriceBase,
  CommitmentType,
  type CommitmentWindow,
  WINDOW_BILLING_MODEL_LABEL,
  WindowBillingModel,
  chargeCommitmentSchema,
  currencySymbol,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Field as FieldBox,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@ui/components/primitives/input-group'
import { Switch } from '@ui/components/primitives/switch'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { Field } from '@ui/compositions/forms/Field'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { PlusIcon, XIcon } from '@ui/icons'
import { provenance } from '@ui/provenance'

/**
 * One usage charge's commitment on a new contract, opened from that charge's
 * menu: the bucket usage is summed in, what is committed and over which
 * period, the overage factor, true-up, per-bucket, and optional UTC time
 * windows that each carry their own commitment and price.
 *
 * The dialog keeps its own draft and hands the form a whole commitment on
 * save, or null when it is cleared.
 */
export const ChargeCommitmentDialogProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-dialog',
    'compositions/detail-kit',
    'compositions/field',
    'compositions/option-select',
    'ui/field',
    'ui/input',
    'ui/input-group',
    'ui/switch',
  ],
  note: 'The contract wizard’s per-charge commitment dialog (reference CommitmentDialog).',
})

export interface ChargeCommitmentDialogProps {
  /** The charge being configured; the dialog is closed while this is null. */
  charge: {
    priceId: string
    name: string
    /** "Per unit · $0.0450 per unit": the charge as it is priced now. */
    description: string
    /** The bucket the plan charge sums usage in, when it has one. */
    bucketSize: BucketSize | ''
    /** Seeds a new window's price. */
    unitAmount: string
    /**
     * With `unitAmount` a price per package: the package's size, so a new
     * window starts as a package price rather than reading it as per unit.
     */
    packageSize?: string | undefined
    priceBase: CommitmentPriceBase | undefined
  } | null
  commitment: ChargeCommitment | undefined
  currency: string
  onClose: () => void
  onSave: (next: ChargeCommitment | null) => void
}

const SAME_PERIOD = 'SAME'
const WHOLE_PERIOD = 'NONE'

const KIND_OPTIONS = Object.values(CommitmentType).map((kind) => ({
  value: kind,
  label: COMMITMENT_KIND_LABEL[kind],
}))

const PERIOD_OPTIONS = [
  { value: SAME_PERIOD, label: 'Same as billing period' },
  ...[
    BillingPeriod.Daily,
    BillingPeriod.Monthly,
    BillingPeriod.Quarterly,
    BillingPeriod.HalfYearly,
    BillingPeriod.Annual,
  ].map((period) => ({ value: period, label: BILLING_PERIOD_LABEL[period] })),
]

const BUCKET_OPTIONS = [
  { value: WHOLE_PERIOD, label: 'Whole billing period' },
  ...Object.values(BucketSize).map((size) => ({ value: size, label: BUCKET_SIZE_LABEL[size] })),
]

const MODEL_OPTIONS = Object.values(WindowBillingModel).map((model) => ({
  value: model,
  label: WINDOW_BILLING_MODEL_LABEL[model],
}))

/** The day in 15-minute steps, `00:00` to `23:45`. */
const TIMES = Array.from(
  { length: 96 },
  (_, i) =>
    `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
)
const HOURS = TIMES.filter((time) => time.endsWith(':00'))

let windowSeq = 0

function newWindow(price: string, packageSize = ''): CommitmentWindow {
  windowSeq += 1
  return {
    id: `window_${windowSeq}`,
    start: '00:00',
    end: '20:00',
    type: CommitmentType.Quantity,
    value: '',
    overageFactor: '',
    trueUp: false,
    billingModel: packageSize ? WindowBillingModel.Package : WindowBillingModel.PerUnit,
    price,
    packageSize,
  }
}

function emptyCommitment(
  priceId: string,
  bucketSize: BucketSize | '',
  priceBase: CommitmentPriceBase | undefined,
): ChargeCommitment {
  return {
    priceId,
    type: CommitmentType.Amount,
    value: '',
    duration: '',
    overageFactor: '1',
    trueUp: false,
    bucketSize,
    windowed: false,
    windows: [],
    ...(priceBase ? { priceBase } : {}),
  }
}

export function ChargeCommitmentDialog({
  charge,
  commitment,
  currency,
  onClose,
  onSave,
}: ChargeCommitmentDialogProps) {
  return (
    <FormDialog
      open={charge !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
      size="lg"
      title={commitment ? 'Edit commitment' : 'Configure commitment'}
    >
      {charge ? (
        <CommitmentBody
          key={charge.priceId}
          charge={charge}
          commitment={commitment}
          currency={currency}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </FormDialog>
  )
}

/** A field-path error from the schema, by its dotted path. */
type Errors = Record<string, string>

function CommitmentBody({
  charge,
  commitment,
  currency,
  onClose,
  onSave,
}: Omit<ChargeCommitmentDialogProps, 'charge'> & {
  charge: NonNullable<ChargeCommitmentDialogProps['charge']>
}) {
  const [draft, setDraft] = useState<ChargeCommitment>(
    () => commitment ?? emptyCommitment(charge.priceId, charge.bucketSize, charge.priceBase),
  )
  const [errors, setErrors] = useState<Errors>({})
  const set = (patch: Partial<ChargeCommitment>) =>
    setDraft((current) => ({ ...current, ...patch }))
  const setWindow = (id: string, patch: Partial<CommitmentWindow>) =>
    set({ windows: draft.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) })

  const symbol = currencySymbol(currency)
  const code = currency.trim().toUpperCase()
  const bucketLabel = draft.bucketSize ? BUCKET_SIZE_LABEL[draft.bucketSize].toLowerCase() : ''
  const hourly = /hour|day/.test(bucketLabel)
  const times = hourly ? HOURS : TIMES
  const windowed = draft.windowed && Boolean(draft.bucketSize)
  const valueLabel = (type: CommitmentType) =>
    type === CommitmentType.Amount ? `Commitment (${code})` : 'Commitment (units)'

  const save = () => {
    const next = { ...draft, windowed, windows: windowed ? draft.windows : [] }
    const parsed = chargeCommitmentSchema.safeParse(next)
    if (!parsed.success) {
      const found: Errors = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.')
        if (!(path in found)) found[path] = issue.message
      }
      setErrors(found)
      return
    }
    onSave(parsed.data)
  }

  return (
    <Composer
      submitLabel={commitment ? 'Update commitment' : 'Save commitment'}
      onSubmit={save}
      onCancel={onClose}
      secondary={
        commitment ? (
          <Button
            type="button"
            variant="outline"
            className="text-destructive h-8"
            onClick={() => onSave(null)}
          >
            Clear commitment
          </Button>
        ) : null
      }
    >
      <p className="text-muted-foreground -mt-2 text-sm">
        {charge.name} · {charge.description}
      </p>
      <div className="max-w-sm">
        <Field
          label="Bucket size"
          hint="Usage is summed in buckets of this size before it is priced. A commitment on each bucket needs one."
        >
          {({ id }) => (
            <OptionSelect
              id={id}
              value={draft.bucketSize || WHOLE_PERIOD}
              onValueChange={(next) =>
                set({ bucketSize: next === WHOLE_PERIOD ? '' : (next as BucketSize) })
              }
              options={BUCKET_OPTIONS}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-x-4 gap-y-5 border-t pt-5 sm:grid-cols-2">
        <Field label="Committed" hint="Whether the customer commits to spend or to usage.">
          {({ id }) => (
            <OptionSelect
              id={id}
              value={draft.type}
              onValueChange={(type) => set({ type: type as CommitmentType })}
              options={KIND_OPTIONS}
            />
          )}
        </Field>
        <Field
          label={valueLabel(draft.type)}
          required
          error={errors['value']}
          hint={
            draft.type === CommitmentType.Amount
              ? 'The minimum spend on this charge.'
              : 'The minimum usage of this charge.'
          }
        >
          {({ id, required: _required, ...field }) => (
            <InputGroup>
              {draft.type === CommitmentType.Amount ? (
                <InputGroupAddon align="inline-start">
                  <InputGroupText>{symbol}</InputGroupText>
                </InputGroupAddon>
              ) : null}
              <InputGroupInput
                id={id}
                {...field}
                aria-required={_required}
                autoFocus
                inputMode="decimal"
                placeholder={draft.type === CommitmentType.Amount ? '1,000.00' : '10,000'}
                value={draft.value}
                onChange={(event) => set({ value: event.target.value })}
              />
              {draft.type === CommitmentType.Quantity ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupText>units</InputGroupText>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          )}
        </Field>
        <Field label="Commitment period" hint="Duration the commitment applies for.">
          {({ id }) => (
            <OptionSelect
              id={id}
              value={draft.duration || SAME_PERIOD}
              onValueChange={(next) =>
                set({
                  duration: next === SAME_PERIOD ? '' : (next as ChargeCommitment['duration']),
                })
              }
              options={PERIOD_OPTIONS}
            />
          )}
        </Field>
        <Field
          label="Overage factor"
          required
          error={errors['overageFactor']}
          hint="Usage past the commitment is billed at the normal rate times this factor. 1 means no premium."
        >
          {({ id, required: _required, ...field }) => (
            <Input
              id={id}
              {...field}
              aria-required={_required}
              inputMode="decimal"
              placeholder="1.0"
              value={draft.overageFactor}
              onChange={(event) => set({ overageFactor: event.target.value })}
            />
          )}
        </Field>
        <ToggleBox
          id={`commitment-true-up-${charge.priceId}`}
          label="True-up"
          hint="Bill the unused commitment when usage stays under it."
          checked={draft.trueUp}
          onChange={(trueUp) => set({ trueUp })}
        />
        <ToggleBox
          id={`commitment-windowed-${charge.priceId}`}
          label="Apply to each bucket"
          hint={
            draft.bucketSize
              ? `The commitment applies to every ${bucketLabel} bucket, not the whole period.`
              : 'Set a bucket size above first.'
          }
          checked={windowed}
          disabled={!draft.bucketSize}
          onChange={(next) => set({ windowed: next })}
        />
      </div>

      {windowed ? (
        <div className="flex flex-col gap-3 border-t pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Time windows</p>
              <p className="text-muted-foreground text-xs">
                Optional. UTC windows, start inclusive, end exclusive. The rest of the day keeps the
                commitment above.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                set({
                  windows: [...draft.windows, newWindow(charge.unitAmount, charge.packageSize)],
                })
              }
            >
              <PlusIcon aria-hidden />
              Add window
            </Button>
          </div>
          {draft.windows.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-5 text-center text-sm">
              No time windows yet.
            </p>
          ) : null}
          {draft.windows.map((w, index) => {
            const at = (field: string) => errors[`windows.${index}.${field}`]
            return (
              <section
                key={w.id}
                aria-label={`Window ${index + 1}`}
                className="flex flex-col gap-4 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Window {index + 1}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove window ${index + 1}`}
                    onClick={() => set({ windows: draft.windows.filter((x) => x.id !== w.id) })}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </div>
                <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                  <Field label="Start (UTC)" error={at('start')}>
                    {({ id }) => (
                      <OptionSelect
                        id={id}
                        value={w.start}
                        onValueChange={(start) => setWindow(w.id, { start })}
                        options={times.map((time) => ({ value: time, label: time }))}
                      />
                    )}
                  </Field>
                  <Field label="End (UTC)">
                    {({ id }) => (
                      <OptionSelect
                        id={id}
                        value={w.end}
                        onValueChange={(end) => setWindow(w.id, { end })}
                        options={times.map((time) => ({ value: time, label: time }))}
                      />
                    )}
                  </Field>
                  <Field label="Committed">
                    {({ id }) => (
                      <OptionSelect
                        id={id}
                        value={w.type}
                        onValueChange={(type) => setWindow(w.id, { type: type as CommitmentType })}
                        options={KIND_OPTIONS}
                      />
                    )}
                  </Field>
                  <Field label={valueLabel(w.type)} required error={at('value')}>
                    {({ id, required: _required, ...field }) => (
                      <Input
                        id={id}
                        {...field}
                        aria-required={_required}
                        inputMode="decimal"
                        placeholder="Value"
                        value={w.value}
                        onChange={(event) => setWindow(w.id, { value: event.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Overage factor" error={at('overageFactor')}>
                    {({ id, required: _required, ...field }) => (
                      <Input
                        id={id}
                        {...field}
                        aria-required={_required}
                        inputMode="decimal"
                        placeholder="1.0"
                        value={w.overageFactor}
                        onChange={(event) => setWindow(w.id, { overageFactor: event.target.value })}
                      />
                    )}
                  </Field>
                  <ToggleBox
                    id={`window-true-up-${w.id}`}
                    label="True-up"
                    hint="Bill the unused commitment in this window."
                    checked={w.trueUp}
                    onChange={(trueUp) => setWindow(w.id, { trueUp })}
                  />
                  <Field label="Billing model" hint="How usage in this window is billed.">
                    {({ id }) => (
                      <OptionSelect
                        id={id}
                        value={w.billingModel}
                        onValueChange={(model) =>
                          setWindow(w.id, { billingModel: model as WindowBillingModel })
                        }
                        options={MODEL_OPTIONS}
                      />
                    )}
                  </Field>
                  <Field
                    label={
                      w.billingModel === WindowBillingModel.Package
                        ? `Price per package (${code})`
                        : `Price (${code})`
                    }
                    required
                    error={at('price')}
                    hint="Unit price applied during this time window."
                  >
                    {({ id, required: _required, ...field }) => (
                      <InputGroup>
                        <InputGroupAddon align="inline-start">
                          <InputGroupText>{symbol}</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          id={id}
                          {...field}
                          aria-required={_required}
                          inputMode="decimal"
                          placeholder="Amount"
                          value={w.price}
                          onChange={(event) => setWindow(w.id, { price: event.target.value })}
                        />
                      </InputGroup>
                    )}
                  </Field>
                  {w.billingModel === WindowBillingModel.Package ? (
                    <Field
                      label="Units per package"
                      hint="Number of units included in each package."
                      error={at('packageSize')}
                    >
                      {({ id, required: _required, ...field }) => (
                        <Input
                          id={id}
                          {...field}
                          aria-required={_required}
                          inputMode="numeric"
                          placeholder="1"
                          value={w.packageSize}
                          onChange={(event) => setWindow(w.id, { packageSize: event.target.value })}
                        />
                      )}
                    </Field>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      ) : null}
    </Composer>
  )
}

/** A switch in a bordered box with its label and a line under it: true-up and per-bucket. */
function ToggleBox({
  id,
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  id: string
  label: string
  hint: ReactNode
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <FieldLabel htmlFor={id}>
      <FieldBox orientation="horizontal" data-disabled={disabled || undefined}>
        <FieldContent>
          <FieldTitle>{label}</FieldTitle>
          <FieldDescription>{hint}</FieldDescription>
        </FieldContent>
        <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      </FieldBox>
    </FieldLabel>
  )
}

/**
 * One line about a charge's commitment: "Commits $1,000.00 per billing period ·
 * true-up", "Commits 10,000 units monthly · per minute, 2 windows".
 */
export function commitmentText(commitment: ChargeCommitment, currency: string): string {
  const amount = Number(commitment.value)
  const code = currency.trim().toUpperCase()
  let what: string
  if (commitment.type === CommitmentType.Amount) {
    try {
      what = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: /^[A-Z]{3}$/.test(code) ? code : 'USD',
        currencyDisplay: 'narrowSymbol',
      }).format(amount)
    } catch {
      what = `${commitment.value} ${code}`
    }
  } else {
    what = `${amount.toLocaleString('en-US')} units`
  }
  const when = commitment.duration
    ? BILLING_PERIOD_LABEL[commitment.duration].toLowerCase()
    : 'per billing period'
  const count = commitment.windows.length
  const windowed =
    commitment.windowed && commitment.bucketSize
      ? ` · per ${BUCKET_SIZE_LABEL[commitment.bucketSize].toLowerCase()}${count ? `, ${count} window${count > 1 ? 's' : ''}` : ''}`
      : ''
  return `Commits ${what} ${when}${windowed}${commitment.trueUp ? ' · true-up' : ''}`
}

import { Button } from '@ui/components/primitives/button'
import { PlusIcon, XIcon } from '@ui/icons'
import {
  BILLING_PERIOD_LABEL,
  BUCKET_SIZE_LABEL,
  BillingPeriod,
  BucketSize,
  COMMITMENT_KIND_LABEL,
  CommitmentKind,
  type ContractTermsErrors,
  type LineCommitment,
  type UsageTerms,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { CheckboxRow } from '@ui/compositions/forms/CheckboxRow'
import { Field } from '@ui/compositions/forms/Field'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

export const UsageTermsFieldsProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/field',
    'compositions/option-select',
    'compositions/checkbox-row',
    'ui/input',
  ],
  note: 'What a metered charge adds to its price on one contract: the bucket usage is summed in and an optional commitment with its overage and true-up.',
})

export interface UsageTermsFieldsProps {
  allowNewWindows?: boolean

  value: UsageTerms
  onChange: (next: UsageTerms) => void
  errors?: ContractTermsErrors
  disabled?: boolean
  /** The unit a spend commitment is written in (a currency code or a price unit). */
  unitLabel?: string
}

const WHOLE_PERIOD = 'NONE'
const SAME_PERIOD = 'SAME'

/** The same choices as the commitment dialog on an existing charge. */
const PERIOD_OPTIONS = [
  { value: SAME_PERIOD, label: 'Same as billing period' },
  ...[
    BillingPeriod.Daily,
    BillingPeriod.Weekly,
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

const KIND_OPTIONS = Object.values(CommitmentKind).map((kind) => ({
  value: kind,
  label: COMMITMENT_KIND_LABEL[kind],
}))

const NEW_COMMITMENT: LineCommitment = {
  kind: CommitmentKind.Amount,
  value: '',
  windowed: false,
  overageFactor: '1',
  trueUp: false,
}

/** Bucket size and commitment for a metered charge on one contract. */
export function UsageTermsFields({
  value,
  onChange,
  allowNewWindows = false,
  errors = {},
  disabled = false,
  unitLabel = '',
}: UsageTermsFieldsProps) {
  const commitment = value.commitment
  const setCommitment = (patch: Partial<LineCommitment>) =>
    commitment && onChange({ ...value, commitment: { ...commitment, ...patch } })

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-4">
      {/* Named for assistive tech only: a visible legend above the Bucket size label read as two headers. */}
      <legend className="sr-only">Usage terms</legend>

      <div className="max-w-sm">
        <Field
          label="Bucket size"
          hint="Usage is summed in buckets of this size before it is priced. Leave on whole period to sum it across the billing period."
        >
          {({ id }) => (
            <OptionSelect
              id={id}
              value={value.bucketSize || WHOLE_PERIOD}
              onValueChange={(next) =>
                onChange({
                  ...value,
                  bucketSize: next === WHOLE_PERIOD ? '' : (next as BucketSize),
                })
              }
              options={BUCKET_OPTIONS}
              disabled={disabled}
            />
          )}
        </Field>
      </div>

      <CheckboxRow
        checked={commitment !== null}
        disabled={disabled}
        onCheckedChange={(checked) =>
          onChange({ ...value, commitment: checked ? NEW_COMMITMENT : null })
        }
      >
        Add a commitment
      </CheckboxRow>

      {commitment ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Committed" hint="Whether the customer commits to spend or to usage.">
            {({ id }) => (
              <OptionSelect
                id={id}
                value={commitment.kind}
                onValueChange={(kind) => setCommitment({ kind: kind as CommitmentKind })}
                options={KIND_OPTIONS}
                disabled={disabled}
              />
            )}
          </Field>
          <Field
            label={
              commitment.kind === CommitmentKind.Amount
                ? `Commitment${unitLabel ? ` (${unitLabel})` : ''}`
                : 'Commitment (units)'
            }
            required
            error={errors.commitmentValue}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="decimal"
                value={commitment.value}
                disabled={disabled}
                {...field}
                onChange={(event) => setCommitment({ value: event.target.value })}
              />
            )}
          </Field>
          <Field label="Commitment period" hint="How long each commitment runs before it resets.">
            {({ id, ...field }) => (
              <OptionSelect
                id={id}
                {...field}
                value={commitment.duration || SAME_PERIOD}
                onValueChange={(next) =>
                  setCommitment({
                    duration: next === SAME_PERIOD ? null : (next as BillingPeriod),
                  })
                }
                options={PERIOD_OPTIONS}
                disabled={disabled}
              />
            )}
          </Field>
          <Field
            label="Overage factor"
            hint="Usage past the commitment is billed at the normal rate times this factor. 1 means no premium."
            required
            error={errors.overageFactor}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="decimal"
                value={commitment.overageFactor}
                disabled={disabled}
                {...field}
                onChange={(event) => setCommitment({ overageFactor: event.target.value })}
              />
            )}
          </Field>
          <div className="flex flex-col justify-end gap-3 pb-1.5">
            {/* Per bucket needs buckets: without a bucket size it stays off. */}
            <CheckboxRow
              checked={commitment.windowed && value.bucketSize !== ''}
              disabled={disabled || value.bucketSize === ''}
              onCheckedChange={(windowed) => setCommitment({ windowed })}
            >
              {value.bucketSize === ''
                ? 'Apply to each bucket (set a bucket size first)'
                : 'Apply to each bucket'}
            </CheckboxRow>
            <CheckboxRow
              checked={commitment.trueUp}
              disabled={disabled}
              onCheckedChange={(trueUp) => setCommitment({ trueUp })}
              description="Bill the committed minimum even when usage is below it."
            >
              Enable true-up
            </CheckboxRow>
          </div>
        </div>
      ) : null}
      {commitment && (allowNewWindows || commitment.windows !== undefined) ? (
        <Field
          label="Time windows (UTC)"
          error={errors.windows}
          hint="Each window keeps its own price. New windows use the charge’s price above."
        >
          {() => (
            <div className="flex flex-col gap-4">
              <CheckboxRow
                checked={(commitment.windows ?? []).length > 0}
                onCheckedChange={(checked) => {
                  if (!checked) setCommitment({ windows: [], windowed: false })
                }}
                disabled={disabled || (commitment.windows ?? []).length === 0}
              >
                Use time windows
              </CheckboxRow>
              {(commitment.windows ?? []).map((window, index) => {
                const change = (patch: Partial<typeof window>) =>
                  setCommitment({
                    windows: (commitment.windows ?? []).map((item, i) =>
                      i === index ? { ...item, ...patch } : item,
                    ),
                  })
                return (
                  <div key={window.id || index} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label={`Window ${index + 1} start (UTC)`}>
                      {({ id }) => (
                        <Input
                          id={id}
                          placeholder="HH:MM"
                          value={window.start}
                          onChange={(event) => change({ start: event.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={`Window ${index + 1} end (UTC)`}>
                      {({ id }) => (
                        <Input
                          id={id}
                          placeholder="HH:MM"
                          value={window.end}
                          onChange={(event) => change({ end: event.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={`Window ${index + 1} commitment`}>
                      {({ id }) => (
                        <Input
                          id={id}
                          inputMode="decimal"
                          value={window.value}
                          onChange={(event) => change({ value: event.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={`Window ${index + 1} commitment type`}>
                      {({ id }) => (
                        <OptionSelect
                          id={id}
                          value={window.kind ?? commitment.kind}
                          onValueChange={(kind) => change({ kind: kind as CommitmentKind })}
                          options={KIND_OPTIONS}
                        />
                      )}
                    </Field>
                    <Field label={`Window ${index + 1} overage factor`}>
                      {({ id }) => (
                        <Input
                          id={id}
                          inputMode="decimal"
                          value={window.overageFactor}
                          onChange={(event) => change({ overageFactor: event.target.value })}
                        />
                      )}
                    </Field>
                    <CheckboxRow
                      checked={window.trueUp}
                      onCheckedChange={(trueUp) => change({ trueUp })}
                    >
                      Bill unused window commitment
                    </CheckboxRow>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() =>
                        setCommitment({
                          windows: (commitment.windows ?? []).filter((_, i) => i !== index),
                        })
                      }
                    >
                      <XIcon aria-hidden />
                      Remove window {index + 1}
                    </Button>
                  </div>
                )
              })}
              {allowNewWindows ? (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() =>
                    setCommitment({
                      windowed: true,
                      windows: [
                        ...(commitment.windows ?? []),
                        {
                          id: '',
                          start: '00:00',
                          end: '24:00',
                          value: commitment.value,
                          kind: commitment.kind,
                          overageFactor: commitment.overageFactor,
                          trueUp: commitment.trueUp,
                        },
                      ],
                    })
                  }
                >
                  <PlusIcon aria-hidden />
                  Add time window
                </Button>
              ) : null}
            </div>
          )}
        </Field>
      ) : null}
    </fieldset>
  )
}

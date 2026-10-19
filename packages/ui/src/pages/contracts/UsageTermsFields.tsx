import {
  BUCKET_SIZE_LABEL,
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
  value: UsageTerms
  onChange: (next: UsageTerms) => void
  errors?: ContractTermsErrors
  disabled?: boolean
  /** The unit a spend commitment is written in (a currency code or a price unit). */
  unitLabel?: string
}

const WHOLE_PERIOD = 'NONE'

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
            <CheckboxRow
              checked={commitment.windowed}
              disabled={disabled}
              onCheckedChange={(windowed) => setCommitment({ windowed })}
            >
              Apply to each bucket
            </CheckboxRow>
            <CheckboxRow
              checked={commitment.trueUp}
              disabled={disabled}
              onCheckedChange={(trueUp) => setCommitment({ trueUp })}
            >
              Bill the unused commitment
            </CheckboxRow>
          </div>
        </div>
      ) : null}
    </fieldset>
  )
}

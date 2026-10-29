import {
  BONUS_EXPIRY_UNIT_LABEL,
  type BonusExpiryUnit,
  type BonusSlab,
  BonusType,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { Trash2Icon } from '@ui/icons'
import { SimpleTable } from '../../../compositions/detail/DetailKit'
import { provenance } from '@ui/provenance'

/**
 * The bonus-credit slabs editor: "a top-up of at least N credits earns this
 * bonus", one row each.
 *
 * Controlled over a `BonusSlab[]`, as `TierTable` is over tiers; adding a slab
 * is the owning section's header action. Rows can be
 * typed in any order: the backend takes the highest threshold a top-up clears,
 * and the request sorts them. Validation is the domain's
 * (`bonusCreditsConfigSchema`); this shows the per-row messages it is handed.
 */
export const BonusSlabTableProvenance = provenance({
  source: 'composition',
  composes: ['composition/DetailKit', 'ui/input', 'ui/button', 'compositions/option-select'],
  note: 'Controlled bonus-credit slab editor: threshold, flat or percentage bonus, optional expiry.',
})

export interface BonusSlabRowError {
  threshold?: string | undefined
  bonusValue?: string | undefined
  expiryDuration?: string | undefined
}

export interface BonusSlabTableProps {
  slabs: BonusSlab[]
  onChange: (slabs: BonusSlab[]) => void
  /** Inline messages, by row index. */
  rowErrors?: Record<number, BonusSlabRowError>
  disabled?: boolean
}

const TYPE_OPTIONS = [
  { value: BonusType.Percentage, label: '% of top-up' },
  { value: BonusType.Flat, label: 'Credits' },
]

const UNIT_OPTIONS = (Object.keys(BONUS_EXPIRY_UNIT_LABEL) as BonusExpiryUnit[]).map((unit) => ({
  value: unit,
  label: BONUS_EXPIRY_UNIT_LABEL[unit],
}))

function RowError({ message }: { message: string | undefined }) {
  return message ? (
    <p role="alert" className="text-destructive mt-1 text-xs">
      {message}
    </p>
  ) : null
}

export function BonusSlabTable({
  slabs,
  onChange,
  rowErrors,
  disabled = false,
}: BonusSlabTableProps) {
  const setSlab = (index: number, patch: Partial<BonusSlab>) =>
    onChange(slabs.map((slab, i) => (i === index ? { ...slab, ...patch } : slab)))

  return (
    <div className="flex flex-col gap-2">
      {slabs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <SimpleTable
            rows={slabs.map((slab, index) => ({ slab, index }))}
            getRowId={(row) => String(row.index)}
            columns={[
              {
                key: 'threshold',
                header: 'Top-up of at least',
                className: 'w-[22%] whitespace-normal py-2 align-top',
                cell: ({ slab, index }) => (
                  <>
                    <Input
                      inputMode="decimal"
                      aria-label={`Slab ${index + 1} top-up of at least`}
                      aria-invalid={rowErrors?.[index]?.threshold ? true : undefined}
                      placeholder="100"
                      disabled={disabled}
                      value={slab.threshold}
                      onChange={(event) => setSlab(index, { threshold: event.target.value })}
                    />
                    <RowError message={rowErrors?.[index]?.threshold} />
                  </>
                ),
              },
              {
                key: 'bonus',
                header: 'Bonus',
                className: 'w-[38%] whitespace-normal py-2 align-top',
                cell: ({ slab, index }) => (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Input
                        inputMode="decimal"
                        aria-label={`Slab ${index + 1} bonus`}
                        aria-invalid={rowErrors?.[index]?.bonusValue ? true : undefined}
                        placeholder="10"
                        disabled={disabled}
                        className="w-20"
                        value={slab.bonusValue}
                        onChange={(event) => setSlab(index, { bonusValue: event.target.value })}
                      />
                      <OptionSelect
                        aria-label={`Slab ${index + 1} bonus type`}
                        value={slab.bonusType}
                        options={TYPE_OPTIONS}
                        disabled={disabled}
                        onValueChange={(value) =>
                          setSlab(index, { bonusType: value as BonusSlab['bonusType'] })
                        }
                      />
                    </div>
                    <RowError message={rowErrors?.[index]?.bonusValue} />
                  </>
                ),
              },
              {
                key: 'expiry',
                header: 'Bonus expires after',
                className: 'w-[34%] whitespace-normal py-2 align-top',
                cell: ({ slab, index }) => (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Input
                        inputMode="numeric"
                        aria-label={`Slab ${index + 1} bonus expires after`}
                        aria-invalid={rowErrors?.[index]?.expiryDuration ? true : undefined}
                        placeholder="Never"
                        disabled={disabled}
                        className="w-20"
                        value={slab.expiryDuration}
                        onChange={(event) => setSlab(index, { expiryDuration: event.target.value })}
                      />
                      <OptionSelect
                        aria-label={`Slab ${index + 1} expiry unit`}
                        value={slab.expiryUnit}
                        options={UNIT_OPTIONS}
                        disabled={disabled || !slab.expiryDuration}
                        onValueChange={(value) =>
                          setSlab(index, { expiryUnit: value as BonusExpiryUnit })
                        }
                      />
                    </div>
                    <RowError message={rowErrors?.[index]?.expiryDuration} />
                  </>
                ),
              },
              {
                key: 'remove',
                header: <span className="sr-only">Remove</span>,
                className: 'w-10 py-2 align-top',
                cell: ({ index }) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove slab ${index + 1}`}
                    disabled={disabled}
                    onClick={() => onChange(slabs.filter((_, i) => i !== index))}
                  >
                    <Trash2Icon aria-hidden className="size-4" />
                  </Button>
                ),
              },
            ]}
          />
        </div>
      ) : null}
    </div>
  )
}

import { type Tier, withPackageSize } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { PlusIcon, Trash2Icon } from '@ui/icons'
import { SimpleTable } from '../../../compositions/detail/DetailKit'
import { InfoHint } from '../../../compositions/forms/InfoHint'
import { provenance } from '@ui/provenance'

/**
 * The tier bands editor.
 *
 * A controlled table over a `Tier[]`: the parent owns the array, this draws it
 * and reports edits. The rules a person keeps getting wrong are built into the
 * shape rather than left to a validator to scold them about after the fact:
 * `from` is *derived* from the band below it and read-only, so bands cannot
 * overlap or leave a gap; the last band is always unbounded (an `upTo` of null,
 * shown as ∞), so usage above the top tier is never dropped on the floor.
 *
 * The climbing-and-open validation lives in the domain (`tiersSchema`); this
 * surfaces per-row messages the parent hands down, so an error shows against the
 * band that caused it.
 */
export const TierTableProvenance = provenance({
  source: 'composition',
  composes: ['composition/DetailKit', 'compositions/InfoHint', 'ui/input', 'ui/button'],
  note: 'Controlled tier editor: derived From, unbounded last band, add/remove.',
})

/** A per-row validation message, keyed by field. */
export interface TierRowError {
  upTo?: string | undefined
  unitAmount?: string | undefined
  flatAmount?: string | undefined
}

export interface TierTableProps {
  tiers: Tier[]
  onChange: (tiers: Tier[]) => void
  /** Shown as the per-unit and flat-fee prefix, e.g. `$`. */
  currencySymbol?: string
  /** Inline messages, by row index. */
  rowErrors?: Record<number, TierRowError>
  disabled?: boolean
}

/** The lower bound of a band is the ceiling of the one beneath it. Row 0 starts at 0. */
function fromOf(tiers: Tier[], index: number): number {
  if (index === 0) return 0
  const below = tiers[index - 1]
  return below?.upTo ?? 0
}

export function TierTable({
  tiers,
  onChange,
  currencySymbol = '$',
  rowErrors,
  disabled = false,
}: TierTableProps) {
  const setTier = (index: number, patch: Partial<Tier>) => {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)))
  }

  const setPackageSize = (index: number, input: string) => {
    onChange(tiers.map((tier, i) => (i === index ? withPackageSize(tier, input) : tier)))
  }

  const addTier = () => {
    const last = tiers[tiers.length - 1]
    // The current last band is unbounded; give it a concrete ceiling before
    // appending a new unbounded one, so the table never shows two ∞ rows.
    const bounded: Tier[] =
      last && last.upTo === null
        ? tiers.map((tier, i) =>
            i === tiers.length - 1 ? { ...tier, upTo: fromOf(tiers, i) + 1 } : tier,
          )
        : [...tiers]
    onChange([...bounded, { upTo: null, unitAmount: '', flatAmount: '0' }])
  }

  const removeTier = (index: number) => {
    const next = tiers.filter((_, i) => i !== index)
    // Whatever is left, the final band must stay open, or usage above it is lost.
    if (next.length > 0) {
      const lastIndex = next.length - 1
      next[lastIndex] = { ...next[lastIndex]!, upTo: null }
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border">
        <SimpleTable
          rows={tiers.map((tier, index) => ({ tier, index }))}
          getRowId={(row) => String(row.index)}
          columns={[
            {
              key: 'from',
              header: 'From',
              className: 'w-[16%]',
              cell: ({ index }) => (
                // Derived and read-only: the floor is the band below's ceiling.
                <span className="text-muted-foreground tabular-nums">
                  {fromOf(tiers, index).toLocaleString()}
                </span>
              ),
            },
            {
              key: 'upTo',
              header: 'Up to',
              className: 'w-[16%] whitespace-normal py-2 align-top',
              cell: ({ tier, index }) => {
                const error = rowErrors?.[index]
                return (
                  <>
                    <Input
                      inputMode="numeric"
                      aria-label={`Tier ${index + 1} up to`}
                      aria-invalid={error?.upTo ? true : undefined}
                      placeholder={index === tiers.length - 1 ? '∞' : '0'}
                      disabled={disabled}
                      value={tier.upTo == null ? '' : String(tier.upTo)}
                      onChange={(event) => {
                        const raw = event.target.value.trim()
                        setTier(index, { upTo: raw === '' ? null : Number(raw) })
                      }}
                    />
                    {error?.upTo ? (
                      <p role="alert" className="text-destructive mt-1 text-xs">
                        {error.upTo}
                      </p>
                    ) : null}
                  </>
                )
              },
            },
            {
              key: 'unit',
              header: 'Price',
              className: 'w-[22%] whitespace-normal py-2 align-top',
              cell: ({ tier, index }) => {
                const error = rowErrors?.[index]
                return (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">{currencySymbol}</span>
                      <Input
                        inputMode="decimal"
                        aria-label={`Tier ${index + 1} per unit`}
                        aria-invalid={error?.unitAmount ? true : undefined}
                        placeholder="0.00"
                        disabled={disabled}
                        value={tier.unitAmount}
                        onChange={(event) => setTier(index, { unitAmount: event.target.value })}
                      />
                    </div>
                    {error?.unitAmount ? (
                      <p role="alert" className="text-destructive mt-1 text-xs">
                        {error.unitAmount}
                      </p>
                    ) : null}
                  </>
                )
              },
            },
            {
              key: 'package',
              header: (
                <span className="inline-flex items-center gap-1">
                  Package size
                  <InfoHint>Units per package. Leave empty to charge per unit.</InfoHint>
                </span>
              ),
              className: 'w-[18%] whitespace-normal py-2 align-top',
              cell: ({ tier, index }) => (
                <Input
                  inputMode="numeric"
                  aria-label={`Tier ${index + 1} package size`}
                  placeholder="Per unit"
                  disabled={disabled}
                  value={tier.transformQuantity?.divideBy ?? ''}
                  onChange={(event) => setPackageSize(index, event.target.value)}
                />
              ),
            },
            {
              key: 'flat',
              header: 'Flat fee',
              className: 'w-[22%] whitespace-normal py-2 align-top',
              cell: ({ tier, index }) => {
                const error = rowErrors?.[index]
                return (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">{currencySymbol}</span>
                    <Input
                      inputMode="decimal"
                      aria-label={`Tier ${index + 1} flat fee`}
                      aria-invalid={error?.flatAmount ? true : undefined}
                      placeholder="0.00"
                      disabled={disabled}
                      value={tier.flatAmount ?? ''}
                      onChange={(event) => setTier(index, { flatAmount: event.target.value })}
                    />
                  </div>
                )
              },
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
                  aria-label={`Remove tier ${index + 1}`}
                  disabled={disabled || tiers.length === 1}
                  onClick={() => removeTier(index)}
                >
                  <Trash2Icon aria-hidden className="size-4" />
                </Button>
              ),
            },
          ]}
        />
      </div>

      <div>
        <Button type="button" variant="outline" size="sm" onClick={addTier} disabled={disabled}>
          <PlusIcon aria-hidden className="size-4" />
          Add tier
        </Button>
      </div>
    </div>
  )
}

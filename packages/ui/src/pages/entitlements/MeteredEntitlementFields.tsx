import { useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { USAGE_RESET_PERIOD_LABEL, UsageResetPeriod } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { cn } from '@ui/lib/cn'
import { Field } from '@ui/compositions/Field'

/**
 * The metered half of the entitlement dialog: value type, value with an
 * Unlimited switch, when usage resets, a one-line summary and a collapsed
 * Advanced section.
 *
 * Controlled and form-library-agnostic; the two entitlement forms wire it to
 * their own react-hook-form state. Only `limit` and `resetPeriod` reach the
 * payload today. Value type and the Advanced options are UI-only until the
 * entitlement API accepts grant_measure, grant_allocation_behavior and friends
 * on create.
 */
export interface MeteredEntitlementFieldsProps {
  limit: number | null | undefined
  unlimited: boolean
  onLimitChange: (limit: number | null) => void
  resetPeriod: UsageResetPeriod | null | undefined
  onResetPeriodChange: (period: UsageResetPeriod) => void
  unit?: string | undefined
  limitError?: string | undefined
  disabled?: boolean
  /** Edit forms cannot remove a limit once set. */
  lockUnlimited?: boolean
  /** The plan's usage price for this feature, for the billing note. */
  usagePrice?: string | undefined
}

type Reset = { value: UsageResetPeriod | 'HOURLY'; label: string; disabled?: boolean }

const BASE_RESETS: Reset[] = [
  { value: UsageResetPeriod.Monthly, label: 'Every billing period' },
  { value: 'HOURLY', label: 'Hourly', disabled: true },
  { value: UsageResetPeriod.Daily, label: 'Daily' },
  { value: UsageResetPeriod.Weekly, label: 'Weekly' },
]

function Segmented<V extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  value: V
  onChange: (value: V) => void
  options: { value: V; label: string; disabled?: boolean }[]
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || option.disabled}
            title={option.disabled ? 'Not supported yet' : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring',
              selected && 'border-primary bg-primary/5 font-medium',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function MeteredEntitlementFields({
  limit,
  unlimited,
  onLimitChange,
  resetPeriod,
  onResetPeriodChange,
  unit,
  limitError,
  disabled = false,
  lockUnlimited = false,
  usagePrice,
}: MeteredEntitlementFieldsProps) {
  const [valueType, setValueType] = useState<'quantity' | 'amount'>('quantity')
  const [advanced, setAdvanced] = useState(false)
  const [windowStart, setWindowStart] = useState<'first-use' | 'calendar'>('first-use')
  const [stacking, setStacking] = useState<'additive' | 'parallel'>('additive')
  const current = resetPeriod ?? UsageResetPeriod.Monthly
  const resets: Reset[] = BASE_RESETS.some((r) => r.value === current)
    ? BASE_RESETS
    : [...BASE_RESETS, { value: current, label: USAGE_RESET_PERIOD_LABEL[current] }]

  const noun = valueType === 'amount' ? 'of usage value' : (unit ?? 'units')
  const resetLabel = (resets.find((r) => r.value === current)?.label ?? '').toLowerCase()
  const summary = unlimited
    ? 'Customers get unlimited use of this feature.'
    : `Customers get ${(limit ?? 0).toLocaleString()} ${noun}, resetting ${resetLabel}.`

  return (
    <div className="flex flex-col gap-5">
      <Field label="Value type">
        {() => (
          <Segmented
            label="Value type"
            value={valueType}
            onChange={setValueType}
            disabled={disabled}
            options={[
              { value: 'quantity', label: 'Quantity' },
              { value: 'amount', label: 'Amount' },
            ]}
          />
        )}
      </Field>

      <Field
        label="Value"
        error={limitError}
        {...(unit && valueType === 'quantity' ? { hint: `In ${unit}.` } : {})}
      >
        {({ id, ...field }) => (
          <div className="flex items-center gap-4">
            <Input
              id={id}
              inputMode="numeric"
              className="max-w-48"
              disabled={disabled || unlimited}
              placeholder={unlimited ? 'Unlimited' : '0'}
              value={limit == null ? '' : String(limit)}
              onChange={(event) => {
                const text = event.target.value
                if (text === '') onLimitChange(0)
                else if (!Number.isNaN(Number(text))) onLimitChange(Number(text))
              }}
              {...field}
            />
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={unlimited}
                disabled={disabled || (lockUnlimited && !unlimited)}
                onCheckedChange={(checked) => onLimitChange(checked ? null : 0)}
              />
              Unlimited
            </label>
          </div>
        )}
      </Field>

      <Field label="Usage resets">
        {() => (
          <Segmented
            label="Usage resets"
            value={current}
            onChange={(value) => {
              if (value !== 'HOURLY') onResetPeriodChange(value)
            }}
            disabled={disabled || unlimited}
            options={resets}
          />
        )}
      </Field>

      <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm">
        <span>{summary}</span>
        <span className="text-muted-foreground">
          Usage beyond the value is billed at the plan&apos;s usage price
          {usagePrice ? ` (${usagePrice})` : ''}.
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          aria-expanded={advanced}
          onClick={() => setAdvanced((open) => !open)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRightIcon
            aria-hidden
            className={cn('size-4 transition-transform', advanced && 'rotate-90')}
          />
          Advanced
        </button>
        {advanced ? (
          <div className="flex flex-col gap-4 pl-5">
            <Field label="Window starts">
              {() => (
                <Segmented
                  label="Window starts"
                  value={windowStart}
                  onChange={setWindowStart}
                  disabled={disabled}
                  options={[
                    { value: 'first-use', label: 'On first use' },
                    { value: 'calendar', label: 'Calendar boundary' },
                  ]}
                />
              )}
            </Field>
            <Field label="Stacking">
              {() => (
                <Segmented
                  label="Stacking"
                  value={stacking}
                  onChange={setStacking}
                  disabled={disabled}
                  options={[
                    { value: 'additive', label: 'Additive' },
                    { value: 'parallel', label: 'Parallel' },
                  ]}
                />
              )}
            </Field>
            <p className="text-xs text-muted-foreground">
              These options are not saved yet; the entitlement API does not accept them.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

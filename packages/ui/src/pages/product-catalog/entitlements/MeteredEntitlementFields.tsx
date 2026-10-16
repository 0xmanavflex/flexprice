import { useState } from 'react'
import { ChevronRightIcon, InfoIcon } from '@ui/icons'
import { USAGE_RESET_PERIOD_LABEL, UsageResetPeriod } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { cn } from '@ui/lib/cn'
import { Field } from '@ui/compositions/forms/Field'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'

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

type Reset = { value: UsageResetPeriod; label: string }

/** "Hourly" is in the redesign's list but not in the API's enum, so it is not offered. */
const BASE_RESETS: Reset[] = [
  { value: UsageResetPeriod.Monthly, label: 'Every billing period' },
  { value: UsageResetPeriod.Daily, label: 'Daily' },
  { value: UsageResetPeriod.Weekly, label: 'Weekly' },
]

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
      <Field label="Value type" hint="Whether the allowance is a set number or unlimited.">
        {({ id }) => (
          <OptionSelect
            id={id}
            value={valueType}
            onValueChange={(next) => setValueType(next as 'quantity' | 'amount')}
            disabled={disabled}
            options={[
              { value: 'quantity', label: 'Quantity' },
              { value: 'amount', label: 'Amount' },
            ]}
          />
        )}
      </Field>

      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field
          label="Value"
          hint={
            unit && valueType === 'quantity'
              ? `In ${unit}.`
              : 'The allowance for each usage period.'
          }
          error={limitError}
        >
          {({ id, ...field }) => (
            <div className="flex flex-col gap-2">
              <Input
                id={id}
                inputMode="numeric"
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
              <label className="text-muted-foreground flex items-center gap-2 text-[13px]">
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

        <div className={cn(unlimited && 'pointer-events-none opacity-50')}>
          <Field label="Usage resets" hint="When the used amount returns to zero.">
            {({ id }) => (
              <OptionSelect
                id={id}
                value={current}
                onValueChange={(value) => onResetPeriodChange(value as UsageResetPeriod)}
                disabled={disabled || unlimited}
                options={resets}
              />
            )}
          </Field>
        </div>
      </div>

      <div className="bg-muted/40 flex items-start gap-2.5 rounded-lg border p-3.5 text-[13px]/relaxed">
        <InfoIcon aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div>
          <p>{summary}</p>
          <p className="text-muted-foreground">
            Usage beyond the value is billed at the plan&apos;s usage price
            {usagePrice ? ` (${usagePrice})` : ''}.
          </p>
        </div>
      </div>

      {unlimited ? null : (
        <div className="rounded-lg border">
          <button
            type="button"
            aria-expanded={advanced}
            onClick={() => setAdvanced((open) => !open)}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px]"
          >
            <ChevronRightIcon
              aria-hidden
              className={cn(
                'text-muted-foreground size-4 transition-transform',
                advanced && 'rotate-90',
              )}
            />
            Advanced
          </button>
          {advanced ? (
            <div className="flex flex-col gap-4 border-t p-3.5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Window starts"
                  hint={
                    windowStart === 'first-use'
                      ? "Starts at the customer's first event."
                      : 'Starts at each period boundary.'
                  }
                >
                  {({ id }) => (
                    <OptionSelect
                      id={id}
                      value={windowStart}
                      onValueChange={(next) => setWindowStart(next as 'first-use' | 'calendar')}
                      disabled={disabled}
                      options={[
                        { value: 'first-use', label: 'On first use' },
                        { value: 'calendar', label: 'Calendar boundary' },
                      ]}
                    />
                  )}
                </Field>
                <Field
                  label="Stacking"
                  hint={
                    stacking === 'additive'
                      ? 'Plan and add-ons share one pool.'
                      : 'Each source gets its own window.'
                  }
                >
                  {({ id }) => (
                    <OptionSelect
                      id={id}
                      value={stacking}
                      onValueChange={(next) => setStacking(next as 'additive' | 'parallel')}
                      disabled={disabled}
                      options={[
                        { value: 'additive', label: 'Additive' },
                        { value: 'parallel', label: 'Parallel' },
                      ]}
                    />
                  )}
                </Field>
              </div>
              <p className="text-muted-foreground text-xs">
                These options are not saved yet; the entitlement API does not accept them.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

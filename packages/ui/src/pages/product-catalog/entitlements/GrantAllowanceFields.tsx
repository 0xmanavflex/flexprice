import { useState } from 'react'
import { ChevronRightIcon, InfoIcon } from '@ui/icons'
import {
  EntitlementAggregationMode,
  EntitlementGrantAllocationBehavior,
  EntitlementGrantDurationUnit,
  EntitlementGrantMeasure,
  type MeteredGrant,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { cn } from '@ui/lib/cn'
import { Field } from '@ui/compositions/forms/Field'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

export const GrantAllowanceFieldsProvenance = provenance({
  source: 'composition',
  composes: ['compositions/field', 'compositions/option-select', 'ui/button', 'ui/input', 'ui/switch'],
  note: "A metered allowance as V1 grants it: value type, value with Unlimited, the window it resets on, a summary, and Advanced (window start, stacking). Controlled; every field is saved.",
})

export interface GrantAllowanceFieldsProps {
  value: MeteredGrant
  onChange: (next: MeteredGrant) => void
  /** The feature's unit, for the value's hint and the summary. */
  unit?: string | undefined
  quotaError?: string | undefined
  disabled?: boolean
  /** The plan's usage price for this feature, for the billing note. */
  usagePrice?: string | undefined
}

const MEASURE_OPTIONS = [
  { value: EntitlementGrantMeasure.Quantity, label: 'Quantity' },
  { value: EntitlementGrantMeasure.Amount, label: 'Amount' },
]

/** V1's "Usage resets": the window the allowance is granted per. */
const WINDOW_OPTIONS = [
  { value: EntitlementGrantDurationUnit.SubscriptionPeriod, label: 'Every billing period' },
  { value: EntitlementGrantDurationUnit.Hour, label: 'Hourly' },
  { value: EntitlementGrantDurationUnit.Day, label: 'Daily' },
  { value: EntitlementGrantDurationUnit.Week, label: 'Weekly' },
]

const WINDOW_NOUN: Record<string, string> = {
  hour: 'hour',
  day: 'day',
  week: 'week',
}

const ALLOCATION_OPTIONS = [
  { value: EntitlementGrantAllocationBehavior.FirstUsage, label: 'On first use' },
  { value: EntitlementGrantAllocationBehavior.UnitStart, label: 'Calendar boundary' },
]

const AGGREGATION_OPTIONS = [
  { value: EntitlementAggregationMode.Additive, label: 'Additive' },
  { value: EntitlementAggregationMode.Parallel, label: 'Parallel' },
]

const MEASURE_HINT =
  'What the allowance counts. Quantity: units of the metered usage, such as 10,000 API calls. Amount: the priced value of that usage, such as $50 of calls.'
const WINDOW_HINT =
  'How often the allowance renews. Every billing period grants it once per period; hourly, daily and weekly grant it again each hour, day or week.'
const ALLOCATION_HINT =
  "When a window opens. On first use: at the customer's first event. Calendar boundary: at each hour, day or week on the clock."
const STACKING_HINT =
  'How this allowance combines with others on the same feature, such as a plan and an add-on. Additive: they share one pool. Parallel: each keeps its own pool and window.'

/**
 * A metered allowance, as V1's plan and add-on entitlement form has it:
 * everything here is sent (grant measure, quota or unlimited, window, window
 * start and stacking), not the older usage limit and reset period.
 */
export function GrantAllowanceFields({
  value,
  onChange,
  unit,
  quotaError,
  disabled = false,
  usagePrice,
}: GrantAllowanceFieldsProps) {
  const [advanced, setAdvanced] = useState(false)
  const unlimited = value.quota === null
  const windowed = value.unit !== EntitlementGrantDurationUnit.SubscriptionPeriod
  const set = (patch: Partial<MeteredGrant>) => onChange({ ...value, ...patch })
  const noun = value.measure === EntitlementGrantMeasure.Amount ? 'of usage value' : (unit ?? 'units')

  const summary = unlimited
    ? 'No ceiling: usage is tracked, with no allowance to run out.'
    : !value.quota
      ? 'Enter a value to see the allowance.'
      : windowed
        ? `${value.quota} ${noun} each ${WINDOW_NOUN[value.unit] ?? value.unit}.`
        : `${value.quota} ${noun} for the whole billing period.`

  return (
    <div className="flex flex-col gap-5">
      <Field label="Value type" hint={MEASURE_HINT}>
        {({ id, ...field }) => (
          <OptionSelect
            id={id}
            {...field}
            value={value.measure}
            onValueChange={(next) => set({ measure: next as MeteredGrant['measure'] })}
            disabled={disabled}
            options={MEASURE_OPTIONS}
          />
        )}
      </Field>

      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field
          label="Value"
          hint={
            unit && value.measure === EntitlementGrantMeasure.Quantity
              ? `In ${unit}, for each window.`
              : 'The allowance for each window.'
          }
          error={quotaError}
        >
          {({ id, ...field }) => (
            <div className="flex flex-col gap-2">
              <Input
                id={id}
                inputMode="decimal"
                disabled={disabled || unlimited}
                placeholder={unlimited ? 'Unlimited' : '0'}
                value={value.quota ?? ''}
                {...field}
                onChange={(event) => set({ quota: event.target.value })}
              />
              <label className="text-muted-foreground flex items-center gap-2 text-[13px]">
                <Switch
                  checked={unlimited}
                  disabled={disabled}
                  onCheckedChange={(checked) => set({ quota: checked ? null : '' })}
                />
                Unlimited
              </label>
            </div>
          )}
        </Field>

        <div className={cn(unlimited && 'pointer-events-none opacity-50')}>
          <Field label="Usage resets" hint={WINDOW_HINT}>
            {({ id, ...field }) => (
              <OptionSelect
                id={id}
                {...field}
                value={value.unit}
                onValueChange={(next) => set({ unit: next as MeteredGrant['unit'] })}
                disabled={disabled || unlimited}
                options={WINDOW_OPTIONS}
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
          <Button
            type="button"
            variant="ghost"
            aria-expanded={advanced}
            onClick={() => setAdvanced((open) => !open)}
            className="h-auto w-full justify-start gap-2 px-3.5 py-2.5 text-[13px]"
          >
            <ChevronRightIcon
              aria-hidden
              className={cn(
                'text-muted-foreground size-4 transition-transform',
                advanced && 'rotate-90',
              )}
            />
            Advanced
          </Button>
          {advanced ? (
            <div className="grid gap-5 border-t p-3.5 sm:grid-cols-2">
              {/* A billing-period window has no start to choose, as in V1. */}
              {windowed ? (
                <Field label="Window starts" hint={ALLOCATION_HINT}>
                  {({ id, ...field }) => (
                    <OptionSelect
                      id={id}
                      {...field}
                      value={value.allocation}
                      onValueChange={(next) =>
                        set({ allocation: next as MeteredGrant['allocation'] })
                      }
                      disabled={disabled}
                      options={ALLOCATION_OPTIONS}
                    />
                  )}
                </Field>
              ) : null}
              <Field label="Stacking" hint={STACKING_HINT}>
                {({ id, ...field }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={value.aggregation}
                    onValueChange={(next) =>
                      set({ aggregation: next as MeteredGrant['aggregation'] })
                    }
                    disabled={disabled}
                    options={AGGREGATION_OPTIONS}
                  />
                )}
              </Field>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import {
  BILLING_PERIOD_LABEL,
  BillingPeriod,
  CONTRACT_TERMS,
  contractAmountPerPeriod,
} from '@fp/domain'
import { CalculatorIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/primitives/popover'
import { Field } from '@ui/compositions/forms/Field'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

export const ContractAmountCalculatorProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/popover',
    'ui/input',
    'ui/button',
    'compositions/field',
    'compositions/option-select',
  ],
  note: "V1's flat-fee calculator: a contract amount over a contract term, turned into the price per billing period and written into the Amount field. Nothing else is stored.",
})

const TERM_OPTIONS = CONTRACT_TERMS.map((term) => ({
  value: term,
  label: BILLING_PERIOD_LABEL[term],
}))

export interface ContractAmountCalculatorProps {
  /** The charge's billing period: the price is worked out per one of these. */
  billingPeriod: BillingPeriod
  /** The Amount field's value, which the contract amount starts from. */
  amount: string
  /** The unit the amount is in (a currency code or a price unit), shown beside it. */
  unitLabel: string
  /** Writes the worked-out price into the Amount field. */
  onApply: (amount: string) => void
  disabled?: boolean
}

/**
 * A calculator beside a flat fee's Amount: type what the contract is worth
 * over its term (say 12,000 a year) and apply the price per billing period
 * (1,000 a month). Only the price is kept, as in V1.
 */
export function ContractAmountCalculator({
  billingPeriod,
  amount,
  unitLabel,
  onApply,
  disabled = false,
}: ContractAmountCalculatorProps) {
  const [open, setOpen] = useState(false)
  const [contract, setContract] = useState(amount)
  const [term, setTerm] = useState<BillingPeriod>(BillingPeriod.Annual)
  const result = contractAmountPerPeriod(contract, term, billingPeriod)
  const per = BILLING_PERIOD_LABEL[billingPeriod].toLowerCase()

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Each opening starts from the Amount as it stands, as V1 does.
        if (next) setContract(amount)
        setOpen(next)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Work out the price from a contract amount"
            disabled={disabled}
          />
        }
      >
        <CalculatorIcon aria-hidden className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Contract amount calculator"
        className="flex w-80 flex-col gap-4"
      >
        <Field label={`Contract amount (${unitLabel})`}>
          {({ id, ...field }) => (
            <Input
              id={id}
              {...field}
              inputMode="decimal"
              placeholder="0"
              value={contract}
              onChange={(event) => setContract(event.target.value)}
            />
          )}
        </Field>
        <Field label="Contract term" hint="The period the contract amount covers.">
          {({ id, ...field }) => (
            <OptionSelect
              id={id}
              {...field}
              value={term}
              onValueChange={(next) => setTerm(next as BillingPeriod)}
              options={TERM_OPTIONS}
            />
          )}
        </Field>
        <p role="status" className="text-muted-foreground text-sm">
          {result !== null ? (
            <>
              Price per billing period:{' '}
              <span className="text-foreground tabular-nums">
                {result} {unitLabel}
              </span>{' '}
              ({per})
            </>
          ) : (
            'Enter a contract amount to work out the price.'
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 self-end"
          disabled={result === null}
          onClick={() => {
            if (result === null) return
            onApply(result)
            setOpen(false)
          }}
        >
          Use this price
        </Button>
      </PopoverContent>
    </Popover>
  )
}

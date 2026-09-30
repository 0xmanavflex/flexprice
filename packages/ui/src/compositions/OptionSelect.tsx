import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { provenance } from '@ui/provenance'

/**
 * A stock `Select` fed from an options array — the short-list picker (≤ ~8
 * fixed values: billing period, cadence, type). Longer or searchable lists use
 * `OptionCombobox`.
 */
export const OptionSelectProvenance = provenance({
  source: 'composition',
  composes: ['ui/select'],
  note: 'Options-array wrapper over the stock Select, so each form stops re-spelling the same five parts.',
})

export interface Option {
  value: string
  label: string
}

export interface OptionSelectProps {
  id?: string
  value: string | undefined
  onValueChange: (value: string) => void
  options: readonly Option[]
  placeholder?: string
  disabled?: boolean
  'aria-describedby'?: string | undefined
  'aria-invalid'?: true | undefined
}

export function OptionSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: OptionSelectProps) {
  return (
    <Select
      items={options as Option[]}
      value={value || null}
      onValueChange={(next) => onValueChange((next as string | null) ?? '')}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      <SelectTrigger
        {...(id ? { id } : {})}
        className="w-full"
        aria-describedby={describedBy}
        aria-invalid={invalid}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import type { ReactNode } from 'react'
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
  /** Quiet second line text beside the label, e.g. a lookup key. */
  hint?: string
  /** Sentence under the label in the menu. The closed field shows the label only. */
  description?: string
  /** Pinned to the right end of the option, e.g. a type glyph. */
  trailing?: ReactNode
  /** Shown but not choosable; say why in `hint`. */
  disabled?: boolean
}

/** An option's body: label, optional hint, optional trailing mark pushed to the end. */
export function OptionBody({ option }: { option: Option }) {
  return (
    <>
      {option.description ? (
        <span className="flex min-w-0 flex-col gap-0.5 py-0.5 whitespace-normal">
          <span className="truncate">{option.label}</span>
          <span
            className="text-muted-foreground text-xs whitespace-normal in-data-[slot=select-value]:hidden"
            aria-hidden
          >
            {option.description}
          </span>
        </span>
      ) : (
        <span className="min-w-0 truncate">{option.label}</span>
      )}
      {option.hint ? (
        <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
          {option.hint}
        </span>
      ) : null}
      {option.trailing ? (
        <span className="ml-auto flex shrink-0 items-center">{option.trailing}</span>
      ) : null}
    </>
  )
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
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled ?? false}
            className={
              option.description
                ? 'h-auto items-start py-1.5 [&>span:first-child]:w-full [&>span:first-child]:min-w-0 [&>span:first-child]:shrink [&>span:first-child]:whitespace-normal [&>span:last-child]:top-1/2 [&>span:last-child]:-translate-y-1/2'
                : undefined
            }
          >
            <OptionBody option={option} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

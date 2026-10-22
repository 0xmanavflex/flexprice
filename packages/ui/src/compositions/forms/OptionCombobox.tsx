import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@ui/components/primitives/combobox'
import { InputGroupAddon } from '@ui/components/primitives/input-group'
import { SearchIcon } from '@ui/icons'
import { provenance } from '@ui/provenance'
import { OptionBody, type Option } from './OptionSelect'

/**
 * A stock `Combobox` over an options array — the searchable picker for long or
 * dynamic lists (features, meters, currencies, timezones, plans).
 */
export const OptionComboboxProvenance = provenance({
  source: 'composition',
  composes: ['ui/combobox'],
  note: 'Options-array wrapper over the stock Combobox with label-based filtering.',
})

export interface OptionComboboxProps {
  id?: string
  value: string | undefined
  onValueChange: (value: string) => void
  options: readonly Option[]
  placeholder?: string
  emptyText?: string
  /**
   * Lead the field with a magnifier.
   *
   * This control has always filtered as you type, but with the trigger hidden
   * it reads as a plain select: people open it, see no search box, and scroll.
   * For a picker over a catalogue — features, plans, customers — say what it
   * is. For a short, fixed list it is noise.
   */
  searchable?: boolean
  disabled?: boolean
  'aria-describedby'?: string | undefined
  'aria-invalid'?: true | undefined
}

export function OptionCombobox({
  id,
  value,
  onValueChange,
  options,
  placeholder = 'Search…',
  emptyText = 'No matches.',
  searchable = false,
  disabled,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: OptionComboboxProps) {
  const selected = options.find((option) => option.value === value) ?? null
  return (
    <Combobox
      items={options as Option[]}
      value={selected}
      onValueChange={(next) => onValueChange((next as Option | null)?.value ?? '')}
      itemToStringLabel={(option) => (option as Option).label}
      itemToStringValue={(option) => (option as Option).value}
      openOnInputClick
      isItemEqualToValue={(a, b) => (a as Option).value === (b as Option).value}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      <ComboboxInput
        showTrigger={false}
        showClear
        {...(id ? { id } : {})}
        placeholder={placeholder}
        className="w-full"
        aria-describedby={describedBy}
        aria-invalid={invalid}
      >
        {searchable ? (
          <InputGroupAddon align="inline-start">
            <SearchIcon aria-hidden className="size-4" />
          </InputGroupAddon>
        ) : null}
      </ComboboxInput>
      <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width)">
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(option: Option) => (
            <ComboboxItem key={option.value} value={option} disabled={option.disabled ?? false}>
              <OptionBody option={option} />
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

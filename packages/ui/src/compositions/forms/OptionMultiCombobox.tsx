import { Button } from '@ui/components/primitives/button'
import { XIcon } from '@ui/icons'
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@ui/components/primitives/combobox'
import { OptionBody, type Option } from './OptionSelect'
import { provenance } from '@ui/provenance'

export const OptionMultiComboboxProvenance = provenance({
  source: 'composition',
  composes: ['ui/combobox', 'compositions/OptionSelect'],
  note: 'The kit combobox in multiple-selection mode, with removable choices and searchable options.',
})

/** The same option vocabulary as OptionCombobox, with an array of selected values. */
export function OptionMultiCombobox({
  id,
  value,
  onValueChange,
  options,
  disabled = false,
  placeholder = 'Search and select…',
  emptyText = 'No matches.',
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: {
  id?: string
  value: readonly string[]
  onValueChange: (value: string[]) => void
  options: readonly Option[]
  disabled?: boolean
  placeholder?: string
  emptyText?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: true | undefined
}) {
  const anchor = useComboboxAnchor()
  const selected = options.filter((option) => value.includes(option.value))
  return (
    <Combobox
      multiple
      items={options}
      value={selected}
      disabled={disabled}
      onValueChange={(next) => onValueChange((next as Option[]).map((option) => option.value))}
      itemToStringLabel={(option) => (option as Option).label}
      itemToStringValue={(option) => (option as Option).value}
      isItemEqualToValue={(a, b) => (a as Option).value === (b as Option).value}
      openOnInputClick
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(items: Option[]) =>
            items.map((option) => (
              <ComboboxChip key={option.value} showRemove={false}>
                {option.label}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled}
                  aria-label={`Remove ${option.label}`}
                  onClick={() =>
                    onValueChange(value.filter((selected) => selected !== option.value))
                  }
                >
                  <XIcon aria-hidden />
                </Button>
              </ComboboxChip>
            ))
          }
        </ComboboxValue>
        <ComboboxChipsInput
          id={id}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor} className="w-(--anchor-width) min-w-(--anchor-width)">
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

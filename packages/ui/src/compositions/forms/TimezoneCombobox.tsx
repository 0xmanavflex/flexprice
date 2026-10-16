import { IANA_TIMEZONES, toTimezoneOption, toTimezoneOptions } from '@fp/domain'
import { provenance } from '@ui/provenance'
import { OptionCombobox } from './OptionCombobox'
import type { Option } from './OptionSelect'

/**
 * Searchable IANA timezone picker.
 *
 * The zone list is `timezones.json` in the domain package. Labels add the
 * abbreviation and the current UTC offset, so "IST", "Kolkata" and "+05:30"
 * all find the same zone. The stored value is the IANA name.
 */
export const TimezoneComboboxProvenance = provenance({
  source: 'composition',
  composes: ['compositions/option-combobox'],
  note: 'IANA catalogue from timezones.json, labelled with abbreviation and offset.',
})

export interface TimezoneComboboxProps {
  id?: string
  value: string | undefined
  onValueChange: (value: string) => void
  disabled?: boolean
  'aria-describedby'?: string | undefined
  'aria-invalid'?: true | undefined
}

const TIMEZONE_OPTIONS: Option[] = toTimezoneOptions(IANA_TIMEZONES).map((option) => ({
  value: option.zone,
  label: option.label,
}))

/** A saved zone the catalogue does not know stays selectable. */
function optionsFor(current: string | undefined): readonly Option[] {
  if (!current || TIMEZONE_OPTIONS.some((option) => option.value === current)) {
    return TIMEZONE_OPTIONS
  }
  return [{ value: current, label: toTimezoneOption(current).label }, ...TIMEZONE_OPTIONS]
}

export function TimezoneCombobox({
  id,
  value,
  onValueChange,
  disabled,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: TimezoneComboboxProps) {
  return (
    <OptionCombobox
      {...(id ? { id } : {})}
      searchable
      value={value || undefined}
      onValueChange={onValueChange}
      options={optionsFor(value)}
      placeholder="Search time zones…"
      emptyText="No matching time zone."
      {...(disabled !== undefined ? { disabled } : {})}
      aria-describedby={describedBy}
      aria-invalid={invalid}
    />
  )
}

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
  /**
   * Lead with "Local": this browser's own zone, so the person setting it up can
   * pick their zone without searching. It stores the zone's IANA name, like
   * any other option.
   */
  offerLocal?: boolean
  'aria-describedby'?: string | undefined
  'aria-invalid'?: true | undefined
}

const TIMEZONE_OPTIONS: Option[] = toTimezoneOptions(IANA_TIMEZONES).map((option) => ({
  value: option.zone,
  label: option.label,
}))

/** This browser's IANA zone, or null where the runtime does not say. */
export function localTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/**
 * The options, with "Local" first when asked for (and in place of its own
 * catalogue row, so one zone is never listed twice), and a saved zone the
 * catalogue does not know kept selectable.
 */
export function timezoneOptionsFor(
  current: string | undefined,
  local: string | null,
): readonly Option[] {
  const localOption: Option[] = local
    ? [{ value: local, label: `Local · ${toTimezoneOption(local).label}` }]
    : []
  const rest = TIMEZONE_OPTIONS.filter((option) => option.value !== local)
  const known = current === local || rest.some((option) => option.value === current)
  return [
    ...localOption,
    ...(!current || known ? [] : [{ value: current, label: toTimezoneOption(current).label }]),
    ...rest,
  ]
}

export function TimezoneCombobox({
  id,
  value,
  onValueChange,
  disabled,
  offerLocal = false,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: TimezoneComboboxProps) {
  return (
    <OptionCombobox
      {...(id ? { id } : {})}
      searchable
      value={value || undefined}
      onValueChange={onValueChange}
      options={timezoneOptionsFor(value, offerLocal ? localTimezone() : null)}
      placeholder="Search time zones…"
      emptyText="No matching time zone."
      {...(disabled !== undefined ? { disabled } : {})}
      aria-describedby={describedBy}
      aria-invalid={invalid}
    />
  )
}

import { useEffect, useMemo, useState } from 'react'
import { countryOptions } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { provenance } from '@ui/provenance'
import type * as RegionData from 'countrycitystatejson/client'
import { OptionCombobox } from './OptionCombobox'
import type { Option } from './OptionSelect'

/**
 * Country, state and city as dependent, searchable pickers: the one address
 * part every address form uses (customer create and edit, checkout, the
 * organisation's billing address).
 *
 * Countries are the fixed ISO list in `@fp/domain` (`countryOptions`), stored
 * as the alpha-2 code. States and cities come from a bundled dataset
 * (`countrycitystatejson`, MIT), filtered by the chosen country and, for
 * cities, the chosen state; both are stored as their names, the free-text
 * strings the API has always taken. There is no Flexprice API for regions.
 *
 * The dataset is loaded with a dynamic import, so none of it is in the main
 * bundle: the state names (~300 KB) arrive with the first address form, and
 * each country's cities are their own chunk, fetched when that country is
 * chosen.
 *
 * A place the dataset does not list can still be entered: the state and
 * city lists offer what was typed ("Use …"). Where the dataset has nothing (a
 * country with no states listed, a state with no cities), or the parent is
 * not chosen (city without a state, since state is optional; an older saved
 * state or city with no country), the control is a typed field, so an
 * address can always be completed and older addresses stay editable. A saved
 * value the dataset does not know stays selectable. Postal code is not here: it stays a typed field in each form.
 *
 * Layout belongs to the form: `useAddressRegions` returns one picker per
 * field and `AddressPicker` renders it inside whatever row the form uses
 * (`FormRow`, `Field`, `SettingRow`).
 */
export const AddressRegionFieldsProvenance = provenance({
  source: 'composition',
  composes: ['compositions/option-combobox', 'ui/input'],
  note: 'Dependent country → state → city pickers over the ISO country list and a lazily imported region dataset; typed fallback where the dataset is empty.',
})

export interface AddressRegionValue {
  /** ISO 3166-1 alpha-2 code, or `''`. */
  country: string
  state: string
  city: string
}

/** What one address control shows: a searchable list, or a typed field where no list exists. */
export interface AddressPickerModel {
  kind: 'list' | 'text'
  /** A list that also offers what was typed, for a place the dataset does not list. */
  allowCustom: boolean
  value: string
  onValueChange: (value: string) => void
  options: readonly Option[]
  placeholder: string
  emptyText: string
  disabled: boolean
}

export interface AddressRegionPickers {
  country: AddressPickerModel
  state: AddressPickerModel
  city: AddressPickerModel
}

type Geo = typeof RegionData

let geo: Promise<Geo> | null = null

/** The region dataset, imported once, on first use. */
function loadGeo(): Promise<Geo> {
  geo ??= import('countrycitystatejson/client')
  return geo
}

/** The state names the dataset lists for a country; `[]` when it lists none. */
export async function loadStates(country: string): Promise<string[]> {
  if (!country) return []
  const data = await loadGeo()
  return sortNames(data.getStatesByShort(country) ?? [])
}

/** The city names the dataset lists for a state of a country; `[]` when it lists none. */
export async function loadCities(country: string, state: string): Promise<string[]> {
  if (!country || !state) return []
  const data = await loadGeo()
  return sortNames((await data.getCities(country, state)) ?? [])
}

function sortNames(names: readonly string[]): string[] {
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}

/**
 * The names the dataset lists for a country (`state` omitted) or for one of
 * its states. `undefined` while loading; `[]` when there is nothing to load.
 */
function useRegionNames(country: string, state?: string): string[] | undefined {
  const key = state === undefined ? country : `${country}\u0000${state}`
  const enabled = state === undefined ? country !== '' : country !== '' && state !== ''
  const [loaded, setLoaded] = useState<{ key: string; names: string[] } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    const load = state === undefined ? loadStates(country) : loadCities(country, state)
    load.then(
      (names) => {
        if (live) setLoaded({ key, names })
      },
      // A chunk that fails to load leaves the typed fallback, never a dead control.
      () => {
        if (live) setLoaded({ key, names: [] })
      },
    )
    return () => {
      live = false
    }
  }, [key, enabled, country, state])
  if (!enabled) return []
  return loaded?.key === key ? loaded.names : undefined
}

/** A saved value the list does not know stays selectable. */
function withCurrent(options: Option[], current: string): Option[] {
  if (!current || options.some((option) => option.value === current)) return options
  return [{ value: current, label: current }, ...options]
}

const toOptions = (names: readonly string[]): Option[] =>
  names.map((name) => ({ value: name, label: name }))

/**
 * The three pickers for an address, wired so a new country clears the state
 * and city, and a new state clears the city.
 */
export function useAddressRegions({
  value,
  onChange,
  disabled = false,
}: {
  value: AddressRegionValue
  onChange: (next: AddressRegionValue) => void
  disabled?: boolean
}): AddressRegionPickers {
  const countries = useMemo(
    () => countryOptions().map((option) => ({ value: option.code, label: option.label })),
    [],
  )
  const { country, state, city } = value

  const states = useRegionNames(country)
  const cities = useRegionNames(country, state)

  /*
   * A saved state with no country (an older address) is typed, so it stays
   * editable. Decided once, from the value the form opened with: clearing it
   * must not turn the field into a disabled list mid-edit.
   */
  const [legacyState] = useState(() => country === '' && state !== '')
  /*
   * State: a list (with a typed "Use …" choice) once a country with states
   * is chosen; typed where the dataset lists none for the country.
   */
  const stateList = country !== '' && (states === undefined || states.length > 0)
  const stateTyped = !stateList && (country !== '' || legacyState)
  /*
   * City: a list for the chosen state; typed whenever no state is chosen
   * (state is optional, city is not) or the dataset lists no cities for it.
   */
  const cityList = stateList && state !== '' && (cities === undefined || cities.length > 0)
  const cityTyped = !cityList

  return {
    country: {
      kind: 'list',
      allowCustom: false,
      value: country,
      onValueChange: (next) =>
        onChange(next === country ? value : { country: next, state: '', city: '' }),
      options: withCurrent(countries, country),
      placeholder: 'Search countries…',
      emptyText: 'No matching country.',
      disabled,
    },
    state: {
      kind: stateTyped ? 'text' : 'list',
      allowCustom: true,
      value: state,
      onValueChange: (next) =>
        onChange(next === state ? value : { ...value, state: next, city: '' }),
      options: withCurrent(toOptions(states ?? []), state),
      placeholder: stateTyped
        ? 'State or region'
        : !country
          ? 'Choose a country first'
          : states === undefined
            ? 'Loading states…'
            : 'Search states…',
      emptyText: states === undefined ? 'Loading states…' : 'No matching state.',
      disabled: disabled || (!stateList && !stateTyped),
    },
    city: {
      kind: cityTyped ? 'text' : 'list',
      allowCustom: true,
      value: city,
      onValueChange: (next) => onChange({ ...value, city: next }),
      options: withCurrent(toOptions(cities ?? []), city),
      placeholder: cityTyped ? 'City' : cities === undefined ? 'Loading cities…' : 'Search cities…',
      emptyText: cities === undefined ? 'Loading cities…' : 'No matching city.',
      disabled,
    },
  }
}

export interface AddressPickerProps {
  picker: AddressPickerModel
  id?: string
  /** For a control with no visible label of its own (a compact address group). */
  'aria-label'?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: true | undefined
  autoComplete?: string
}

/** One address control: the searchable list, or the typed fallback. */
export function AddressPicker({
  picker,
  id,
  'aria-label': label,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  autoComplete,
}: AddressPickerProps) {
  if (picker.kind === 'text') {
    return (
      <Input
        {...(id ? { id } : {})}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        autoComplete={autoComplete}
        value={picker.value}
        placeholder={picker.placeholder}
        disabled={picker.disabled}
        onChange={(event) => picker.onValueChange(event.target.value)}
      />
    )
  }
  return (
    <ListPicker picker={picker} id={id} label={label} describedBy={describedBy} invalid={invalid} />
  )
}

/** The searchable list; with `allowCustom`, what was typed is offered too. */
function ListPicker({
  picker,
  id,
  label,
  describedBy,
  invalid,
}: {
  picker: AddressPickerModel
  id: string | undefined
  label: string | undefined
  describedBy: string | undefined
  invalid: true | undefined
}) {
  const [query, setQuery] = useState('')
  const typed = query.trim()
  const listed = picker.options.some((option) => option.label.toLowerCase() === typed.toLowerCase())
  const options =
    picker.allowCustom && typed !== '' && !listed
      ? [...picker.options, { value: typed, label: `Use "${typed}"` }]
      : picker.options
  return (
    <OptionCombobox
      {...(id ? { id } : {})}
      searchable
      value={picker.value || undefined}
      onValueChange={picker.onValueChange}
      onInputValueChange={setQuery}
      options={options}
      placeholder={picker.placeholder}
      emptyText={picker.emptyText}
      disabled={picker.disabled}
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={invalid}
    />
  )
}

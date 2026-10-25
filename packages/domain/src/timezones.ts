import ZONES from './timezones.json' with { type: 'json' }

/**
 * Time zones a person can actually find.
 *
 * The picker listed bare IANA names: `Asia/Kolkata` and nothing else: so
 * someone looking for their own zone had to already know its IANA spelling.
 * Typing "IST" found nothing, and neither did "+5:30".
 *
 * Each option now carries its abbreviation and UTC offset, and matches on the
 * zone, the city, the offset in both spellings and the abbreviation.
 *
 * Why the abbreviations are partly a list: `Intl` returns a real abbreviation
 * only for US zones. Everywhere else `timeZoneName: 'short'` gives "GMT+5:30",
 * which is the offset again, not what anyone calls the zone. Checked, not
 * assumed: see the test. So the common ones are named here and the rest fall
 * back to whatever `Intl` knows.
 */

/**
 * The abbreviations people type, for zones `Intl` will not name.
 *
 * Standard time, not daylight: someone searching "CET" in July still means
 * Berlin. Where `Intl` does give a name it wins, because it is correct for
 * today: it answers EDT in summer and EST in winter.
 */
const KNOWN_ABBREVIATIONS: Record<string, string> = {
  'Asia/Kolkata': 'IST',
  'Asia/Calcutta': 'IST',
  'Asia/Colombo': 'IST',
  'Europe/London': 'GMT',
  'Europe/Dublin': 'GMT',
  'Europe/Lisbon': 'WET',
  'Europe/Paris': 'CET',
  'Europe/Berlin': 'CET',
  'Europe/Madrid': 'CET',
  'Europe/Rome': 'CET',
  'Europe/Amsterdam': 'CET',
  'Europe/Brussels': 'CET',
  'Europe/Zurich': 'CET',
  'Europe/Stockholm': 'CET',
  'Europe/Oslo': 'CET',
  'Europe/Copenhagen': 'CET',
  'Europe/Vienna': 'CET',
  'Europe/Prague': 'CET',
  'Europe/Warsaw': 'CET',
  'Europe/Athens': 'EET',
  'Europe/Helsinki': 'EET',
  'Europe/Bucharest': 'EET',
  'Europe/Kiev': 'EET',
  'Europe/Istanbul': 'TRT',
  'Europe/Moscow': 'MSK',
  'Asia/Dubai': 'GST',
  'Asia/Karachi': 'PKT',
  'Asia/Dhaka': 'BST',
  'Asia/Bangkok': 'ICT',
  'Asia/Jakarta': 'WIB',
  'Asia/Singapore': 'SGT',
  'Asia/Kuala_Lumpur': 'MYT',
  'Asia/Manila': 'PHT',
  'Asia/Hong_Kong': 'HKT',
  'Asia/Shanghai': 'CST',
  'Asia/Taipei': 'CST',
  'Asia/Seoul': 'KST',
  'Asia/Tokyo': 'JST',
  'Australia/Perth': 'AWST',
  'Australia/Adelaide': 'ACST',
  'Australia/Brisbane': 'AEST',
  'Australia/Sydney': 'AEST',
  'Australia/Melbourne': 'AEST',
  'Pacific/Auckland': 'NZST',
  'America/Sao_Paulo': 'BRT',
  'America/Argentina/Buenos_Aires': 'ART',
  'Africa/Lagos': 'WAT',
  'Africa/Johannesburg': 'SAST',
  'Africa/Nairobi': 'EAT',
  'Africa/Cairo': 'EET',
  UTC: 'UTC',
}

export interface TimezoneOption {
  /** The IANA name, which is the stored value. */
  zone: string
  /** "IST", "PDT": absent when nothing names this zone. */
  abbreviation: string | null
  /** "UTC+05:30". */
  offset: string
  /** What the option reads as: `Asia/Kolkata · IST · UTC+05:30`. */
  label: string
  /** Everything the option matches on, lowercased. */
  searchText: string
}

/** `GMT+05:30` → `UTC+05:30`; `GMT` → `UTC+00:00`. */
function toOffset(raw: string): string {
  if (raw === 'GMT' || raw === 'UTC') return 'UTC+00:00'
  return raw.replace(/^GMT/, 'UTC')
}

/** `Intl`'s short name, when it is a name and not the offset wearing a hat. */
function intlAbbreviation(zone: string, at: Date): string | null {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((piece) => piece.type === 'timeZoneName')?.value
    // "GMT+5:30" is the offset again. Only letters are an abbreviation.
    return part && /^[A-Z]{2,5}$/.test(part) ? part : null
  } catch {
    return null
  }
}

function intlOffset(zone: string, at: Date): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((piece) => piece.type === 'timeZoneName')?.value
    return part ? toOffset(part) : 'UTC+00:00'
  } catch {
    return 'UTC+00:00'
  }
}

/** `Asia/Kolkata` → `Kolkata`, which is what people search for. */
function cityOf(zone: string): string {
  const last = zone.split('/').pop() ?? zone
  return last.replaceAll('_', ' ')
}

/**
 * One zone as an option.
 *
 * `at` is injectable so a test is not at the mercy of the day it runs on:
 * an abbreviation and an offset both change with daylight saving.
 */
export function toTimezoneOption(zone: string, at: Date = new Date()): TimezoneOption {
  const abbreviation = intlAbbreviation(zone, at) ?? KNOWN_ABBREVIATIONS[zone] ?? null
  const offset = intlOffset(zone, at)
  const label = [zone, abbreviation, offset].filter(Boolean).join(' · ')
  return {
    zone,
    abbreviation,
    offset,
    label,
    searchText: [
      zone,
      cityOf(zone),
      abbreviation,
      offset,
      // Also the spelling people type: "+5:30" and "GMT+5:30".
      offset.replace('UTC', ''),
      offset.replace('UTC', 'GMT'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  }
}

/** Every zone the runtime knows, as options. Falls back to a usable set. */
export function timezoneOptions(zones: readonly string[], at: Date = new Date()): TimezoneOption[] {
  return zones.map((zone) => toTimezoneOption(zone, at))
}

/**
 * The IANA catalogue in `timezones.json`, plus aliases that list drops.
 *
 * `Intl.supportedValuesOf('timeZone')` is what the JSON was generated from.
 * It keeps `Asia/Calcutta` and omits `Asia/Kolkata`. The abbreviation list
 * names the aliases people store and search for, so those are added here.
 */
export const IANA_TIMEZONES: readonly string[] = buildCatalogue()

function buildCatalogue(): readonly string[] {
  const listed = new Set<string>(ZONES)
  const extra = Object.keys(KNOWN_ABBREVIATIONS).filter((zone) => !listed.has(zone))
  const rest = [...ZONES.filter((zone) => zone !== 'UTC'), ...extra].sort((a, b) =>
    a.localeCompare(b),
  )
  return ['UTC', ...rest]
}

/**
 * Options for the picker.
 *
 * A saved zone the catalogue does not know stays at the front, so editing
 * does not drop it.
 */
export function timezoneChoices(current?: string, at: Date = new Date()): TimezoneOption[] {
  const zones =
    current && !IANA_TIMEZONES.includes(current) ? [current, ...IANA_TIMEZONES] : IANA_TIMEZONES
  return timezoneOptions(zones, at)
}

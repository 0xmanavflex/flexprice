/**
 * Countries, as a list you can search.
 *
 * The address field was free text capped at two characters, so it accepted
 * "XX" and "zz" and told nobody which code it wanted. The stored value is
 * still the ISO 3166-1 alpha-2 code the API takes; what changes is that it is
 * chosen from a list and found by typing the country's name.
 *
 * The names are not written here. `Intl.DisplayNames` already knows them in
 * the viewer's own language, so a list of names would be both a translation
 * burden and wrong for anyone not reading English. Only the codes are fixed,
 * because nothing in the runtime enumerates them.
 */

/** ISO 3166-1 alpha-2, officially assigned. */
// prettier-ignore
export const COUNTRY_CODES = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
  'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
  'DE','DJ','DK','DM','DO','DZ',
  'EC','EE','EG','EH','ER','ES','ET',
  'FI','FJ','FK','FM','FO','FR',
  'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
  'HK','HM','HN','HR','HT','HU',
  'ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
  'JE','JM','JO','JP',
  'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
  'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
  'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
  'OM',
  'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
  'QA',
  'RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
  'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
  'UA','UG','UM','US','UY','UZ',
  'VA','VC','VE','VG','VI','VN','VU',
  'WF','WS',
  'YE','YT',
  'ZA','ZM','ZW',
] as const

export type CountryCode = (typeof COUNTRY_CODES)[number]

export interface CountryOption {
  /** The stored value: the alpha-2 code. */
  code: string
  /** The country's name in the viewer's language, or the code when unknown. */
  name: string
  /** "United Kingdom (GB)". */
  label: string
  /** Name and code, lowercased, so typing either finds it. */
  searchText: string
}

/**
 * The countries, named for `locale`.
 *
 * A runtime without `Intl.DisplayNames`: or one that cannot name a given
 * code: falls back to the code itself, which still selects correctly.
 */
export function countryOptions(locale?: string): CountryOption[] {
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'region' })
  } catch {
    names = null
  }

  const nameOf = (code: string): string => {
    try {
      return names?.of(code) ?? code
    } catch {
      return code
    }
  }

  return COUNTRY_CODES.map((code): CountryOption => {
    const name = nameOf(code)
    return {
      code,
      name,
      label: name === code ? code : `${name} (${code})`,
      searchText: `${name} ${code}`.toLowerCase(),
    }
  }).sort((a, b) => a.name.localeCompare(b.name, locale))
}

/**
 * The name for one code, for read-only display.
 *
 * Only codes on the list are named. `Intl.DisplayNames.of` answers "Unknown
 * Region" for anything else rather than failing: checked, not assumed: and
 * showing that to someone whose address says "ZZ" is worse than showing
 * "ZZ", which is at least the thing that was stored.
 */
const KNOWN = new Set<string>(COUNTRY_CODES)

export function countryName(code: string, locale?: string): string {
  if (!code) return ''
  if (!KNOWN.has(code)) return code
  try {
    return new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

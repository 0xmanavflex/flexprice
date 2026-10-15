import { describe, expect, it } from 'vitest'
import { COUNTRY_CODES, countryName, countryOptions } from './countries'

describe('countryOptions', () => {
  it('offers every code, named', () => {
    const options = countryOptions('en')
    expect(options).toHaveLength(COUNTRY_CODES.length)
    const gb = options.find((option) => option.code === 'GB')
    expect(gb).toMatchObject({ name: 'United Kingdom', label: 'United Kingdom (GB)' })
  })

  it('sorts by name, not by code', () => {
    const names = countryOptions('en').map((option) => option.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')))
    // Which is the point: Åland and Afghanistan are not AD, AE, AF.
    expect(names[0]).not.toBe('Andorra')
  })

  it('names countries in the viewer’s own language', () => {
    const de = countryOptions('de').find((option) => option.code === 'DE')
    expect(de?.name).toBe('Deutschland')
  })

  it('finds a country by name or by code', () => {
    const gb = countryOptions('en').find((option) => option.code === 'GB')
    expect(gb?.searchText).toContain('united kingdom')
    expect(gb?.searchText).toContain('gb')
  })

  it('has no duplicate codes', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length)
  })

  it('is all two-letter uppercase codes', () => {
    expect(COUNTRY_CODES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true)
  })
})

describe('countryName', () => {
  it('names a code', () => {
    expect(countryName('IN', 'en')).toBe('India')
  })

  it('gives back an unknown code rather than nothing', () => {
    expect(countryName('ZZ', 'en')).toBe('ZZ')
  })

  it('is empty for an empty code, so a blank address stays blank', () => {
    expect(countryName('', 'en')).toBe('')
  })
})

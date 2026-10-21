import { describe, expect, it } from 'vitest'
import { parseApiUrls } from './publicApi'

describe('parseApiUrls', () => {
  it('keeps URL entries as origins', () => {
    expect(parseApiUrls('{"us":"https://us.api.test/v1"}')).toEqual({ us: 'https://us.api.test' })
  })

  it('drops non-URLs and unknown regions', () => {
    expect(parseApiUrls('{"us":"nope","eu":"https://x.test"}')).toEqual({})
  })

  it('returns no regions for bad JSON or no value', () => {
    expect(parseApiUrls('{')).toEqual({})
    expect(parseApiUrls(undefined)).toEqual({})
  })
})

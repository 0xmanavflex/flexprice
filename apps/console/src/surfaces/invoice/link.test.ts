import { describe, expect, it } from 'vitest'
import { parseHostedInvoiceLink } from './link'

const urls = { us: 'https://us.api.test', staging: 'https://staging.api.test' }

describe('parseHostedInvoiceLink', () => {
  it('reads region and token', () => {
    expect(parseHostedInvoiceLink('/us/hit_1.sig', urls)).toEqual({
      region: 'us',
      token: 'hit_1.sig',
      apiOrigin: 'https://us.api.test',
    })
  })

  it('accepts one trailing slash, as a gateway may append on return', () => {
    expect(parseHostedInvoiceLink('/us/hit_1.sig/', urls)?.token).toBe('hit_1.sig')
  })

  it('treats staging as a region', () => {
    expect(parseHostedInvoiceLink('/staging/t', urls)?.region).toBe('staging')
  })

  it.each([
    '/',
    '',
    '/us',
    '/us/',
    '/eu/t',
    '/in/t',
    '/us/t/extra',
    '//t',
    '/us//',
    '/constructor/t',
    '/toString/t',
  ])('%s is not a link', (path) => {
    expect(parseHostedInvoiceLink(path, urls)).toBeNull()
  })
})

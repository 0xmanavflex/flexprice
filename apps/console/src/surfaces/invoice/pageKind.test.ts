import { describe, expect, it } from 'vitest'
import { ApiError, ErrorKind } from '@fp/query'
import { pageKind } from './pageKind'

const invoice = { number: 'INV-1' }

describe('pageKind', () => {
  it('keeps a shown invoice when a background refresh fails', () => {
    expect(pageKind({ data: invoice, error: new ApiError(ErrorKind.Server, 'bad gateway'), isPending: false })).toBe('invoice')
  })

  it('shows the API message for a link that is not valid', () => {
    expect(pageKind({ data: undefined, error: new ApiError(ErrorKind.NotFound, 'This link is not valid.'), isPending: false })).toBe('invalid')
  })

  it('shows the failed page when nothing loaded', () => {
    expect(pageKind({ data: undefined, error: new ApiError(ErrorKind.Server, 'bad gateway'), isPending: false })).toBe('failed')
  })

  it('is loading until data or an error arrives', () => {
    expect(pageKind({ data: undefined, error: null, isPending: true })).toBe('loading')
  })
})

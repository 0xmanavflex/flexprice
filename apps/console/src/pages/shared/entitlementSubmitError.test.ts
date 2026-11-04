import { describe, expect, it } from 'vitest'
import { ApiError, ErrorKind } from '@fp/query'
import { entitlementSubmitError } from './entitlementSubmitError'

describe('entitlementSubmitError', () => {
  it("shows the API's reason for a rejected entitlement", () => {
    const error = new ApiError(
      ErrorKind.Invalid,
      'The meter has a tiered price; use a flat-fee price or remove the grant configuration.',
      { fromServer: true },
    )
    expect(entitlementSubmitError({ isError: true, error }, 'add')).toBe(
      'The meter has a tiered price; use a flat-fee price or remove the grant configuration.',
    )
  })

  it('falls back to the generic sentence when the server said nothing', () => {
    const error = new ApiError(ErrorKind.Server, 'The request failed (500).')
    expect(entitlementSubmitError({ isError: true, error }, 'save')).toBe(
      'Could not save the entitlement. Try again.',
    )
    expect(entitlementSubmitError({ isError: false, error: null }, 'add')).toBeNull()
  })
})

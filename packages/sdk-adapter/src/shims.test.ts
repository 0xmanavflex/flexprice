import { describe, expect, it } from 'vitest'
import { REMOVAL_ISSUE_PATTERN } from './shim'
import { SHIMS } from './index'

describe('the shim allowlist', () => {
  // The whole point of this package is that it shrinks. If it is empty, V2 is
  // running on the real contract and the package should be deleted.
  it('is empty, or every entry can be deleted on a named issue', () => {
    for (const shim of SHIMS) {
      expect(shim.endpoint, 'a shim must name the endpoint it reaches').toBeTruthy()
      expect(shim.reason, `${shim.endpoint} must say why the SDK cannot reach it`).toBeTruthy()
      expect(
        shim.removalIssue,
        `${shim.endpoint} must name the issue that removes it, as owner/repo#123`,
      ).toMatch(REMOVAL_ISSUE_PATTERN)
    }
  })

  it('has no duplicate endpoints', () => {
    const endpoints = SHIMS.map((s) => s.endpoint)
    expect(new Set(endpoints).size).toBe(endpoints.length)
  })

  // Not a hard cap — a tripwire. Crossing it means the contract cleanup has
  // stalled and V2 is quietly rebuilding the hand-written API layer it replaced.
  it('has not grown past the point where it is still a stopgap', () => {
    expect(SHIMS.length).toBeLessThanOrEqual(5)
  })
})

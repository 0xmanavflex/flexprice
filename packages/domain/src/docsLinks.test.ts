import { describe, expect, it } from 'vitest'
import { DOCS } from './docsLinks'

function urls(value: unknown): string[] {
  return typeof value === 'string' ? [value] : Object.values(value as object).flatMap(urls)
}

describe('DOCS', () => {
  it('names only canonical pages on docs.flexprice.io', () => {
    for (const url of urls(DOCS)) {
      expect(url).toMatch(
        /^https:\/\/docs\.flexprice\.io\/(docs|api-reference|developers|integrations)\//,
      )
      // A trailing slash is the redirecting form of a page, not the page.
      expect(url).not.toMatch(/\/(#|$)/)
    }
  })
})

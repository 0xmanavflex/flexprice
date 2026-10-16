import { describe, expect, it } from 'vitest'
import { legacyDestination } from './legacyRoutes'

describe('legacy bookmarks', () => {
  it.each([
    ['/subscriptions', '/contracts'],
    ['/subscriptions/new', '/contracts/new'],
    ['/subscriptions/sub_123', '/contracts/sub_123'],
    ['/credit-notes/cn_123', '/credit-memos/cn_123'],
    ['/products/feature_123/edit', '/features/feature_123/edit'],
  ])('preserves the destination of %s', (oldPath, nextPath) => {
    expect(legacyDestination(oldPath)).toBe(nextPath)
  })

  it.each(['/subscriptions-extra', '/credit-notes-archive', '/contracts', '/features'])(
    'does not redirect %s',
    (path) => {
      expect(legacyDestination(path)).toBeUndefined()
    },
  )
})

import { describe, expect, it } from 'vitest'
import { isSafeNavigationUrl } from './safeUrl'

describe('isSafeNavigationUrl', () => {
  it.each(['https://checkout.stripe.com/c/pay/x', 'http://localhost:8080/x'])('%s is safe', (url) => {
    expect(isSafeNavigationUrl(url)).toBe(true)
  })

  it.each(['http://evil.test/x', 'javascript:alert(1)', 'data:text/html,x', '', 'not a url'])(
    '%s is not safe',
    (url) => {
      expect(isSafeNavigationUrl(url)).toBe(false)
    },
  )
})

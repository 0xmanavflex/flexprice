import { beforeEach, describe, expect, it } from 'vitest'
import { rememberReturnTo, safeRedirect, takeReturnTo } from './returnTo'

describe('safeRedirect', () => {
  it.each([
    ['/invoices/inv_1?tab=payments', '/invoices/inv_1?tab=payments'],
    [undefined, '/'],
    ['', '/'],
    ['https://evil.test/x', '/'],
    ['//evil.test', '/'],
    ['/\\evil.test', '/'],
    ['javascript:alert(1)', '/'],
    ['/sign-in?redirect=/x', '/'],
  ])('%s → %s', (target, expected) => {
    expect(safeRedirect(target)).toBe(expected)
  })
})

describe('the return address across a provider round trip', () => {
  let values = new Map<string, string>()
  const tab = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => void values.set(k, v),
    removeItem: (k: string) => void values.delete(k),
  }
  beforeEach(() => {
    values = new Map()
  })

  it('keeps the address for the tab and hands it over once', () => {
    rememberReturnTo('/invoices/inv_1?tab=payments', tab)
    expect(takeReturnTo(undefined, tab)).toBe('/invoices/inv_1?tab=payments')
    expect(takeReturnTo(undefined, tab)).toBe('/')
  })

  it('prefers the address the sign-in page was given', () => {
    rememberReturnTo('/plans', tab)
    expect(takeReturnTo('/coupons?q=x', tab)).toBe('/coupons?q=x')
    expect(takeReturnTo(undefined, tab)).toBe('/')
  })

  it('never keeps an unsafe address', () => {
    rememberReturnTo('https://evil.test', tab)
    expect(takeReturnTo(undefined, tab)).toBe('/')
  })
})

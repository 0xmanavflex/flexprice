import { describe, expect, it } from 'vitest'
import {
  REFERRAL_SOURCES,
  onboardedMetadata,
  orgNameError,
  tenantOnboardingSchema,
} from './onboarding'

describe('orgNameError', () => {
  it('accepts an ordinary name', () => {
    expect(orgNameError('Acme Robotics')).toBeUndefined()
  })

  it('needs a name', () => {
    expect(orgNameError('   ')).toBe('Enter your organization name')
  })

  it('refuses Flexprice itself, in any case', () => {
    expect(orgNameError(' FlexPrice ')).toMatch(/That's us/)
  })

  it.each(['Test Co', 'acme demo', 'Flexprice Labs'])('refuses the banned word in %s', (name) => {
    expect(orgNameError(name)).toMatch(/can't include the word/)
  })

  it('matches whole words only', () => {
    expect(orgNameError('Testament Labs')).toBeUndefined()
    expect(orgNameError('Demographics Inc')).toBeUndefined()
  })
})

describe('tenantOnboardingSchema', () => {
  const valid = { orgName: 'Acme', orgUrl: 'https://acme.com', referralSource: 'Reddit' }

  it('passes a complete answer and trims the text fields', () => {
    const parsed = tenantOnboardingSchema.parse({ ...valid, orgName: '  Acme  ' })
    expect(parsed.orgName).toBe('Acme')
  })

  it('reports every missing field', () => {
    const result = tenantOnboardingSchema.safeParse({ orgName: '', orgUrl: '', referralSource: '' })
    expect(result.success).toBe(false)
    const paths = result.error?.issues.map((issue) => issue.path[0])
    expect(paths).toEqual(expect.arrayContaining(['orgName', 'orgUrl', 'referralSource']))
  })
})

describe('the website answer', () => {
  const valid = { orgName: 'Acme', referralSource: 'Reddit' }
  const ok = (orgUrl: string) => tenantOnboardingSchema.safeParse({ ...valid, orgUrl }).success

  it('takes a domain, with or without a scheme, port or path', () => {
    expect(ok('acme.com')).toBe(true)
    expect(ok('https://www.acme.co.uk/pricing')).toBe(true)
    expect(ok('http://app.acme.io:8080')).toBe(true)
    // A query or fragment straight after the domain, as a pasted link has.
    expect(ok('https://acme.com?ref=invite')).toBe(true)
    expect(ok('acme.com#pricing')).toBe(true)
  })

  it('refuses text that is not a website', () => {
    expect(ok('hello')).toBe(false)
    expect(ok('acme')).toBe(false)
    expect(ok('ftp://acme.com')).toBe(false)
    expect(ok('acme .com')).toBe(false)
  })
})

describe('onboardedMetadata', () => {
  it("keeps the tenant's existing keys and adds the flag and answers under V1's keys", () => {
    expect(
      onboardedMetadata(
        { plan: 'trial' },
        { orgName: 'Acme', orgUrl: ' https://acme.com ', referralSource: 'Reddit' },
      ),
    ).toEqual({
      plan: 'trial',
      onboarding_completed: 'true',
      onboarding_referral_source: 'Reddit',
      onboarding_organization_url: 'https://acme.com',
    })
  })
})

describe('REFERRAL_SOURCES', () => {
  it("stores V1's values", () => {
    expect(REFERRAL_SOURCES.map((source) => source.value)).toEqual([
      'LinkedIn',
      'X',
      'Reddit',
      'Blogs',
      'ChatGPT / Perplexity / Gemini',
      'HackerNews',
      'Product Hunt',
    ])
  })
})

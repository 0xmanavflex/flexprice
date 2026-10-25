import { describe, expect, it } from 'vitest'
import { SAML_UNAVAILABLE, defaultSamlConfig, samlConfigSchema } from './samlConfig'

function draft(patch: Record<string, unknown> = {}) {
  const { active: _active, ...rest } = defaultSamlConfig()
  return { ...rest, ...patch }
}

const COMPLETE = {
  enabled: true,
  idpEntityId: 'https://idp.example.com/metadata',
  idpSsoUrl: 'https://idp.example.com/sso',
  idpCertificate: '-----BEGIN CERTIFICATE-----abc-----END CERTIFICATE-----',
  emailAttribute: 'email',
  defaultRole: 'all_reader' as const,
  enforceSso: false,
}

describe('samlConfigSchema', () => {
  /**
   * A half-filled configuration is a legitimate save: somebody is waiting on
   * a certificate from their IdP. A half-filled configuration that is
   * *enabled* locks every user out of the tenant.
   */
  it('accepts an empty configuration while SSO is switched off', () => {
    expect(samlConfigSchema.safeParse(draft()).success).toBe(true)
  })

  it('accepts a complete configuration', () => {
    expect(samlConfigSchema.safeParse(COMPLETE).success).toBe(true)
  })

  it.each([
    ['no entity id', 'idpEntityId'],
    ['no sign-in URL', 'idpSsoUrl'],
    ['no certificate', 'idpCertificate'],
    ['no email attribute', 'emailAttribute'],
    ['no default role', 'defaultRole'],
  ])('refuses to enable SSO with %s', (_name, field) => {
    const result = samlConfigSchema.safeParse({ ...COMPLETE, [field]: '' })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.path[0] === field)).toBe(true)
  })

  /**
   * Not style policing: a SAML assertion posted over plain HTTP is an
   * authentication token travelling in the clear.
   */
  it('refuses a sign-in URL that is not https', () => {
    const result = samlConfigSchema.safeParse({
      ...COMPLETE,
      idpSsoUrl: 'http://idp.example.com/sso',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['idpSsoUrl'])
  })

  /**
   * `super_admin` is absent from the role list and rejected by the backend:
   * an identity provider that can mint an administrator owns the tenant.
   */
  it('rejects a role outside the two the provisioner may grant', () => {
    expect(samlConfigSchema.safeParse({ ...COMPLETE, defaultRole: 'super_admin' }).success).toBe(
      false,
    )
  })

  /**
   * `active` is Flexprice's own approval flag, flipped in the database and
   * ignored by the API in a PUT body. A draft that carried it would train a
   * screen to believe it had saved something it had not.
   */
  it('has no place for the read-only approval flag', () => {
    const parsed = samlConfigSchema.safeParse({ ...COMPLETE, active: true })

    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty('active')
  })
})

describe('SAML_UNAVAILABLE', () => {
  it('is an unconfigured config that says it could not be read', () => {
    expect(SAML_UNAVAILABLE).toEqual({ available: false, config: defaultSamlConfig() })
  })
})

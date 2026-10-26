/**
 * SAML single sign-on.
 *
 * `GET/PUT /settings/saml_config`, on the deployments that have it. The hosted
 * API does not: it answers `404 {"code":"not_found","message":"SAML single
 * sign-on is not available on this deployment"}`, because the routes are only
 * mounted when `auth.saml.enabled` is set. That 404 is a statement about the
 * deployment, not about this tenant's configuration: a tenant with nothing
 * saved on a SAML-capable deployment gets a 200 and the defaults, like every
 * other settings key.
 *
 * Which is why availability is modelled rather than inferred: a screen cannot
 * tell "SSO is off" from "SSO is not here" by looking at a config, and the two
 * need different words on screen.
 */
import { z } from 'zod'

/**
 * The roles a SAML assertion may be provisioned into.
 *
 * `super_admin` is deliberately absent and the backend rejects it: an identity
 * provider that can mint an administrator is an identity provider that owns
 * the tenant.
 */
export const SAML_DEFAULT_ROLES = ['all_reader', 'all_writer'] as const
export type SamlDefaultRole = (typeof SAML_DEFAULT_ROLES)[number]

export const SAML_DEFAULT_ROLE_LABEL: Record<SamlDefaultRole, string> = {
  all_reader: 'Read-only',
  all_writer: 'Read and write',
}

export interface SamlConfig {
  /** Whether the tenant has switched SSO on. */
  enabled: boolean
  idpEntityId: string
  idpSsoUrl: string
  /** The IdP's signing certificate, PEM. */
  idpCertificate: string
  /** Which SAML attribute carries the user's email. */
  emailAttribute: string
  /** The role a just-in-time provisioned user gets. Empty until chosen. */
  defaultRole: SamlDefaultRole | ''
  /**
   * Flexprice's own approval that this tenant may serve SSO.
   *
   * **Read-only.** It is flipped directly in the database and the API ignores
   * it in a PUT body. It is modelled so a screen can explain why a complete,
   * enabled configuration is not signing anyone in yet.
   */
  active: boolean
  /** When set, the backend refuses password login for this tenant's users. */
  enforceSso: boolean
}

/**
 * SSO, and whether this deployment has any.
 *
 * `available: false` means the console could not read the config: for **any**
 * reason, not only a 404. See `useSamlConfig` in `@fp/query` for why that
 * breadth is deliberate and load-bearing.
 */
export interface SamlSettings {
  available: boolean
  config: SamlConfig
}

/**
 * What a PUT may contain.
 *
 * `active` is not in it, because the API ignores it. Sending a field the
 * server discards trains a screen to believe it saved something it did not.
 *
 * The IdP fields are required only once SSO is switched on. A half-filled
 * configuration is a legitimate thing to save while somebody fetches the
 * certificate from their IdP; a half-filled configuration that is *enabled*
 * locks every user out of a tenant, which is the one failure mode a settings
 * form must not allow.
 */
export const samlConfigSchema = z
  .object({
    enabled: z.boolean(),
    idpEntityId: z.string().trim(),
    idpSsoUrl: z.string().trim(),
    idpCertificate: z.string().trim(),
    emailAttribute: z.string().trim(),
    defaultRole: z.union([z.enum(SAML_DEFAULT_ROLES), z.literal('')]),
    enforceSso: z.boolean(),
  })
  .superRefine((config, ctx) => {
    if (!config.enabled) return

    const required = [
      ['idpEntityId', 'Enter the identity provider’s entity ID'],
      ['idpSsoUrl', 'Enter the identity provider’s sign-in URL'],
      ['idpCertificate', 'Paste the identity provider’s certificate'],
      ['emailAttribute', 'Name the attribute that carries the email address'],
    ] as const

    for (const [field, message] of required) {
      if (config[field].length === 0) ctx.addIssue({ code: 'custom', path: [field], message })
    }

    if (config.idpSsoUrl.length > 0 && !/^https:\/\//i.test(config.idpSsoUrl)) {
      // Not style policing: a SAML assertion posted over plain HTTP is an
      // authentication token in the clear.
      ctx.addIssue({
        code: 'custom',
        path: ['idpSsoUrl'],
        message: 'The sign-in URL must use https',
      })
    }

    if (config.defaultRole.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultRole'],
        message: 'Choose the role new users are given',
      })
    }
  })

export type SamlConfigDraft = z.infer<typeof samlConfigSchema>

export function defaultSamlConfig(): SamlConfig {
  return {
    enabled: false,
    idpEntityId: '',
    idpSsoUrl: '',
    idpCertificate: '',
    emailAttribute: '',
    defaultRole: '',
    active: false,
    enforceSso: false,
  }
}

/** What a deployment without SSO looks like. */
export const SAML_UNAVAILABLE: SamlSettings = { available: false, config: defaultSamlConfig() }

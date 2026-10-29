import { z } from 'zod'
import { TenantMetadataFlag, TenantMetadataKey } from './tenant'

/**
 * Tenant onboarding: the three questions a new workspace answers once, after
 * sign-up and before Home. The same questions, rules and metadata keys as V1
 * (`flexprice-front/src/pages/onboarding`), so a tenant onboarded in either
 * dashboard reads as onboarded in both.
 */

/**
 * Where people heard about Flexprice. `value` is what V1 stores and writes to
 * the onboarding sheet, so it must not change; `label` is what the chip says.
 */
export const REFERRAL_SOURCES = [
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'X', label: 'X (Formerly Twitter)' },
  { value: 'Reddit', label: 'Reddit' },
  { value: 'Blogs', label: 'Blogs' },
  { value: 'ChatGPT / Perplexity / Gemini', label: 'ChatGPT / Perplexity / Gemini' },
  { value: 'HackerNews', label: 'HackerNews' },
  { value: 'Product Hunt', label: 'Product Hunt' },
] as const

/** Whole words an organization name may not contain (V1's list). */
export const BANNED_ORG_NAME_WORDS = ['test', 'demo', 'flexprice'] as const

/** Why an organization name is refused, or `undefined` when it is fine. */
export function orgNameError(name: string): string | undefined {
  const trimmed = name.trim()
  if (!trimmed) return 'Enter your organization name'
  if (trimmed.toLowerCase() === 'flexprice') {
    return "Oops! That's us. Enter your organization's name instead."
  }
  const word = BANNED_ORG_NAME_WORDS.find((w) => new RegExp(`\\b${w}\\b`, 'i').test(trimmed))
  return word ? `The name can't include the word “${word}”. Choose another one.` : undefined
}

/** A website: a domain with a dot, optionally with http(s)://, a port and a path. */
const WEBSITE = /^(https?:\/\/)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i

export const tenantOnboardingSchema = z.object({
  orgName: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const message = orgNameError(value)
      if (message) ctx.addIssue({ code: 'custom', message })
    }),
  orgUrl: z
    .string()
    .trim()
    .min(1, "Enter your organization's website")
    .regex(WEBSITE, 'Enter a website, for example acme.com'),
  referralSource: z.string().min(1, 'Pick where you found us'),
})

export type TenantOnboarding = z.infer<typeof tenantOnboardingSchema>

/**
 * The tenant's metadata once onboarding is done: what it had, plus the flag and
 * the two answers. Metadata is replaced whole by `PUT /tenants/update`, so the
 * existing keys are carried over rather than lost.
 */
export function onboardedMetadata(
  existing: Readonly<Record<string, string>>,
  answers: TenantOnboarding,
): Record<string, string> {
  return {
    ...existing,
    [TenantMetadataKey.OnboardingCompleted]: TenantMetadataFlag.True,
    [TenantMetadataKey.OnboardingReferralSource]: answers.referralSource,
    [TenantMetadataKey.OnboardingOrganizationUrl]: answers.orgUrl.trim(),
  }
}

/**
 * One row of the onboarding sheet. Exactly the columns V1 writes, and only
 * fields the form collects: V1 once kept sending fields its form had dropped,
 * which filled the sheet with blank columns for months.
 */
export interface OnboardingSheetRow {
  orgName: string
  orgUrl: string
  referralSource: string
  userEmail: string
  tenantId: string
  /** ISO 8601. */
  timestamp: string
}

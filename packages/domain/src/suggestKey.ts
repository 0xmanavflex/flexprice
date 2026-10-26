/** The prefixes V1 puts on a key it derives from a name. */
export const KEY_PREFIX = {
  customer: 'cust',
  plan: 'plan',
  addon: 'addon',
  group: 'group',
  costSheet: 'cost-sheet',
  feature: 'feat',
  taxRate: 'tax',
} as const

export type KeyPrefix = (typeof KEY_PREFIX)[keyof typeof KEY_PREFIX]

function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The key a create form fills in while the person types a name: the entity's
 * prefix plus the name, lowercased and hyphenated (`cust-acme-inc`). Anything
 * the key alphabet does not allow collapses to a hyphen. A blank name gives
 * `''` so the field stays empty rather than showing a bare prefix.
 */
export function suggestKey(prefix: KeyPrefix, name: string): string {
  const body = slug(name)
  return body ? `${prefix}-${body}` : ''
}

/** A tax code, as V1 suggests it: `tax-` plus the name (`tax-gst-18`). */
export function suggestTaxCode(name: string): string {
  return suggestKey(KEY_PREFIX.taxRate, name)
}

/**
 * Removes identifying values while preserving everything that makes a fixture
 * useful.
 *
 * The target is a dev environment, so the risk is lower than production — but
 * dev tenants get seeded from real data often enough that "it's only dev" is a
 * bad reason to skip this, and fixtures live in git forever.
 *
 * What is preserved, deliberately:
 *   - every key, and the presence/absence of every optional field. The shape is
 *     the whole point.
 *   - amounts, exactly. `"12345678901234567.89"` must survive as a string, or
 *     the fixture stops exercising the precision the domain layer exists for.
 *   - enum values, ids' *prefixes* and lengths, date ordering.
 *
 * What is replaced: names, emails, phone numbers, addresses, and free-text
 * metadata — deterministically, so the same input always yields the same
 * output and a re-capture produces a reviewable diff rather than noise.
 */
import { createHash } from 'node:crypto'

const COMPANIES = [
  'Acme Corp', 'Globex', 'Initech', 'Umbrella Ltd', 'Hooli', 'Soylent',
  'Vehement Capital', 'Massive Dynamic', 'Stark Industries', 'Wayne Enterprises',
]

const PEOPLE = ['Alex Chen', 'Priya Nair', 'Sam Okafor', 'Jo Martins', 'Kim Park']

/** Stable index from a value, so the same customer is always the same alias. */
function pick(list, seed) {
  const hash = createHash('sha256').update(String(seed)).digest();
  return list[hash.readUInt32BE(0) % list.length]
}

const NAME_KEYS = /^(name|customer_name|display_name|legal_name|company)$/i
const PERSON_KEYS = /^(contact_name|owner_name|user_name|full_name)$/i
const EMAIL_KEYS = /email/i
const PHONE_KEYS = /(phone|contact|mobile)/i
const ADDRESS_KEYS = /^address_(line1|line2|city|state|postal_code)$/i
const FREE_TEXT_KEYS = /^(description|notes|comment)$/i

/** Keys whose values are identifying but whose *shape* matters — aliased, not dropped. */
function scrubString(key, value, seed) {
  if (typeof value !== 'string' || value.length === 0) return value

  if (EMAIL_KEYS.test(key)) {
    const alias = pick(COMPANIES, seed).toLowerCase().replace(/[^a-z]+/g, '')
    return `billing@${alias}.example.com`
  }
  if (PERSON_KEYS.test(key)) return pick(PEOPLE, seed)
  if (NAME_KEYS.test(key)) return pick(COMPANIES, seed)
  if (PHONE_KEYS.test(key)) return '+1 555 0100'
  if (ADDRESS_KEYS.test(key)) {
    if (key === 'address_postal_code') return '94105'
    if (key === 'address_city') return 'San Francisco'
    if (key === 'address_state') return 'CA'
    return '1 Example Street'
  }
  // Keep the length class so layout still gets exercised, drop the content.
  if (FREE_TEXT_KEYS.test(key)) return value.length > 60 ? 'A longer description, replaced.' : 'Replaced.'

  // `external_id` often carries a customer's own identifiers.
  if (/^external_(id|customer_id)$/i.test(key)) {
    return `ext_${createHash('sha256').update(value).digest('hex').slice(0, 10)}`
  }
  return value
}

export function scrub(node, seed = 'seed', key = '') {
  if (Array.isArray(node)) return node.map((item, i) => scrub(item, `${seed}:${i}`, key))

  if (node && typeof node === 'object') {
    // Seed from the record's own id so one customer aliases consistently
    // everywhere it appears — in a list, on an invoice, on a subscription.
    const nextSeed = node.id ?? node.customer_id ?? seed
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = scrub(v, nextSeed, k)
    return out
  }

  if (typeof node === 'string') return scrubString(key, node, seed)
  return node
}

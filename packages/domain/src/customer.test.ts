import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CUSTOMER_QUERY,
  createCustomerSchema,
  emptyCustomer,
  isCustomerQueryFiltered,
} from './customer'

/**
 * The customer form's rules, against the API's.
 *
 * Every limit here mirrors a `validate:` tag on the backend's
 * `CreateCustomerRequest`. That is the whole point of the file: a client rule
 * that is *looser* than the server's does not make the server accept more, it
 * makes the form accept a value the save then rejects: and the rejection
 * arrives as a server-worded message about a field the person has already
 * scrolled past. A client rule that is *tighter* is its own bug: it refuses
 * something the product allows.
 *
 * Two were wrong when this file was written: `name` had no maximum against the
 * API's 255, and `phone` allowed 50 against the API's `max=20` on `contact`.
 */
const valid = () => ({ ...emptyCustomer(), externalId: 'cus_ext_1', name: 'Acme Robotics' })

const parse = (value: unknown) => createCustomerSchema.safeParse(value)

/** The fields that failed, so a test names the field rather than the message. */
function failedFields(value: unknown): string[] {
  const result = parse(value)
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]))
}

describe('createCustomerSchema', () => {
  it('accepts the minimum the API needs: an external id and a name', () => {
    expect(parse(valid()).success).toBe(true)
  })

  it.each([
    ['externalId', ''],
    ['name', ''],
  ])('requires %s', (field, value) => {
    expect(failedFields({ ...valid(), [field]: value })).toContain(field)
  })

  describe('lengths match the API exactly', () => {
    // [field, the API's max, the tag it mirrors]
    const LIMITS: [string, number, string][] = [
      ['name', 255, 'name max=255'],
      ['externalId', 255, 'external_id'],
      ['phone', 20, 'contact max=20'],
      ['addressLine1', 255, 'address_line1 max=255'],
      ['addressLine2', 255, 'address_line2 max=255'],
      ['addressCity', 100, 'address_city max=100'],
      ['addressState', 100, 'address_state max=100'],
      ['addressPostalCode', 20, 'address_postal_code max=20'],
    ]

    it.each(LIMITS)('%s accepts exactly its limit (%i, %s)', (field, max) => {
      expect(parse({ ...valid(), [field]: 'a'.repeat(max) }).success).toBe(true)
    })

    it.each(LIMITS)('%s refuses one over (%i, %s)', (field, max) => {
      expect(failedFields({ ...valid(), [field]: 'a'.repeat(max + 1) })).toContain(field)
    })
  })

  it('takes a blank email, and refuses one that is not an address', () => {
    // `omitempty,email` on the API: absent is fine, present must parse.
    expect(parse({ ...valid(), email: '' }).success).toBe(true)
    expect(failedFields({ ...valid(), email: 'not-an-address' })).toContain('email')
    expect(parse({ ...valid(), email: 'ops@acme.test' }).success).toBe(true)
  })

  it('takes a two-letter country code, or none', () => {
    expect(parse({ ...valid(), addressCountry: '' }).success).toBe(true)
    expect(parse({ ...valid(), addressCountry: 'IN' }).success).toBe(true)
    expect(failedFields({ ...valid(), addressCountry: 'India' })).toContain('addressCountry')
  })

  it('trims before measuring, so trailing spaces are not an error', () => {
    expect(parse({ ...valid(), name: `${'a'.repeat(255)}   ` }).success).toBe(true)
    // …and are not a way past the limit either.
    expect(failedFields({ ...valid(), name: `  ${'a'.repeat(256)}  ` })).toContain('name')
  })
})

describe('isCustomerQueryFiltered', () => {
  it('is not filtered on the default view or on every status', () => {
    expect(isCustomerQueryFiltered(DEFAULT_CUSTOMER_QUERY)).toBe(false)
    expect(isCustomerQueryFiltered({ ...DEFAULT_CUSTOMER_QUERY, filters: [] })).toBe(false)
  })

  it('reads the default filter the same whatever its property order', () => {
    expect(
      isCustomerQueryFiltered({
        ...DEFAULT_CUSTOMER_QUERY,
        filters: [{ value: ['published'], op: 'in', field: 'status' } as never],
      }),
    ).toBe(false)
  })

  it('is filtered when the person narrows it', () => {
    expect(
      isCustomerQueryFiltered({
        ...DEFAULT_CUSTOMER_QUERY,
        filters: [{ field: 'status', op: 'in', value: ['archived'] }],
      }),
    ).toBe(true)
  })
})

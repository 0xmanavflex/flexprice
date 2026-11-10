import { describe, expect, it } from 'vitest'
import { setPasswordSchema, signInSchema } from './auth'

const errors = (
  schema: {
    safeParse: (v: unknown) => {
      success: boolean
      error?: { issues: { message: string; path: PropertyKey[] }[] }
    }
  },
  value: unknown,
) => {
  const r = schema.safeParse(value)
  return r.success ? [] : (r.error?.issues ?? []).map((i) => i.message)
}

describe('signInSchema', () => {
  it('accepts a real pair', () => {
    expect(signInSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })

  it.each(['', '   ', 'not-an-email', 'a@', '@b.com'])('rejects %p as an email', (email) => {
    expect(signInSchema.safeParse({ email, password: 'x' }).success).toBe(false)
  })

  it('trims surrounding whitespace rather than rejecting it', () => {
    const result = signInSchema.safeParse({ email: '  a@b.com  ', password: 'x' })
    expect(result.success && result.data.email).toBe('a@b.com')
  })
})

describe('setPasswordSchema', () => {
  const valid = { password: 'correct horse battery', confirm: 'correct horse battery' }

  it('accepts a long password typed twice', () => {
    expect(setPasswordSchema.safeParse(valid).success).toBe(true)
  })

  // Length is the requirement that reliably increases strength. Composition
  // rules mostly produce `Password1!`.
  it('requires length rather than character classes', () => {
    expect(errors(setPasswordSchema, { password: 'short', confirm: 'short' })).toContain(
      'Use at least 12 characters',
    )
    expect(
      setPasswordSchema.safeParse({ password: 'aaaaaaaaaaaa', confirm: 'aaaaaaaaaaaa' }).success,
    ).toBe(true)
  })

  // bcrypt hashes at most 72 bytes, and the APIs refuse rather than truncate.
  it('caps the password at 72 bytes, not 72 characters', () => {
    const ascii = 'a'.repeat(72)
    expect(setPasswordSchema.safeParse({ password: ascii, confirm: ascii }).success).toBe(true)
    const tooLong = 'a'.repeat(73)
    expect(setPasswordSchema.safeParse({ password: tooLong, confirm: tooLong }).success).toBe(false)
    // 40 characters, 80 bytes.
    const accented = 'é'.repeat(40)
    expect(setPasswordSchema.safeParse({ password: accented, confirm: accented }).success).toBe(
      false,
    )
  })

  // A typo in a password field is invisible by definition.
  it('catches a mismatch, and reports it against the confirmation', () => {
    const result = setPasswordSchema.safeParse({ ...valid, confirm: 'correct horse batteru' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('These do not match')
      expect(result.error.issues[0]?.path).toEqual(['confirm'])
    }
  })

  it('asks for the confirmation when it is empty', () => {
    expect(errors(setPasswordSchema, { password: valid.password, confirm: '' })).toContain(
      'Type the password again',
    )
  })
})

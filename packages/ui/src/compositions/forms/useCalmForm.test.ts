import { describe, expect, it } from 'vitest'
import { emailEntryIsComplete, withoutEmptyFields, withoutOpenEmailEntries } from './useCalmForm'

const err = (message: string) => ({ type: 'custom', message })

describe('withoutEmptyFields', () => {
  it('drops errors on fields nothing was typed into', () => {
    expect(
      withoutEmptyFields(
        { name: err('Enter a name'), email: err('Enter a valid email address') } as never,
        { name: '  ', email: 'not-an-email' },
      ),
    ).toEqual({ email: err('Enter a valid email address') })
  })

  it('treats no number, no pick and no date as empty', () => {
    expect(
      withoutEmptyFields(
        { amount: err('Enter an amount'), tags: err('Pick one'), due: err('Pick a date') } as never,
        { amount: Number.NaN, tags: [], due: undefined },
      ),
    ).toEqual({})
  })

  it('walks nested and array fields', () => {
    expect(
      withoutEmptyFields(
        {
          tiers: [{ upTo: err('Enter a limit'), price: err('Must be positive') }],
          address: { city: err('Enter a city') },
        } as never,
        { tiers: [{ upTo: '', price: -1 }], address: { city: '' } },
      ),
    ).toEqual({ tiers: { 0: { price: err('Must be positive') } } })
  })

  it('keeps a finished email that is still not an address', () => {
    expect(emailEntryIsComplete('a@b.c')).toBe(true)
    expect(emailEntryIsComplete('d')).toBe(false)
    expect(emailEntryIsComplete('not-an-email')).toBe(false)
    expect(
      withoutOpenEmailEntries(
        {
          early: err('That does not look like an email address'),
          done: err('Enter a valid email address'),
          required: err('Enter your email'),
        } as never,
        { early: 'd', done: 'a@b.c', required: '' },
      ),
    ).toEqual({
      done: err('Enter a valid email address'),
      required: err('Enter your email'),
    })
  })

  it('keeps a mismatch on a field that has a value', () => {
    expect(
      withoutEmptyFields({ confirm: err("The passwords don't match") } as never, {
        confirm: 'abc',
      }),
    ).toEqual({ confirm: err("The passwords don't match") })
  })
})

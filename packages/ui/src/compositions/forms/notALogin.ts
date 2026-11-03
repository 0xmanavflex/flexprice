/**
 * Attributes that tell browsers and password managers a field is not a login.
 *
 * Console fields are amounts, rates, names and notes, never credentials. Without
 * these, Chrome autofill, 1Password, LastPass and Bitwarden guess at them: they
 * draw a key icon and offer saved sign-ins, so a price field reads as a password
 * field and a form pops a login prompt. Spread on an input, or on a `<form>` to
 * cover every field in it.
 */
export const NOT_A_LOGIN = {
  autoComplete: 'off',
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-bwignore': true,
  'data-form-type': 'other',
} as const

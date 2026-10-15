/** The confirmation link carried no usable session: expired, used, or rejected by Supabase. */
export class ConfirmationLinkInvalid extends Error {
  constructor(message = 'This confirmation link has expired or was already used.') {
    super(message)
    this.name = 'ConfirmationLinkInvalid'
  }
}

/** Supabase knows the email and password, but the address was never confirmed. */
export class EmailNotConfirmed extends Error {
  constructor(readonly email: string) {
    super('Confirm your email before signing in.')
    this.name = 'EmailNotConfirmed'
  }
}

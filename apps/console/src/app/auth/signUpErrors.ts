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

/**
 * The email already belongs to a confirmed account. Supabase does not refuse
 * the sign-up: it returns a stand-in user with no identities and sends no
 * email, so without this the screen would say to check an inbox that never
 * gets a link.
 */
export class EmailAlreadyRegistered extends Error {
  constructor(readonly email: string) {
    super('An account with that email already exists. Sign in instead.')
    this.name = 'EmailAlreadyRegistered'
  }
}

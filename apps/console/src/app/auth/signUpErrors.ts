/** The confirmation link carried no usable session: expired, used, or rejected by Supabase. */
export class ConfirmationLinkInvalid extends Error {
  constructor(message = 'This confirmation link has expired or was already used.') {
    super(message)
    this.name = 'ConfirmationLinkInvalid'
  }
}

import { z } from 'zod'

/**
 * Sign-in credentials.
 *
 * Kept in the domain with every other schema rather than inlined in the form.
 * Email formatting is not a billing rule, but a rule that lives in one place
 * except when it does not is a rule nobody can rely on — and the exception is
 * always the first thing to drift.
 */
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email')
    .email('That does not look like an email address'),
  password: z.string().min(1, 'Enter your password'),
})

export type SignInCredentials = z.infer<typeof signInSchema>

export const resetRequestSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('That does not look like an email address'),
})

export type ResetRequest = z.infer<typeof resetRequestSchema>

/**
 * Choosing a password, when accepting an invitation or completing a reset.
 *
 * The rules are deliberately few. Length is the one requirement that reliably
 * increases strength; composition rules ("one number, one symbol") mostly
 * produce `Password1!` and a sticky note. The confirmation field exists because
 * a typo in a password field is invisible by definition.
 */
export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Use at least 12 characters')
      .max(200, 'That is longer than we can store'),
    confirm: z.string().min(1, 'Type the password again'),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    message: 'These do not match',
  })

export type SetPassword = z.infer<typeof setPasswordSchema>

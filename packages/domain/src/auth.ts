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

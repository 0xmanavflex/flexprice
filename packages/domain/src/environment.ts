import { z } from 'zod'

/**
 * An environment, and the rules for creating one.
 *
 * The backend calls the non-production kind `development`; the product: and
 * every person using it: calls it a sandbox. The wire word is kept at the
 * boundary and the product word is used everywhere above it, because renaming
 * a concept in the interface is cheaper than teaching everyone the API's word
 * for it.
 */
export const EnvironmentType = {
  Production: 'production',
  /** The wire value. Presented as "Sandbox" throughout. */
  Sandbox: 'development',
} as const
export type EnvironmentType = (typeof EnvironmentType)[keyof typeof EnvironmentType]

export const ENVIRONMENT_TYPE_LABEL: Record<EnvironmentType, string> = {
  [EnvironmentType.Production]: 'Production',
  [EnvironmentType.Sandbox]: 'Sandbox',
}

/** One line each, and the line is the difference between them. */
export const ENVIRONMENT_TYPE_DESCRIPTION: Record<EnvironmentType, string> = {
  [EnvironmentType.Production]: 'Real customers, real money.',
  [EnvironmentType.Sandbox]: 'Nothing here charges anyone.',
}

export const environmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([EnvironmentType.Production, EnvironmentType.Sandbox]),
})
export type Environment = z.infer<typeof environmentSchema>

export const createEnvironmentSchema = z.object({
  /**
   * Named, not numbered. An environment's name is what appears in the switcher
   * and in the header of every page, so "EU staging" is worth more than
   * "Environment 4" on the one occasion it matters.
   */
  name: z.string().trim().min(1, 'Enter a name').max(60, 'Keep the name under 60 characters'),
  type: z.enum([EnvironmentType.Production, EnvironmentType.Sandbox]),
})
export type CreateEnvironment = z.infer<typeof createEnvironmentSchema>

export const emptyEnvironment: CreateEnvironment = {
  name: '',
  // Sandbox by default: the safe one should be the one you get by not choosing.
  type: EnvironmentType.Sandbox,
}

/** What the shell shows. `kind` collapses the wire word into the product's. */
export function environmentKind(type: EnvironmentType): 'production' | 'sandbox' {
  return type === EnvironmentType.Production ? 'production' : 'sandbox'
}

/**
 * Subscriptions in a sandbox are cancelled this many days after they start,
 * so test data does not bill forever. V1's `SANDBOX_AUTO_CANCELLATION_DAYS`.
 */
export const SANDBOX_AUTO_CANCELLATION_DAYS = 45

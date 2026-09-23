import { type z } from 'zod'

/**
 * A capability of the product, declared once.
 *
 * The problem this solves: today a capability like "pause a subscription"
 * exists three times — as a button, as whatever the command palette knows, and
 * as a tool an agent was separately taught. They drift, and the agent's copy
 * drifts furthest because nothing renders it.
 *
 * An action is the single declaration. The button renders it, the palette lists
 * it, and the MCP and WebMCP bridges expose it — from the same object, with the
 * same input schema and the same permission check. Adding a capability makes it
 * available to a person and to an agent in the same commit, or to neither.
 */
export interface ActionContext {
  /** Permissions the signed-in user holds. */
  permissions: ReadonlySet<string>
  /** Who is asking. An agent's call is still the user's call, with the user's rights. */
  actor: 'user' | 'agent'
}

export type ActionRisk =
  /** Reads. Safe to run speculatively; an agent may call without asking. */
  | 'read'
  /** Writes that are easy to undo. */
  | 'write'
  /**
   * Destructive, financial, or visible to a customer — voiding an invoice,
   * cancelling a subscription, charging a card. An agent must get explicit
   * human confirmation, every time, regardless of prior approval.
   */
  | 'sensitive'

export interface ActionDefinition<Input extends z.ZodType, Output> {
  /** Stable dotted id: `subscription.pause`. Part of the agent-facing contract. */
  id: string
  /** Human label. Rendered on the button and shown in the palette. */
  title: string
  /**
   * What it does and when to use it, in a sentence. This is what an agent reads
   * to decide whether to call it, so it is documentation with consequences —
   * write it for a competent stranger, not as a restatement of the title.
   */
  description: string
  input: Input
  /** All must be held. Checked identically for a person and for an agent. */
  permissions: readonly string[]
  risk: ActionRisk
  run: (input: z.output<Input>, ctx: ActionContext) => Promise<Output>
}

/**
 * Identity at runtime — the work is in the types.
 *
 * Declaring the object through this function is what pins `Input` to the
 * schema, so `run`'s first parameter is inferred rather than annotated. Write
 * the schema once and the handler cannot disagree with it.
 */
export function defineAction<Input extends z.ZodType, Output>(
  definition: ActionDefinition<Input, Output>,
): ActionDefinition<Input, Output> {
  return definition
}

export type AnyAction = ActionDefinition<z.ZodType, unknown>

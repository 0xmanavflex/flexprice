import { z } from 'zod'
import type { ActionContext, AnyAction } from './action'
import type { ActionRegistry } from './registry'

/**
 * The same actions, in the shapes other runtimes expect.
 *
 * Each bridge is a projection, never a second source of truth: none of them may
 * add a tool, rename one, or soften a permission. If a bridge needs something
 * the action does not have, the action grows it and every surface gets it.
 */

export interface ToolDescriptor {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: {
    readOnlyHint: boolean
    destructiveHint: boolean
    /** Sensitive actions refuse to run un-confirmed; say so before they are called. */
    requiresConfirmation: boolean
  }
}

function toJsonSchema(action: AnyAction): Record<string, unknown> {
  return z.toJSONSchema(action.input) as Record<string, unknown>
}

function describe(action: AnyAction): ToolDescriptor {
  return {
    name: action.id,
    description: action.description,
    inputSchema: toJsonSchema(action),
    annotations: {
      readOnlyHint: action.risk === 'read',
      destructiveHint: action.risk === 'sensitive',
      requiresConfirmation: action.risk === 'sensitive',
    },
  }
}

/**
 * Tool descriptors for an MCP server or an in-app agent.
 *
 * Scoped to the context, so the tool list a model sees is the set it can
 * actually use. Showing an agent tools that will refuse it wastes a turn and
 * teaches it to retry things that cannot work.
 */
export function toToolDescriptors(
  registry: ActionRegistry,
  ctx: ActionContext,
): ToolDescriptor[] {
  return registry.available(ctx).map(describe)
}

type ModelContextNavigator = Navigator & {
  modelContext?: { provideContext: (context: { tools: unknown[] }) => void }
}

/**
 * Publishes the actions to a browser agent via WebMCP.
 *
 * This replaces the single hand-written `get_flexprice_app_info` tool that the
 * V1 dashboard exposed. The point is not that there are more tools — it is that
 * nobody maintains the list. Ship an action, and the browser agent can use it.
 *
 * Returns false where the browser has no WebMCP support, which is most of them
 * today; call it unconditionally and let it decline.
 */
export function publishToWebMCP(registry: ActionRegistry, ctx: ActionContext): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as ModelContextNavigator
  if (!nav.modelContext?.provideContext) return false

  nav.modelContext.provideContext({
    tools: registry.available(ctx).map((action) => ({
      ...describe(action),
      // The bridge does not invoke. It routes back through the registry, so the
      // permission, validation and confirmation gates apply to a browser agent
      // exactly as they do to a button.
      execute: (input: unknown) => registry.invoke(action.id, input, ctx),
    })),
  })
  return true
}

export interface CommandPaletteEntry {
  id: string
  title: string
  description: string
  requiresConfirmation: boolean
}

/** The same list again, for the ⌘K palette. */
export function toCommandPalette(
  registry: ActionRegistry,
  ctx: ActionContext,
): CommandPaletteEntry[] {
  return registry.available(ctx).map((action) => ({
    id: action.id,
    title: action.title,
    description: action.description,
    requiresConfirmation: action.risk === 'sensitive',
  }))
}

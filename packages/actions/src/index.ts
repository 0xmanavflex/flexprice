/**
 * Actions — what the product can do.
 *
 * Deliberately *not* "how the UI talks to the backend". That is `@fp/query`'s
 * job. An action is a product capability — `createPlan`, `grantCredits`,
 * `changeSubscription`, `updateBudget` — named once, with its input schema, the
 * permissions it needs, and how risky it is.
 *
 *     Human UI  ─┐
 *     ⌘K palette ─┼─> actions ─> domain ─> query ─> @flexprice/sdk ─> backend
 *     Agent/WebMCP┘
 *
 * Two constraints keep this a seam rather than a framework:
 *
 * 1. **Nothing in the core UI depends on this package.** A button may invoke an
 *    action, but components, pages and the design system must build and render
 *    without it. Agent infrastructure does not get to shape the component tree,
 *    and no component becomes AI-aware.
 *
 * 2. **This package calls nothing.** It has no dependency on `@fp/query`,
 *    `@fp/api` or the SDK. An action's `run` is supplied by the app that
 *    registers it, so the seam stays thin and testable, and the layering above
 *    is a fact rather than a convention.
 *
 * What does not belong here, until there is a consumer asking for it: an agent
 * runtime, prompt handling, planning, or a chat surface. The point today is
 * that a capability is declared once and reachable by a person and by an agent
 * through the same gate — not that we have built an agent platform.
 */
export { defineAction } from './action'
export type { ActionContext, ActionDefinition, ActionRisk, AnyAction } from './action'

export { ActionError, ActionRegistry } from './registry'
export type { InvokeOptions } from './registry'

export { publishToWebMCP, toCommandPalette, toToolDescriptors } from './bridges'
export type { CommandPaletteEntry, ToolDescriptor } from './bridges'

import { z } from 'zod'
import type { ActionContext, AnyAction } from './action'

export class ActionError extends Error {
  readonly code: 'not_found' | 'forbidden' | 'invalid_input' | 'confirmation_required'
  readonly details: Record<string, string[]> | undefined

  constructor(
    code: ActionError['code'],
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ActionError'
    this.code = code
    this.details = details
  }
}

export interface InvokeOptions {
  /**
   * Set when a human has just confirmed *this* invocation.
   *
   * Sensitive actions refuse to run without it. Deliberately per-call and not a
   * session flag: "you approved a refund earlier" is not consent to the next
   * one, and an agent that can set a sticky bit will set it.
   */
  confirmed?: boolean
}

export class ActionRegistry {
  readonly #actions = new Map<string, AnyAction>()

  constructor(actions: readonly AnyAction[] = []) {
    for (const action of actions) this.register(action)
  }

  register(action: AnyAction): void {
    if (this.#actions.has(action.id)) {
      // Two capabilities under one id means an agent calling that id gets
      // whichever registered last. Fail at wiring time, loudly.
      throw new Error(`Duplicate action id: ${action.id}`)
    }
    this.#actions.set(action.id, action)
  }

  get(id: string): AnyAction | undefined {
    return this.#actions.get(id)
  }

  all(): readonly AnyAction[] {
    return [...this.#actions.values()]
  }

  /**
   * The actions this context may actually run.
   *
   * Every surface lists from here — the palette, the MCP tool list, the WebMCP
   * bridge. An action a user cannot run is one they should not be offered, and
   * an agent should not be told a tool exists that will only ever refuse it.
   */
  available(ctx: ActionContext): readonly AnyAction[] {
    return this.all().filter((action) =>
      action.permissions.every((permission) => ctx.permissions.has(permission)),
    )
  }

  /**
   * The one path through which an action runs.
   *
   * Permission, then input, then confirmation, then the handler. `run` is never
   * called directly anywhere else, so no caller — UI or agent — can skip a gate
   * by being the newer code path.
   */
  async invoke(
    id: string,
    rawInput: unknown,
    ctx: ActionContext,
    options: InvokeOptions = {},
  ): Promise<unknown> {
    const action = this.#actions.get(id)
    if (!action) throw new ActionError('not_found', `No such action: ${id}`)

    const missing = action.permissions.filter((p) => !ctx.permissions.has(p))
    if (missing.length > 0) {
      throw new ActionError('forbidden', `${action.title} requires: ${missing.join(', ')}`)
    }

    const parsed = action.input.safeParse(rawInput)
    if (!parsed.success) {
      throw new ActionError(
        'invalid_input',
        `Invalid input for ${action.id}`,
        z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      )
    }

    if (action.risk === 'sensitive' && !options.confirmed) {
      throw new ActionError(
        'confirmation_required',
        `${action.title} is sensitive and needs explicit confirmation before it runs.`,
      )
    }

    return action.run(parsed.data, ctx)
  }
}

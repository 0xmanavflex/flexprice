import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { defineAction, type ActionContext, type AnyAction } from './action'
import { ActionRegistry } from './registry'
import { publishToWebMCP, toCommandPalette, toToolDescriptors } from './bridges'

const pauseSubscription = vi.fn(async () => ({ status: 'paused' }))
const voidInvoice = vi.fn(async () => ({ status: 'voided' }))

const pause = defineAction({
  id: 'subscription.pause',
  title: 'Pause subscription',
  description: 'Stops billing a subscription without cancelling it.',
  input: z.object({ subscriptionId: z.string().min(1) }),
  permissions: ['subscription:write'],
  risk: 'write',
  run: pauseSubscription,
})

const voidIt = defineAction({
  id: 'invoice.void',
  title: 'Void invoice',
  description: 'Voids a finalized invoice. The customer sees this.',
  input: z.object({ invoiceId: z.string().min(1) }),
  permissions: ['invoice:write'],
  risk: 'sensitive',
  run: voidInvoice,
})

const listPlans = defineAction({
  id: 'plan.list',
  title: 'List plans',
  description: 'Returns every plan in the active environment.',
  input: z.object({}),
  permissions: [],
  risk: 'read',
  run: async () => [],
})

const ALL = [pause, voidIt, listPlans] as unknown as AnyAction[]

function ctx(permissions: string[], actor: ActionContext['actor'] = 'user'): ActionContext {
  return { permissions: new Set(permissions), actor }
}

let registry: ActionRegistry
beforeEach(() => {
  vi.clearAllMocks()
  registry = new ActionRegistry(ALL)
})

describe('registration', () => {
  it('refuses two actions under one id, at wiring time', () => {
    expect(() => registry.register(pause as unknown as AnyAction)).toThrow(/Duplicate action id/)
  })
})

describe('permissions', () => {
  it('runs an action the caller is entitled to', async () => {
    await expect(
      registry.invoke('subscription.pause', { subscriptionId: 'sub_1' }, ctx(['subscription:write'])),
    ).resolves.toEqual({ status: 'paused' })
    expect(pauseSubscription).toHaveBeenCalledOnce()
  })

  it('refuses one it is not, naming what is missing', async () => {
    await expect(
      registry.invoke('subscription.pause', { subscriptionId: 'sub_1' }, ctx([])),
    ).rejects.toMatchObject({ code: 'forbidden', message: /subscription:write/ })
    expect(pauseSubscription).not.toHaveBeenCalled()
  })

  // The property the seam rests on: an agent is the user, with the user's
  // rights. There is no agent bypass, because there is one invoke().
  it('gives an agent no more than the user it acts for', async () => {
    await expect(
      registry.invoke('subscription.pause', { subscriptionId: 'sub_1' }, ctx([], 'agent')),
    ).rejects.toMatchObject({ code: 'forbidden' })

    await expect(
      registry.invoke(
        'subscription.pause',
        { subscriptionId: 'sub_1' },
        ctx(['subscription:write'], 'agent'),
      ),
    ).resolves.toEqual({ status: 'paused' })
  })

  it('lists only what the caller can run', () => {
    expect(registry.available(ctx([])).map((a) => a.id)).toEqual(['plan.list'])
  })
})

describe('input validation', () => {
  it('rejects bad input before the handler sees it, with field errors', async () => {
    const failure = registry.invoke(
      'subscription.pause',
      { subscriptionId: '' },
      ctx(['subscription:write']),
    )
    await expect(failure).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(failure).rejects.toHaveProperty('details.subscriptionId')
    expect(pauseSubscription).not.toHaveBeenCalled()
  })

  it('rejects an unknown action rather than failing obscurely', async () => {
    await expect(registry.invoke('subscription.explode', {}, ctx([]))).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})

describe('sensitive actions', () => {
  it('will not run without confirmation of this invocation', async () => {
    await expect(
      registry.invoke('invoice.void', { invoiceId: 'inv_1' }, ctx(['invoice:write'])),
    ).rejects.toMatchObject({ code: 'confirmation_required' })
    expect(voidInvoice).not.toHaveBeenCalled()
  })

  it('runs once this invocation is confirmed', async () => {
    await expect(
      registry.invoke('invoice.void', { invoiceId: 'inv_1' }, ctx(['invoice:write']), {
        confirmed: true,
      }),
    ).resolves.toEqual({ status: 'voided' })
  })

  // Confirmation is per-call. A second void needs a second yes.
  it('does not carry confirmation over to the next call', async () => {
    await registry.invoke('invoice.void', { invoiceId: 'inv_1' }, ctx(['invoice:write']), {
      confirmed: true,
    })
    await expect(
      registry.invoke('invoice.void', { invoiceId: 'inv_2' }, ctx(['invoice:write'])),
    ).rejects.toMatchObject({ code: 'confirmation_required' })
    expect(voidInvoice).toHaveBeenCalledOnce()
  })

  it('checks permission before it asks for confirmation', async () => {
    // Asking someone to confirm what they were never allowed to do is worse
    // than refusing, and it leaks which capabilities exist.
    await expect(
      registry.invoke('invoice.void', { invoiceId: 'inv_1' }, ctx([])),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })
})

describe('bridges project the same set', () => {
  it('describes tools with JSON Schema an agent can fill in', () => {
    const tool = toToolDescriptors(registry, ctx(['invoice:write'])).find(
      (t) => t.name === 'invoice.void',
    )
    expect(tool?.description).toBe('Voids a finalized invoice. The customer sees this.')
    expect(tool?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      requiresConfirmation: true,
    })
    expect(tool?.inputSchema).toMatchObject({
      type: 'object',
      properties: { invoiceId: { type: 'string' } },
    })
  })

  it('never offers an agent a tool the user could not run', () => {
    expect(toToolDescriptors(registry, ctx([], 'agent')).map((t) => t.name)).toEqual(['plan.list'])
  })

  it('shows the palette and the agent the identical capability set', () => {
    const permissions = ctx(['subscription:write', 'invoice:write'])
    expect(toCommandPalette(registry, permissions).map((e) => e.id)).toEqual(
      toToolDescriptors(registry, permissions).map((t) => t.name),
    )
  })

  it('routes a WebMCP call back through the gates instead of around them', async () => {
    let published: { tools: { name: string; execute: (i: unknown) => Promise<unknown> }[] } | null =
      null
    vi.stubGlobal('navigator', {
      modelContext: { provideContext: (c: never) => void (published = c) },
    })

    expect(publishToWebMCP(registry, ctx(['invoice:write'], 'agent'))).toBe(true)

    const tool = published!.tools.find((t) => t.name === 'invoice.void')!
    await expect(tool.execute({ invoiceId: 'inv_1' })).rejects.toMatchObject({
      code: 'confirmation_required',
    })
    expect(voidInvoice).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('declines quietly where the browser has no WebMCP', () => {
    vi.stubGlobal('navigator', {})
    expect(publishToWebMCP(registry, ctx([]))).toBe(false)
    vi.unstubAllGlobals()
  })
})

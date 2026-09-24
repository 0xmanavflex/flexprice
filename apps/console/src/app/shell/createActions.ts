import type { ShellCreateAction } from '@fp/ui/compositions'

/**
 * What the Create button offers, and where each one goes.
 *
 * Six, not twenty. The test is whether someone starts this flow *cold* —
 * without already being on the screen that owns it. Creating a subscription is
 * the clearest case: it begins with a customer in mind and nothing else, and
 * today it costs a navigation to Customers and a search before the work starts.
 * Creating a price, by contrast, only ever happens while editing a plan, so it
 * belongs on the plan and not here.
 *
 * `startsGroup` marks where a rule is drawn: what you sell, then who you sell
 * it to, then the money.
 */
export interface CreateAction extends ShellCreateAction {
  /** Where the flow begins. Routed by the app, so this stays plain data. */
  path: string
}

export const CREATE_ACTIONS: CreateAction[] = [
  { id: 'subscription', label: 'New subscription', path: '/subscriptions/new' },
  { id: 'customer', label: 'New customer', path: '/customers' },

  { id: 'plan', label: 'New plan', path: '/plans', startsGroup: true },
  { id: 'feature', label: 'New feature', path: '/features/new' },

  { id: 'invoice', label: 'New invoice', path: '/invoices', startsGroup: true },
  { id: 'payment', label: 'Record a payment', path: '/payments' },
]

export function pathForCreateAction(id: string): string | undefined {
  return CREATE_ACTIONS.find((action) => action.id === id)?.path
}

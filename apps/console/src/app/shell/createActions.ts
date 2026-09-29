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
 *
 * ## What a `path` has to be worth
 *
 * Every entry here is a navigation and nothing more, so the menu is only as
 * honest as the page it lands on. `/features/new` and `/subscriptions/new`
 * open the flow itself; the rest land on a list whose toolbar carries the
 * create button, which costs one more click but does arrive somewhere. What
 * an entry must never be is a path to a page with no create action at all —
 * that is the same dead end one level up, and it is worse than the menu being
 * short, because it was advertised.
 *
 * Groups and cost sheets are here now that their lists offer to create one.
 * Both hand off to the current dashboard, because `POST /groups` and
 * `POST /costs` are not wired to a drawer in V2 yet, and both drop their
 * offer when no legacy origin is configured — so these two entries lead to a
 * create button exactly when the page they land on has one.
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
  { id: 'group', label: 'New group', path: '/groups' },
  { id: 'cost-sheet', label: 'New cost sheet', path: '/cost-sheets' },

  { id: 'invoice', label: 'New invoice', path: '/invoices', startsGroup: true },
  { id: 'payment', label: 'Record a payment', path: '/payments' },
]

export function pathForCreateAction(id: string): string | undefined {
  return CREATE_ACTIONS.find((action) => action.id === id)?.path
}

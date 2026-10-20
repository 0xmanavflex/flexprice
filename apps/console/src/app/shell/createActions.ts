import { RBAC_ENTITY } from '@fp/domain'
import type { ShellCreateAction } from '@fp/ui/compositions'

/**
 * What the Create button offers, and where each one goes.
 *
 * Four, in one flat list: a contract, a customer, an invoice and a payment.
 * The test is whether someone starts this flow *cold* — without already being
 * on the screen that owns it. Catalogue work (plans, products, groups, cost
 * sheets) happens while you are in the catalogue, so it is started from there
 * and not from here.
 *
 * Every `path` is the create flow itself, never a list page: a menu item that
 * says "New invoice" and lands on the invoice list has advertised something it
 * did not deliver.
 */
export interface CreateAction extends ShellCreateAction {
  /** Where the flow begins. Routed by the app, so this stays plain data. */
  path: string
}

export const CREATE_ACTIONS: CreateAction[] = [
  // `entity` is what each creates: the menu disables an item without write on it.
  {
    id: 'subscription',
    label: 'New contract',
    path: '/contracts/new',
    entity: RBAC_ENTITY.Subscription,
  },
  { id: 'customer', label: 'New customer', path: '/customers/new', entity: RBAC_ENTITY.Customer },
  { id: 'invoice', label: 'New invoice', path: '/invoices/new', entity: RBAC_ENTITY.Invoice },
  { id: 'payment', label: 'Record a payment', path: '/payments/new', entity: RBAC_ENTITY.Payment },
]

export function pathForCreateAction(id: string): string | undefined {
  return CREATE_ACTIONS.find((action) => action.id === id)?.path
}

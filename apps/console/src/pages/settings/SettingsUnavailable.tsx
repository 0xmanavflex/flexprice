import { EmptyState } from '@fp/ui/compositions'
import { SettingsBlock } from './panelKit'
import type { SettingsTabSpec } from './sections'

/**
 * What an unavailable settings tab says, and why it says it in words.
 *
 * **No tab uses this today**; it is also the fallback for a tab declared in
 * the table with no panel wired to it. A tab belongs here when the deployment
 * declines the capability (a 404 saying so), not when the generated SDK lacks
 * a module for it.
 *
 * Eight tabs used to render this, on the reasoning that `/settings/:key` was
 * unreachable: `settings.go` is unannotated, so the route is absent from the
 * OpenAPI document and there is no `settings` module in the generated SDK.
 * The premise was right and the conclusion was wrong: the routes answer 200
 * in production, and `@fp/api`'s `settings.ts` now reaches them with `fetch`,
 * the same way `session.ts` already reached the four undocumented auth routes.
 * Missing from the contract and missing from the server are different claims.
 * Worth remembering the next time a generated client is read as the territory.
 *
 * Three things this deliberately is not:
 *
 *   - **Not "coming soon".** Nobody has committed to a date, and a date nobody
 *     owns is a promise the screen makes on somebody else's behalf.
 *   - **Not a form.** A disabled form still teaches the shape of a thing that
 *     does not exist; a form that saves into nothing is worse. The console
 *     already learned this from a global search box that swallowed what you
 *     typed: see `ShellSearch`, which now says plainly that there is nothing
 *     to search and points at the boxes that work.
 *   - **Not hidden.** The tab stays in the strip and stays selectable.
 *     Removing it makes "not built" and "not permitted" look identical, and
 *     sends people hunting for a tab they remember.
 *
 * `EmptyState` carries `role="status"`, so selecting one of these tabs is
 * announced rather than only looking blank.
 */
export interface SettingsUnavailableProps {
  tab: SettingsTabSpec
  /** What this tab would configure, in the product's words. One sentence. */
  what: string
  /** Where the work can be done today, if anywhere. */
  workaround?: string
}

export function SettingsUnavailable({ tab, what, workaround }: SettingsUnavailableProps) {
  return (
    <SettingsBlock label={tab.label}>
      <EmptyState
        size="inline"
        title={`${tab.label} is not enabled on this deployment`}
        description={
          `${what} This Flexprice deployment reports it as switched off, so there is ` +
          `nothing here to read or change. Turning it on is a server-side change, not ` +
          `something this console can do.` +
          (workaround ? ` ${workaround}` : '')
        }
      />
    </SettingsBlock>
  )
}

/**
 * One line per unavailable tab, saying what it would have configured.
 *
 * Written for the person reading the screen, not the person building it: the
 * same rule `placeholderRoutes.ts` sets for its descriptions. Keyed
 * `<section>/<tab>` so a tab cannot pick up another section's sentence.
 */
export const UNAVAILABLE_COPY: Record<string, { what: string; workaround?: string }> = {
  'billing/invoices': {
    what: 'These are the defaults every invoice inherits: numbering, due terms, the footer your customers read.',
    workaround: 'Individual invoices are still fully editable under Invoices.',
  },
  'billing/subscriptions': {
    what: 'These are the defaults every new contract inherits: proration, the billing anchor, what happens at the end of a term.',
    workaround: 'Each contract still carries its own settings where it is created.',
  },
  'billing/currencies': {
    what: 'Custom currencies would let you bill in a unit Flexprice does not ship with.',
    workaround:
      'Pricing units: the closest working equivalent: are under Product Catalog → Price Units.',
  },
  'customer-experience/portal': {
    what: 'The customer portal is the page your customers see their own usage and invoices on, and this is where it would be branded and switched on.',
  },
  'customer-experience/onboarding': {
    what: 'Onboarding automation would decide what happens to a customer between signing up and their first invoice.',
  },
  'notifications/wallet-alerts': {
    what: 'Wallet alerts would warn you across the whole tenant when a customer balance runs low.',
  },
}

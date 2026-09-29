import { EmptyState } from '@fp/ui/compositions'
import { PlugZapIcon } from 'lucide-react'
import type { SettingsTabSpec } from './sections'

/**
 * What an unavailable settings tab says, and why it says it in words.
 *
 * Eight tabs in this screen have no API behind them. They are all the same
 * absence: the backend serves them from `GET/PUT/DELETE /settings/:key`, and
 * `settings.go` carries swagger annotations on **none of its three handlers**,
 * so the route never reaches the OpenAPI document, never reaches
 * `@flexprice/sdk` — there is no `settings` module in the generated client at
 * all — and therefore never reaches `@fp/query`, whose index says so.
 *
 * Three things this deliberately is not:
 *
 *   - **Not "coming soon".** Nobody has committed to a date, and a date nobody
 *     owns is a promise the screen makes on somebody else's behalf.
 *   - **Not a form.** A disabled form still teaches the shape of a thing that
 *     does not exist; a form that saves into nothing is worse. The console
 *     already learned this from a global search box that swallowed what you
 *     typed — see `ShellSearch`, which now says plainly that there is nothing
 *     to search and points at the boxes that work.
 *   - **Not hidden.** The tab stays in the strip and stays selectable.
 *     Removing it makes "not built" and "not permitted" look identical, and
 *     sends people hunting for a tab they remember.
 *
 * `EmptyState` carries `role="status"`, so selecting one of these tabs is
 * announced rather than only looking blank — the same treatment
 * `SettingsShell` gives its own unavailable tabs. The copy is written here
 * rather than taken from the shell's built-in state because the shell's
 * sentence ("It is not part of this account or environment") describes a
 * permissions or plan gap, and that is not what is true of these eight: the
 * capability is missing from the contract, not from the account.
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
    <EmptyState
      size="page"
      icon={<PlugZapIcon aria-hidden />}
      title={`${tab.label} needs a backend contract`}
      description={
        `${what} There is no API for it to call: these settings are served by ` +
        `GET/PUT/DELETE /settings/:key, and none of those three handlers is annotated, ` +
        `so the route is missing from the OpenAPI document and from the generated SDK. ` +
        `Annotating settings.go and republishing the SDK is what turns this tab on.` +
        (workaround ? ` ${workaround}` : '')
      }
    />
  )
}

/**
 * One line per unavailable tab, saying what it would have configured.
 *
 * Written for the person reading the screen, not the person building it — the
 * same rule `placeholderRoutes.ts` sets for its descriptions. Keyed
 * `<section>/<tab>` so a tab cannot pick up another section's sentence.
 */
export const UNAVAILABLE_COPY: Record<string, { what: string; workaround?: string }> = {
  'team/sso': {
    what: 'Single sign-on would let your team sign in through your own identity provider instead of a Flexprice password.',
    workaround:
      'Until then, members sign in with an email and password, and you invite them under Members.',
  },
  'billing/invoices': {
    what: 'These are the defaults every invoice inherits — numbering, due terms, the footer your customers read.',
    workaround: 'Individual invoices are still fully editable under Invoices.',
  },
  'billing/subscriptions': {
    what: 'These are the defaults every new subscription inherits — proration, the billing anchor, what happens at the end of a term.',
    workaround: 'Each subscription still carries its own settings where it is created.',
  },
  'billing/currencies': {
    what: 'Custom currencies would let you bill in a unit Flexprice does not ship with.',
    workaround:
      'Pricing units — the closest working equivalent — are under Product Catalog → Price Units.',
  },
  'customer-experience/portal': {
    what: 'The customer portal is the page your customers see their own usage and invoices on, and this is where it would be branded and switched on.',
  },
  'customer-experience/onboarding': {
    what: 'Onboarding automation would decide what happens to a customer between signing up and their first invoice.',
  },
  'developers/webhooks': {
    what: 'Webhooks are how Flexprice tells your systems that something happened — an invoice finalised, a payment failed.',
  },
  'notifications/wallet-alerts': {
    what: 'Wallet alerts would warn you across the whole tenant when a customer balance runs low.',
    workaround:
      'Alert rules, on the tab beside this one, do work — but they are per-entity, so a wallet is watched one at a time rather than by a tenant-wide rule.',
  },
}

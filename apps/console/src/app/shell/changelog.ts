import type { ShellChangelogEntry } from '@fp/ui/compositions'
import { DOCS } from '@fp/domain'
import { env } from '@/env'

/**
 * What changed from the old console (V1) to this one, newest first, for the
 * "What's new" stack at the foot of the sidebar.
 *
 * Six at most: the stack shows three, and a list longer than a short session
 * of dismissing stops being news. Adding a release is adding an entry at the
 * top with a new `id` (it is what a dismissal is remembered under, so reusing
 * one would hide the new card from anyone who dismissed the old); drop the
 * oldest to stay at six. Every `href` is a page on docs.flexprice.io that
 * explains the change, and `scene` is the product figure for its area.
 */
const RELEASES: ShellChangelogEntry[] = [
  {
    id: '2026-11-console-v2',
    title: 'A new console',
    summary: 'Search every record with ⌘K, and switch environments from the breadcrumb.',
    href: DOCS.home,
    scene: 'home',
  },
  {
    id: '2026-11-contracts',
    title: 'Subscriptions are now contracts',
    summary: 'Charges split into Current, Upcoming and History, and a contract can have a parent.',
    href: DOCS.subscriptionCreate,
    scene: 'contracts',
  },
  {
    id: '2026-11-addons',
    title: 'Add-ons work like plans',
    summary: 'Charges, entitlements and credit grants sit together on one Overview.',
    href: DOCS.addons,
    scene: 'catalog',
  },
  {
    id: '2026-11-wallet-bonus',
    title: 'Bonus credits on top-ups',
    summary: 'Wallets earn bonus credits by slab, and the ledger lists debits beside top-ups.',
    href: DOCS.bonusCredits,
    scene: 'payments',
  },
  {
    id: '2026-11-customer-page',
    title: 'Every customer on one page',
    summary: 'Contracts, invoices, wallets, usage and an activity trail you can filter by person.',
    href: DOCS.customers,
    scene: 'customers',
  },
  {
    id: '2026-11-events-debugger',
    title: 'Debug events as they arrive',
    summary: 'The debugger flags an event missing the field its meter aggregates.',
    href: DOCS.eventDebugger,
    scene: 'developers',
  },
]

/**
 * Flexprice for Slack leads while its demo video is configured
 * (`VITE_SLACK_DEMO_VIDEO_URL`, a Loom link that can change without a
 * release); without it there is nothing to show, and the card is left out.
 */
export function changelogEntries(slackDemoVideoUrl: string | null): ShellChangelogEntry[] {
  const slack: ShellChangelogEntry[] = slackDemoVideoUrl
    ? [
        {
          id: '2026-11-slack-agent',
          title: 'Flexprice for Slack',
          summary: 'Ask billing questions in any thread and get the real numbers back.',
          href: slackDemoVideoUrl,
          scene: 'developers',
        },
      ]
    : []
  return [...slack, ...RELEASES].slice(0, 6)
}

export const CHANGELOG: ShellChangelogEntry[] = changelogEntries(env.slackDemoVideoUrl)

/** The `localStorage` key holding the ids of dismissed entries. */
export const CHANGELOG_STORAGE_KEY = 'fp.changelog.dismissed'

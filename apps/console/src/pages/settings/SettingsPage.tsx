import type { ReactNode } from 'react'
import { SettingsShell, type SettingsSection } from '@fp/ui/pages'
import {
  BadgeDollarSignIcon,
  BellIcon,
  BotIcon,
  CoinsIcon,
  KeyRoundIcon,
  PercentIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SmileIcon,
  TagIcon,
  TicketPercentIcon,
  UsersIcon,
} from 'lucide-react'
import { AlertRulesPanel } from './AlertRulesPanel'
import { ApiKeysPanel } from './ApiKeysPanel'
import { AppearancePanel } from './AppearancePanel'
import { CurrenciesPanel } from './CurrenciesPanel'
import { EnvironmentsPanel } from './EnvironmentsPanel'
import { InvoicesPanel } from './InvoicesPanel'
import { OnboardingPanel } from './OnboardingPanel'
import { PortalPanel } from './PortalPanel'
import { MembersPanel } from './MembersPanel'
import { PlanUsagePanel } from './PlanUsagePanel'
import { ProfilePanel } from './ProfilePanel'
import { RolesPanel } from './RolesPanel'
import { ServiceAccountsPanel } from './ServiceAccountsPanel'
import { SubscriptionsPanel } from './SubscriptionsPanel'
import { WalletAlertsPanel } from './WalletAlertsPanel'
import { WebhooksPanel } from './WebhooksPanel'
import { SettingsUnavailable, UNAVAILABLE_COPY } from './SettingsUnavailable'
import {
  RAIL_SECTIONS,
  SETTINGS_SECTIONS,
  type SettingsSectionSpec,
  findSettingsSection,
  findSettingsTab,
  firstTabOf,
} from './sections'

/**
 * Settings: a flat rail of sections, with a tab strip for those that have several pages. Both ids are in the URL.
 *
 * The page is wiring and dispatch: it turns `?section=&tab=` into a section
 * and a tab, hands `SettingsShell` a fully controlled pair, and renders the
 * one panel that pair names. Every panel below fetches its own data — there is
 * no shared loader, because the panels have nothing in common to load and a
 * page-level spinner would make switching tabs feel slower than it is.
 *
 * ## The one rule the shell hands back
 *
 * `SettingsShell` is fully controlled and reports `onSectionChange` and
 * `onTabChange` separately. Changing section **does not change tab** — the
 * shell cannot know which tab a section should open on. So the section handler
 * here looks up the new section's first tab and writes *both* ids in a single
 * `navigate()`. Two navigations would mean two history entries and one
 * intermediate render at an impossible pair (`section=developers&tab=profile`),
 * which the codec would then correct — a visible flicker and a Back button
 * that goes somewhere nobody was.
 *
 * `replace: true` for the same reason list pages use it: flipping through four
 * tabs should not cost four presses of Back to leave the page.
 */
export interface SettingsPageProps {
  sectionId: string
  tabId: string
  /** Writes both ids at once. The route owns the navigation. */
  onNavigate: (sectionId: string, tabId: string) => void
  /** Opens a row that is a page of its own (Discounts, Taxes, Cost tracking, Labels). */
  onOpenPage: (href: string) => void
}

/**
 * Icons, attached by id rather than declared in the table.
 *
 * `sections.ts` is imported by the URL codec and its test, and a table with
 * JSX in it would pull React into a test that parses strings.
 */
const SECTION_ICONS: Record<string, ReactNode> = {
  team: <UsersIcon aria-hidden className="size-4" />,
  discounts: <TicketPercentIcon aria-hidden className="size-4" />,
  taxes: <PercentIcon aria-hidden className="size-4" />,
  'cost-tracking': <CoinsIcon aria-hidden className="size-4" />,
  invoicing: <ReceiptTextIcon aria-hidden className="size-4" />,
  subscription: <RepeatIcon aria-hidden className="size-4" />,
  currency: <BadgeDollarSignIcon aria-hidden className="size-4" />,
  alerts: <BellIcon aria-hidden className="size-4" />,
  labels: <TagIcon aria-hidden className="size-4" />,
  'customer-experience': <SmileIcon aria-hidden className="size-4" />,
  'api-keys': <KeyRoundIcon aria-hidden className="size-4" />,
  'service-accounts': <BotIcon aria-hidden className="size-4" />,
}

/**
 * The sections as the shell wants them.
 *
 * Note what is **not** forwarded: `unavailable`. The shell has a built-in
 * unavailable state, and it is announced and correct for what it describes —
 * "It is not part of this account or environment." That sentence is about a
 * plan or a permission, and it is not true of the eight tabs here: those are
 * missing an API contract, not an entitlement. Forwarding the flag would put
 * a confident wrong explanation on screen, and the shell's copy is not a prop.
 *
 * So the flag stays in this app's own table and drives `SettingsUnavailable`,
 * which is built on the same `EmptyState` composition — the same `role="status"`
 * announcement, the same visual treatment — with copy that names the missing
 * route. The tab is still listed and still selectable, which is the behaviour
 * the flag was there to guarantee.
 */
function toShellSections(): SettingsSection[] {
  return [...RAIL_SECTIONS, ...SETTINGS_SECTIONS.filter((section) => 'hidden' in section)].map(
    (section) => ({
      id: section.id,
      label: section.label,
      ...('hidden' in section ? { hidden: true } : {}),
      ...(SECTION_ICONS[section.id] ? { icon: SECTION_ICONS[section.id] } : {}),
      tabs: section.tabs.map((tab) => ({ id: tab.id, label: tab.label })),
    }),
  )
}

export function SettingsPage({ sectionId, tabId, onNavigate, onOpenPage }: SettingsPageProps) {
  const section = findSettingsSection(sectionId) ?? SETTINGS_SECTIONS[0]
  const tab = findSettingsTab(section, tabId) ?? firstTabOf(section)

  return (
    <SettingsShell
      sections={toShellSections()}
      sectionId={section.id}
      tabId={tab.id}
      // Both ids, one navigation. See the note above.
      onSectionChange={(next) => {
        const linked = SETTINGS_SECTIONS.find(
          (candidate) => candidate.id === next && 'href' in candidate,
        )
        if (linked && 'href' in linked) {
          onOpenPage(linked.href)
          return
        }
        const target = findSettingsSection(next)
        if (!target) return
        onNavigate(target.id, firstTabOf(target).id)
      }}
      onTabChange={(next) => onNavigate(section.id, next)}
    >
      <SettingsPanel section={section} tabId={tab.id} />
    </SettingsShell>
  )
}

/**
 * One tab, one panel.
 *
 * Keyed by `<section>/<tab>` rather than by tab alone, so two sections can
 * have a tab with the same id without one silently rendering the other's
 * panel.
 */
function SettingsPanel({ section, tabId }: { section: SettingsSectionSpec; tabId: string }) {
  const key = `${section.id}/${tabId}`
  const tab = findSettingsTab(section, tabId)

  if (tab?.unavailable) {
    const copy = UNAVAILABLE_COPY[key]
    return (
      <SettingsUnavailable
        tab={tab}
        what={copy?.what ?? 'This setting has no API behind it yet.'}
        {...(copy?.workaround ? { workaround: copy.workaround } : {})}
      />
    )
  }

  switch (key) {
    case 'organization/profile':
      return <ProfilePanel />
    case 'organization/plan':
      return <PlanUsagePanel />
    case 'organization/environments':
      return <EnvironmentsPanel />
    case 'team/members':
      return <MembersPanel />
    case 'team/roles':
      return <RolesPanel />
    case 'invoicing/invoices':
      return <InvoicesPanel />
    case 'subscription/subscriptions':
      return <SubscriptionsPanel />
    case 'currency/currencies':
      return <CurrenciesPanel />
    case 'customer-experience/portal':
      return <PortalPanel />
    case 'customer-experience/onboarding':
      return <OnboardingPanel />
    case 'api-keys/api-keys':
      return <ApiKeysPanel />
    case 'service-accounts/service-accounts':
      return <ServiceAccountsPanel />
    case 'webhooks/webhooks':
      return <WebhooksPanel />
    case 'alerts/alert-rules':
      return <AlertRulesPanel />
    case 'alerts/wallet-alerts':
      return <WalletAlertsPanel />
    case 'appearance/theme':
      return <AppearancePanel />
    default:
      // Unreachable through the codec, which only ever yields a pair from the
      // table. Reachable by adding a tab and forgetting the panel, which is
      // exactly when a blank screen is least helpful.
      return (
        <SettingsUnavailable
          tab={tab ?? { id: tabId, label: 'This setting' }}
          what="This tab is declared in the settings table but has no panel wired to it."
        />
      )
  }
}

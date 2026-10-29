import { useSelfBillingStatus } from '@fp/query'
import type { ReactNode } from 'react'
import { RBAC_ENTITY, type RbacEntity } from '@fp/domain'
import { EmbeddedPageContext, WriteGate } from '@fp/ui/compositions'
import { SettingsShell, type SettingsSection } from '@fp/ui/pages'
import {
  BadgeDollarSignIcon,
  BellIcon,
  Building2Icon,
  CoinsIcon,
  GaugeIcon,
  PaletteIcon,
  PercentIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SmileIcon,
  TagIcon,
  TicketPercentIcon,
  UsersIcon,
} from '@fp/ui/icons'
import { AppearancePanel } from './AppearancePanel'
import { CurrenciesPanel } from './CurrenciesPanel'
import { FxRatesPanel } from '../forex/FxRatesPanel'
import { InvoicesPanel } from './InvoicesPanel'
import { OnboardingPanel } from './OnboardingPanel'
import { PortalPanel } from './PortalPanel'
import { MembersPanel } from './MembersPanel'
import { ProfilePanel } from './ProfilePanel'
import { SubscriptionsPanel } from './SubscriptionsPanel'
import { TaxEnginePanel } from './TaxEnginePanel'
import { TagsPanel } from './TagsPanel'
import { WalletAlertsPanel } from './WalletAlertsPanel'
import { BonusCreditsPanel } from './BonusCreditsPanel'
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
 * one panel that pair names. Every panel below fetches its own data: there is
 * no shared loader, because the panels have nothing in common to load and a
 * page-level spinner would make switching tabs feel slower than it is.
 *
 * ## The one rule the shell hands back
 *
 * `SettingsShell` is fully controlled and reports `onSectionChange` and
 * `onTabChange` separately. Changing section **does not change tab**: the
 * shell cannot know which tab a section should open on. So the section handler
 * here looks up the new section's first tab and writes *both* ids in a single
 * `navigate()`. Two navigations would mean two history entries and one
 * intermediate render at an impossible pair (`section=developers&tab=profile`),
 * which the codec would then correct: a visible flicker and a Back button
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
  /** Opens a row that is a page of its own (Discounts, Taxes, Cost tracking), or a tag's detail page. */
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
  organization: <Building2Icon aria-hidden className="size-4" />,
  discounts: <TicketPercentIcon aria-hidden className="size-4" />,
  taxes: <PercentIcon aria-hidden className="size-4" />,
  'cost-tracking': <CoinsIcon aria-hidden className="size-4" />,
  'usage-billing': <GaugeIcon aria-hidden className="size-4" />,
  invoicing: <ReceiptTextIcon aria-hidden className="size-4" />,
  subscription: <RepeatIcon aria-hidden className="size-4" />,
  currency: <BadgeDollarSignIcon aria-hidden className="size-4" />,
  alerts: <BellIcon aria-hidden className="size-4" />,
  tags: <TagIcon aria-hidden className="size-4" />,
  'customer-experience': <SmileIcon aria-hidden className="size-4" />,
  appearance: <PaletteIcon aria-hidden className="size-4" />,
}

/**
 * The sections as the shell wants them.
 *
 * Note what is **not** forwarded: `unavailable`. The shell has a built-in
 * unavailable state, and it is announced and correct for what it describes:
 * "It is not part of this account or environment." That sentence is about a
 * plan or a permission, and it is not true of the eight tabs here: those are
 * missing an API contract, not an entitlement. Forwarding the flag would put
 * a confident wrong explanation on screen, and the shell's copy is not a prop.
 *
 * So the flag stays in this app's own table and drives `SettingsUnavailable`,
 * which is built on the same `EmptyState` composition: the same `role="status"`
 * announcement, the same visual treatment: with copy that names the missing
 * route. The tab is still listed and still selectable, which is the behaviour
 * the flag was there to guarantee.
 */
export function toShellSections({
  hide = [],
}: { hide?: readonly string[] } = {}): SettingsSection[] {
  return [...RAIL_SECTIONS, ...SETTINGS_SECTIONS.filter((section) => 'hidden' in section)].map(
    (section) => ({
      id: section.id,
      label: section.label,
      ...('hidden' in section || hide.includes(section.id) ? { hidden: true } : {}),
      ...(SECTION_ICONS[section.id] ? { icon: SECTION_ICONS[section.id] } : {}),
      tabs: section.tabs.map((tab) => ({ id: tab.id, label: tab.label })),
    }),
  )
}

/**
 * The rail as this workspace sees it: Usage & billing only where the
 * deployment bills its workspaces (self-billing on). The status is the one the
 * shell already read for the session.
 */
function useShellSections(): SettingsSection[] {
  const selfBilling = useSelfBillingStatus()
  return toShellSections(selfBilling.data?.enabled ? {} : { hide: ['usage-billing'] })
}

/**
 * The Settings frame around a row that is a page of its own (Discounts,
 * Taxes, Cost tracking): the rail stays, the page renders in the content column
 * and drops its own gutters.
 */
export function SettingsFrame({
  sectionId,
  onNavigate,
  onOpenPage,
  children,
}: {
  sectionId: string
  onNavigate: (sectionId: string, tabId: string) => void
  onOpenPage: (href: string) => void
  children: ReactNode
}) {
  const sections = useShellSections()
  return (
    <SettingsShell
      sections={sections}
      sectionId={sectionId}
      tabId=""
      onSectionChange={(next) => openSection(next, onNavigate, onOpenPage)}
      onTabChange={() => undefined}
    >
      <EmbeddedPageContext.Provider value>{children}</EmbeddedPageContext.Provider>
    </SettingsShell>
  )
}

function openSection(
  next: string,
  onNavigate: (sectionId: string, tabId: string) => void,
  onOpenPage: (href: string) => void,
) {
  const linked = SETTINGS_SECTIONS.find((candidate) => candidate.id === next && 'href' in candidate)
  if (linked && 'href' in linked) {
    onOpenPage(linked.href)
    return
  }
  const target = findSettingsSection(next)
  if (!target) return
  onNavigate(target.id, firstTabOf(target).id)
}

export function SettingsPage({ sectionId, tabId, onNavigate, onOpenPage }: SettingsPageProps) {
  const section = findSettingsSection(sectionId) ?? SETTINGS_SECTIONS[0]
  const tab = findSettingsTab(section, tabId) ?? firstTabOf(section)
  const sections = useShellSections()

  return (
    <SettingsShell
      sections={sections}
      sectionId={section.id}
      tabId={tab.id}
      onSectionChange={(next) => openSection(next, onNavigate, onOpenPage)}
      onTabChange={(next) => onNavigate(section.id, next)}
    >
      <SettingsPanel section={section} tabId={tab.id} onOpenPage={onOpenPage} />
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
function SettingsPanel({
  section,
  tabId,
  onOpenPage,
}: {
  section: SettingsSectionSpec
  tabId: string
  onOpenPage: (href: string) => void
}) {
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

  /*
   * Who may change each panel, as V1's settings tabs: tenant-wide settings
   * need write on the entity *and* super admin; the organisation profile needs
   * tenant write. Anyone signed in can read them. The panel stays visible and
   * its controls are disabled, with the reason above.
   */
  const gated = (entity: RbacEntity, panel: ReactNode, superAdmin = true) => (
    <WriteGate block entity={entity} superAdmin={superAdmin}>
      {panel}
    </WriteGate>
  )

  switch (key) {
    case 'organization/profile':
      return gated(RBAC_ENTITY.Tenant, <ProfilePanel />, false)
    case 'team/members':
      // Gated row by row: invite needs user write, roles and removal super admin.
      return <MembersPanel />
    case 'invoicing/invoices':
      return gated(RBAC_ENTITY.Setting, <InvoicesPanel />)
    case 'invoicing/tax':
      return gated(RBAC_ENTITY.Setting, <TaxEnginePanel />)
    case 'subscription/subscriptions':
      return gated(RBAC_ENTITY.Setting, <SubscriptionsPanel />)
    case 'currency/currencies':
      return gated(RBAC_ENTITY.Setting, <CurrenciesPanel />)
    case 'currency/forex':
      // Gated by its own entity (FX rates), as V1, not by tenant settings.
      return <FxRatesPanel owner={{ scope: 'tenant' }} />
    case 'customer-experience/portal':
      return gated(RBAC_ENTITY.Portal, <PortalPanel />)
    case 'customer-experience/onboarding':
      return gated(RBAC_ENTITY.Setting, <OnboardingPanel />)
    case 'tags/tags':
      return gated(RBAC_ENTITY.Setting, <TagsPanel onOpenPage={onOpenPage} />, false)
    case 'alerts/wallet-alerts':
      return gated(RBAC_ENTITY.AlertSettings, <WalletAlertsPanel />)
    case 'alerts/bonus-credits':
      return gated(RBAC_ENTITY.Setting, <BonusCreditsPanel />)
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

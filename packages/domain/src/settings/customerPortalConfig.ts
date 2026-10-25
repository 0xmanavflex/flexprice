/**
 * What a customer sees in their own portal.
 *
 * `GET/PUT /settings/customer_portal_config`.
 *
 * ## Why this is not five booleans
 *
 * V1's portal screen renders five switches: show usage, show credits, show
 * invoices, and so on: because five switches is what its form needed. The
 * setting is not five switches. It is an **ordered tree**: sections, each with
 * a label and a position, each holding ordered tabs, each tab typed, and two
 * tab types carrying a payload of their own (which metric cards to show; which
 * date presets the usage graph offers).
 *
 * Arrays are replaced wholesale by the write: the backend merges the top
 * level of the value and nothing below it. So a screen that reads the tree,
 * projects it down to five booleans and PUTs the booleans back does not
 * "ignore" the rest of the tree, it **deletes** it: every label, every
 * ordering, every graph preset a portal was configured with, gone on the next
 * save with nothing in the UI to say so. That is the bug this model exists to
 * prevent, and it is why the shape here is the API's shape.
 *
 * ## Why there is no passthrough for unknown fields
 *
 * The tempting defence: keep unrecognised keys and write them back: does not
 * work here and would be worse than not trying. The write path converts the
 * merged value into the backend's Go struct before saving
 * (`internal/ee/service/settings.go`), so **any field the struct does not
 * declare is dropped by the server**, whatever the client sends. V1 carries a
 * per-tab `label` and a `usage_graph.feature_ids` list that the server has
 * silently discarded all along. A passthrough field here would preserve them
 * in the console's memory and lose them anyway, which is a lie with extra
 * steps. This model is exactly the struct; what it cannot hold, the API cannot
 * store.
 */
import { z } from 'zod'

/**
 * The tab types the portal understands.
 *
 * The backend types `tab.type` as an unconstrained string, so this list is
 * V1's and is for labelling and for an "add a tab" menu: not for validation.
 * `PortalTab.type` stays a `string` accordingly: an unrecognised type is a
 * portal configured by something newer, and it must survive being read,
 * rendered as best we can, and written back.
 */
export const PortalTabType = {
  Subscriptions: 'subscriptions',
  CurrentUsage: 'current_usage',
  UsageGraph: 'usage_graph',
  UsageBreakdown: 'usage_breakdown',
  Invoices: 'invoices',
  AccountSummary: 'account_summary',
  WalletBalance: 'wallet_balance',
  WalletTransactions: 'wallet_transactions',
  WalletTopup: 'wallet_topup',
  AutoTopup: 'auto_topup',
  PaymentMethods: 'payment_methods',
  MetricCards: 'metric_cards',
} as const
export type PortalTabType = (typeof PortalTabType)[keyof typeof PortalTabType]

export const PORTAL_TAB_TYPE_LABEL: Record<string, string> = {
  [PortalTabType.Subscriptions]: 'Subscriptions',
  [PortalTabType.CurrentUsage]: 'Current usage',
  [PortalTabType.UsageGraph]: 'Usage graph',
  [PortalTabType.UsageBreakdown]: 'Usage breakdown',
  [PortalTabType.Invoices]: 'Invoices',
  [PortalTabType.AccountSummary]: 'Account summary',
  [PortalTabType.WalletBalance]: 'Wallet balance',
  [PortalTabType.WalletTransactions]: 'Wallet transactions',
  [PortalTabType.WalletTopup]: 'Top up',
  [PortalTabType.AutoTopup]: 'Auto top-up',
  [PortalTabType.PaymentMethods]: 'Payment methods',
  [PortalTabType.MetricCards]: 'Metric cards',
}

/** A human label for any tab type, including one this build has never seen. */
export function portalTabLabel(type: string): string {
  return PORTAL_TAB_TYPE_LABEL[type] ?? type.replaceAll('_', ' ')
}

/** The `metric_cards` tab's payload: which of the three cards are shown. */
export const portalMetricCardsSchema = z.object({
  showCostMetrics: z.boolean(),
  showCustomMetrics: z.boolean(),
  showRevenueMetric: z.boolean(),
})
export type PortalMetricCards = z.infer<typeof portalMetricCardsSchema>

/**
 * The `usage_graph` tab's payload.
 *
 * `datePresets` and `featureFilterMode` stay strings. They are the API's own
 * vocabulary (`last_7_days`, `current_month`), the preset list is exactly the
 * kind of thing a backend adds to, and the live default already stores a
 * `featureFilterMode` of `"inc"` that matches none of V1's three declared
 * values. Narrowing them would turn a working portal into a parse error.
 */
export const portalUsageGraphSchema = z.object({
  allowCustomDateRange: z.boolean(),
  datePresets: z.array(z.string()),
  defaultPreset: z.string(),
  featureFilterMode: z.string(),
})
export type PortalUsageGraph = z.infer<typeof portalUsageGraphSchema>

/**
 * One tab.
 *
 * `id` is the API's own string id: a stringified integer (`"1"`, `"11"`),
 * unique only within its section. Sorting on it would be lexicographic
 * nonsense (`"10"` before `"2"`), which is what `order` is for.
 */
export const portalTabSchema = z.object({
  id: z.string(),
  type: z.string(),
  order: z.number().int(),
  enabled: z.boolean(),
  /** Set only on a `metric_cards` tab; null on every other type. */
  metricCards: portalMetricCardsSchema.nullable(),
  /** Set only on a `usage_graph` tab; null on every other type. */
  usageGraph: portalUsageGraphSchema.nullable(),
})
export type PortalTab = z.infer<typeof portalTabSchema>

/** One section of the portal's navigation, holding ordered tabs. */
export const portalSectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number().int(),
  enabled: z.boolean(),
  tabs: z.array(portalTabSchema),
})
export type PortalSection = z.infer<typeof portalSectionSchema>

/**
 * The portal's colours.
 *
 * Three, and only three: the backend struct has `primary_color`,
 * `secondary_color` and `tertiary_color`. V1's theme editor also offers a
 * background, a surface, a border, a logo and a font, none of which the server
 * has ever stored. Empty strings are the norm; the live default is `{}`.
 */
export const portalThemeSchema = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  tertiaryColor: z.string(),
})
export type PortalTheme = z.infer<typeof portalThemeSchema>

export const customerPortalConfigSchema = z.object({
  /** The config format's own version, e.g. `1.0`. Echoed back, never edited. */
  version: z.string(),
  theme: portalThemeSchema,
  sections: z.array(portalSectionSchema),
})
export type CustomerPortalConfig = z.infer<typeof customerPortalConfigSchema>

/**
 * Sections in the order the portal renders them.
 *
 * The API does not promise the array is sorted: the live value happens to
 * come back with `order` 1..4 in array order, which is exactly the kind of
 * accident a screen should not depend on. Ties keep their array position:
 * `Array.prototype.sort` is stable, and an arbitrary reshuffle of two
 * equally-ordered sections is worse than either order.
 */
export function orderedSections(config: CustomerPortalConfig): PortalSection[] {
  return [...config.sections].sort((a, b) => a.order - b.order)
}

/** A section's tabs in render order. */
export function orderedTabs(section: PortalSection): PortalTab[] {
  return [...section.tabs].sort((a, b) => a.order - b.order)
}

/**
 * The tab types a customer can actually reach.
 *
 * A tab is visible only if its section is too, which is what makes "every tab
 * is switched on but the section is off" render as nothing. Useful for the
 * summary line a settings screen shows above the tree.
 */
export function visibleTabTypes(config: CustomerPortalConfig): string[] {
  return orderedSections(config)
    .filter((section) => section.enabled)
    .flatMap((section) => orderedTabs(section).filter((tab) => tab.enabled))
    .map((tab) => tab.type)
}

/**
 * Edits, as whole-config replacements.
 *
 * Each returns a new config with one thing changed and everything else: every
 * sibling tab, every ordering, the theme: carried through untouched. That is
 * the only safe way to edit a value that is written whole: a panel that builds
 * a fresh object out of its form fields is the five-booleans bug wearing
 * different clothes.
 */
export function withSectionEnabled(
  config: CustomerPortalConfig,
  sectionId: string,
  enabled: boolean,
): CustomerPortalConfig {
  return {
    ...config,
    sections: config.sections.map((section) =>
      section.id === sectionId ? { ...section, enabled } : section,
    ),
  }
}

export function withTabEnabled(
  config: CustomerPortalConfig,
  sectionId: string,
  tabId: string,
  enabled: boolean,
): CustomerPortalConfig {
  return mapTab(config, sectionId, tabId, (tab) => ({ ...tab, enabled }))
}

/**
 * Changes which metric cards a `metric_cards` tab shows.
 *
 * A patch rather than a replacement, so a panel with one switch on screen does
 * not have to restate the other two. A tab carrying no `metricCards` block is
 * left alone: adding one to, say, an invoices tab would invent a payload the
 * backend never sent and would drop it on save anyway.
 */
export function withMetricCards(
  config: CustomerPortalConfig,
  sectionId: string,
  tabId: string,
  patch: Partial<PortalMetricCards>,
): CustomerPortalConfig {
  return mapTab(config, sectionId, tabId, (tab) =>
    tab.metricCards ? { ...tab, metricCards: { ...tab.metricCards, ...patch } } : tab,
  )
}

/** Same, for the `usage_graph` tab's payload. */
export function withUsageGraph(
  config: CustomerPortalConfig,
  sectionId: string,
  tabId: string,
  patch: Partial<PortalUsageGraph>,
): CustomerPortalConfig {
  return mapTab(config, sectionId, tabId, (tab) =>
    tab.usageGraph ? { ...tab, usageGraph: { ...tab.usageGraph, ...patch } } : tab,
  )
}

/** Renumbers a section's tabs into the given id order, 1-based. */
export function withTabOrder(
  config: CustomerPortalConfig,
  sectionId: string,
  tabIds: readonly string[],
): CustomerPortalConfig {
  return {
    ...config,
    sections: config.sections.map((section) => {
      if (section.id !== sectionId) return section
      return {
        ...section,
        tabs: section.tabs.map((tab) => {
          const at = tabIds.indexOf(tab.id)
          // A tab the caller did not mention keeps the order it had, rather
          // than being pushed to the front by an index of -1.
          return at === -1 ? tab : { ...tab, order: at + 1 }
        }),
      }
    }),
  }
}

/** Renumbers the sections into the given id order, 1-based. */
export function withSectionOrder(
  config: CustomerPortalConfig,
  sectionIds: readonly string[],
): CustomerPortalConfig {
  return {
    ...config,
    sections: config.sections.map((section) => {
      const at = sectionIds.indexOf(section.id)
      return at === -1 ? section : { ...section, order: at + 1 }
    }),
  }
}

function mapTab(
  config: CustomerPortalConfig,
  sectionId: string,
  tabId: string,
  change: (tab: PortalTab) => PortalTab,
): CustomerPortalConfig {
  return {
    ...config,
    sections: config.sections.map((section) =>
      section.id === sectionId
        ? { ...section, tabs: section.tabs.map((tab) => (tab.id === tabId ? change(tab) : tab)) }
        : section,
    ),
  }
}

/**
 * An empty portal config.
 *
 * Not the backend's defaults. The default tree is four sections and ten tabs,
 * and reproducing it here would be a second source of truth that drifts the
 * first time the backend adds a tab: the exact trap V1 fell into, where a
 * client-side default tree is deep-merged over the server's and quietly
 * reorders it. This is what a screen renders before the first fetch resolves.
 */
export function emptyCustomerPortalConfig(): CustomerPortalConfig {
  return {
    version: '',
    theme: { primaryColor: '', secondaryColor: '', tertiaryColor: '' },
    sections: [],
  }
}

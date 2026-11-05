import { describe, expect, it } from 'vitest'
import {
  type CustomerPortalConfig,
  customerPortalConfigSchema,
  orderedSections,
  orderedTabs,
  portalTabLabel,
  visibleTabTypes,
  withMetricCards,
  withSectionEnabled,
  withSectionOrder,
  withTabEnabled,
  withTabOrder,
  withUsageGraph,
  withTabTypeEnabled,
  withUsageProperties,
} from './customerPortalConfig'

/** A cut-down copy of the live default tree, with the parts that matter. */
function config(): CustomerPortalConfig {
  return {
    version: '1.0',
    theme: { primaryColor: '#111', secondaryColor: '', tertiaryColor: '' },
    sections: [
      {
        id: 'credits',
        label: 'Credits',
        order: 2,
        enabled: true,
        tabs: [
          {
            id: '6',
            type: 'wallet_balance',
            order: 1,
            enabled: true,
            metricCards: null,
            usageGraph: null,
          },
        ],
      },
      {
        id: 'usage',
        label: 'Usage',
        order: 1,
        enabled: true,
        tabs: [
          {
            id: '2',
            type: 'usage_graph',
            order: 2,
            enabled: true,
            metricCards: null,
            usageGraph: {
              allowCustomDateRange: true,
              datePresets: ['today', 'last_7_days'],
              defaultPreset: 'last_7_days',
              featureFilterMode: 'inc',
            },
          },
          {
            id: '1',
            type: 'metric_cards',
            order: 1,
            enabled: true,
            metricCards: {
              showCostMetrics: false,
              showCustomMetrics: true,
              showRevenueMetric: true,
            },
            usageGraph: null,
          },
          {
            id: '10',
            type: 'invoices',
            order: 3,
            enabled: false,
            metricCards: null,
            usageGraph: null,
          },
        ],
      },
    ],
    usageProperties: null,
  }
}

describe('ordering', () => {
  it('sorts sections by order, not by the array the API happened to send', () => {
    expect(orderedSections(config()).map((section) => section.id)).toEqual(['usage', 'credits'])
  })

  /**
   * Tab ids are stringified integers, unique only within a section. Sorting on
   * them would put "10" before "2", which is why `order` exists.
   */
  it('sorts tabs numerically by order, not lexicographically by id', () => {
    const usage = orderedSections(config())[0]
    expect(orderedTabs(usage!).map((tab) => tab.id)).toEqual(['1', '2', '10'])
  })

  it('lists only the tabs a customer can reach', () => {
    expect(visibleTabTypes(config())).toEqual(['metric_cards', 'usage_graph', 'wallet_balance'])
  })

  it('hides a whole section’s tabs when the section is off', () => {
    const hidden = withSectionEnabled(config(), 'usage', false)
    expect(visibleTabTypes(hidden)).toEqual(['wallet_balance'])
  })
})

describe('edits', () => {
  /**
   * The point of the whole model. V1 projects this tree down to five booleans
   * and PUTs the booleans back, which deletes every label, ordering and graph
   * preset the portal was configured with. Every helper here has to leave the
   * parts it was not asked about exactly as they were.
   */
  it('changes one tab and leaves the rest of the tree byte-identical', () => {
    const before = config()
    const after = withTabEnabled(before, 'usage', '10', true)

    expect(
      after.sections.find((s) => s.id === 'usage')?.tabs.find((t) => t.id === '10')?.enabled,
    ).toBe(true)
    // Everything else, including the section this tab does not live in.
    expect({ ...after, sections: [] }).toEqual({ ...before, sections: [] })
    expect(after.sections.find((s) => s.id === 'credits')).toEqual(
      before.sections.find((s) => s.id === 'credits'),
    )
    expect(after.sections.find((s) => s.id === 'usage')?.tabs.find((t) => t.id === '2')).toEqual(
      before.sections.find((s) => s.id === 'usage')?.tabs.find((t) => t.id === '2'),
    )
  })

  it('does not mutate the config it was given', () => {
    const before = config()
    withSectionEnabled(before, 'usage', false)
    expect(before.sections.find((s) => s.id === 'usage')?.enabled).toBe(true)
  })

  it('patches one metric card without restating the other two', () => {
    const after = withMetricCards(config(), 'usage', '1', { showCostMetrics: true })

    expect(
      after.sections.find((s) => s.id === 'usage')?.tabs.find((t) => t.id === '1')?.metricCards,
    ).toEqual({ showCostMetrics: true, showCustomMetrics: true, showRevenueMetric: true })
  })

  /**
   * A tab of another type has no metric-cards payload, and giving it one
   * would invent a block the backend never sent and would discard anyway.
   */
  it('leaves a tab that carries no metric cards alone', () => {
    const before = config()
    const after = withMetricCards(before, 'credits', '6', { showCostMetrics: true })

    expect(after).toEqual(before)
  })

  it('patches a usage graph’s presets', () => {
    const after = withUsageGraph(config(), 'usage', '2', { defaultPreset: 'today' })
    const graph = after.sections
      .find((s) => s.id === 'usage')
      ?.tabs.find((t) => t.id === '2')?.usageGraph

    expect(graph).toMatchObject({ defaultPreset: 'today', datePresets: ['today', 'last_7_days'] })
  })

  it('renumbers tabs into the order given, one-based', () => {
    const after = withTabOrder(config(), 'usage', ['10', '2', '1'])
    const usage = after.sections.find((s) => s.id === 'usage')

    expect(orderedTabs(usage!).map((tab) => tab.id)).toEqual(['10', '2', '1'])
  })

  it('leaves a tab the caller did not mention where it was', () => {
    const after = withTabOrder(config(), 'usage', ['10'])
    const tab = after.sections.find((s) => s.id === 'usage')?.tabs.find((t) => t.id === '2')

    // Not pushed to the front by an index of -1.
    expect(tab?.order).toBe(2)
  })

  it('renumbers sections into the order given', () => {
    const after = withSectionOrder(config(), ['credits', 'usage'])
    expect(orderedSections(after).map((section) => section.id)).toEqual(['credits', 'usage'])
  })
})

describe('portalTabLabel', () => {
  it('names the types it knows', () => {
    expect(portalTabLabel('wallet_transactions')).toBe('Wallet transactions')
  })

  it('makes something readable of a type from a newer deployment', () => {
    expect(portalTabLabel('payment_schedule')).toBe('payment schedule')
  })
})

describe('withTabTypeEnabled', () => {
  it('switches an existing tab of that type', () => {
    const next = withTabTypeEnabled(config(), 'credits', 'wallet_balance', false)
    expect(next.sections[0]?.tabs[0]?.enabled).toBe(false)
    expect(next.sections[0]?.tabs).toHaveLength(1)
  })

  it('adds the tab, switched as asked, with an id no section uses', () => {
    const next = withTabTypeEnabled(config(), 'credits', 'auto_topup', false)
    const added = next.sections[0]?.tabs.at(-1)
    const ids = config().sections.flatMap((s) => s.tabs.map((t) => t.id))
    expect(added).toMatchObject({ type: 'auto_topup', enabled: false, order: 2 })
    expect(ids).not.toContain(added?.id)
    // Everything else rides through.
    expect(next.sections[1]).toEqual(config().sections[1])
  })
})

describe('withUsageProperties', () => {
  it('starts from off with no keys when nothing is stored', () => {
    expect(withUsageProperties(config(), { enabled: true }).usageProperties).toEqual({
      enabled: true,
      allowedKeys: [],
      hiddenKeys: [],
    })
  })

  it('patches what is stored', () => {
    const on = withUsageProperties(config(), { enabled: true, hiddenKeys: ['secret'] })
    expect(withUsageProperties(on, { allowedKeys: ['region'] }).usageProperties).toEqual({
      enabled: true,
      allowedKeys: ['region'],
      hiddenKeys: ['secret'],
    })
  })
})

describe('theme colours', () => {
  const withSecondary = (secondaryColor: string) => ({
    ...config(),
    theme: { ...config().theme, secondaryColor },
  })

  it.each(['', '#0f172a', '#0F172A', '#abc', '#ABC'])('accepts %j', (colour) => {
    expect(customerPortalConfigSchema.safeParse(withSecondary(colour)).success).toBe(true)
  })

  it.each(['invalid', '0f172a', '#0f17', '#0f172a0', 'red', '#ggg', ' #abc'])(
    'refuses %j, on the field, with a hex example',
    (colour) => {
      const result = customerPortalConfigSchema.safeParse(withSecondary(colour))
      expect(result.success).toBe(false)
      expect(result.error?.issues).toEqual([
        expect.objectContaining({
          path: ['theme', 'secondaryColor'],
          message: 'Enter a hex code such as #0f172a, or leave it blank.',
        }),
      ])
    },
  )
})

import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Bell, Building2, CreditCard, KeyRound, Plug, Receipt, Users, Webhook } from '@ui/icons'
import { SettingsShell, type SettingsSection, type SettingsShellProps } from './SettingsShell'

const SECTIONS: SettingsSection[] = [
  {
    id: 'organization',
    label: 'Organization',
    icon: <Building2 aria-hidden />,
    tabs: [
      { id: 'profile', label: 'Profile' },
      { id: 'branding', label: 'Branding' },
      { id: 'regions', label: 'Regions' },
    ],
  },
  {
    id: 'members',
    label: 'Members',
    icon: <Users aria-hidden />,
    tabs: [
      { id: 'people', label: 'People' },
      { id: 'invitations', label: 'Invitations' },
      { id: 'roles', label: 'Roles' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: <CreditCard aria-hidden />,
    tabs: [
      { id: 'plan', label: 'Plan' },
      { id: 'payment-methods', label: 'Payment methods' },
      { id: 'invoices', label: 'Invoices' },
      { id: 'tax', label: 'Tax details' },
      { id: 'usage', label: 'Usage and limits' },
    ],
  },
  {
    id: 'api-keys',
    label: 'API keys',
    icon: <KeyRound aria-hidden />,
    tabs: [
      { id: 'secret', label: 'Secret keys' },
      { id: 'publishable', label: 'Publishable keys' },
    ],
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: <Webhook aria-hidden />,
    tabs: [
      { id: 'endpoints', label: 'Endpoints' },
      { id: 'deliveries', label: 'Deliveries' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell aria-hidden />,
    tabs: [
      { id: 'channels', label: 'Channels' },
      { id: 'digests', label: 'Digests' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: <Plug aria-hidden />,
    // Nothing in this section is available: and it is still in the rail, still
    // selectable, and says why. Hiding it would look like the feature moved.
    tabs: [
      { id: 'connected', label: 'Connected apps', unavailable: true },
      { id: 'marketplace', label: 'Marketplace', unavailable: true },
    ],
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    icon: <Receipt aria-hidden />,
    tabs: [
      { id: 'templates', label: 'Templates' },
      { id: 'numbering', label: 'Numbering' },
      { id: 'dunning', label: 'Dunning', unavailable: true },
    ],
  },
  {
    id: 'audit',
    label: 'Audit log',
    icon: <Receipt aria-hidden />,
    tabs: [{ id: 'events', label: 'Events' }],
  },
]

function Body({ label }: { label: string }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-muted-foreground mt-1 text-sm">
        The page renders the active tab&apos;s content here. The shell does not choose it.
      </p>
    </div>
  )
}

/**
 * What a page does with this component.
 *
 * The shell reports a section change and nothing else, so the page is what
 * picks the tab the new section opens on: here, its first. On a real screen
 * that is one `navigate()` writing both ids into a single history entry.
 */
function Controlled({
  sections,
  sectionId,
  tabId,
  onSectionChange,
  onTabChange,
}: SettingsShellProps) {
  const [section, setSection] = useState(sectionId)
  const [tab, setTab] = useState(tabId)

  useEffect(() => {
    setSection(sectionId)
    setTab(tabId)
  }, [sectionId, tabId])

  const active = sections.find((entry) => entry.id === section)
  const activeTab = active?.tabs.find((entry) => entry.id === tab)

  return (
    <SettingsShell
      sections={sections}
      sectionId={section}
      tabId={tab}
      onSectionChange={(next) => {
        setSection(next)
        const first = sections.find((entry) => entry.id === next)?.tabs[0]
        if (first) setTab(first.id)
        onSectionChange(next)
      }}
      onTabChange={(next) => {
        setTab(next)
        onTabChange(next)
      }}
    >
      <Body label={`${active?.label ?? section} / ${activeTab?.label ?? tab}`} />
    </SettingsShell>
  )
}

const tabIds = [...new Set(SECTIONS.flatMap((section) => section.tabs.map((tab) => tab.id)))]

interface PlaygroundArgs {
  sectionCount: number
  sectionId: string
  tabId: string
  unavailableSection: string
  longLabels: boolean
  hideLastSection: boolean
  onSectionChange: (sectionId: string) => void
  onTabChange: (tabId: string) => void
}

/** Wraps the controlled shell with a section list shaped by the playground flags. */
function PlaygroundShell({
  sectionCount,
  sectionId,
  tabId,
  unavailableSection,
  longLabels,
  hideLastSection,
  onSectionChange,
  onTabChange,
}: PlaygroundArgs) {
  const sections = SECTIONS.slice(0, sectionCount).map((section, index, all) => ({
    ...section,
    label: longLabels ? `${section.label} and every setting that belongs to it` : section.label,
    hidden: hideLastSection && index === all.length - 1,
    tabs: section.tabs.map((tab) => ({
      ...tab,
      label: longLabels ? `${tab.label} configuration and related options` : tab.label,
      ...(section.id === unavailableSection ? { unavailable: true } : {}),
    })),
  }))
  const section = sections.find((entry) => entry.id === sectionId) ?? sections[0]
  const tab = section?.tabs.find((entry) => entry.id === tabId) ?? section?.tabs[0]

  return (
    <Controlled
      sections={sections}
      sectionId={section?.id ?? sectionId}
      tabId={tab?.id ?? tabId}
      onSectionChange={onSectionChange}
      onTabChange={onTabChange}
    >
      {null}
    </Controlled>
  )
}

/**
 * Settings navigation, laid out as the `settings-7` block: an sr-only heading, a flat
 * vertical rail of sections, then a column holding the active section's tab
 * strip (when it has several pages) and content.
 *
 * Fully controlled. The stories own both ids the way a page owns them, because
 * on a real screen they live in the URL.
 */
const meta = {
  title: 'App/Settings/Settings/Settings shell',
  component: SettingsShell,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        phone: { name: 'Phone 390', styles: { width: '390px', height: '844px' } },
        tablet: { name: 'Tablet 768', styles: { width: '768px', height: '1024px' } },
      },
    },
  },
  args: {
    sections: SECTIONS,
    sectionId: 'organization',
    tabId: 'profile',
    onSectionChange: fn(),
    onTabChange: fn(),
    children: null,
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof SettingsShell>

export default meta
type Story = StoryObj<typeof meta>

/** Shrink the section list, jump to any section or tab, mark a whole section unavailable, or stress the layout with long labels. */
export const Playground = {
  args: {
    sectionCount: SECTIONS.length,
    sectionId: 'organization',
    tabId: 'profile',
    unavailableSection: 'none',
    longLabels: false,
    hideLastSection: false,
    onSectionChange: fn(),
    onTabChange: fn(),
  },
  argTypes: {
    sectionCount: { control: { type: 'range', min: 1, max: SECTIONS.length, step: 1 } },
    sectionId: { control: 'select', options: SECTIONS.map((section) => section.id) },
    tabId: { control: 'select', options: tabIds },
    unavailableSection: {
      control: 'select',
      options: ['none', ...SECTIONS.map((section) => section.id)],
    },
    longLabels: { control: 'boolean' },
    hideLastSection: { control: 'boolean', description: 'Reachable but not a row in the rail.' },
    onSectionChange: { control: false },
    onTabChange: { control: false },
  },
  parameters: {
    controls: {
      include: [
        'sectionCount',
        'sectionId',
        'tabId',
        'unavailableSection',
        'longLabels',
        'hideLastSection',
        'onSectionChange',
        'onTabChange',
      ],
    },
  },
  render: (args) => <PlaygroundShell {...args} />,
} satisfies StoryObj<PlaygroundArgs>

/** The rail is flat; the open section's pages are a tab strip above its content. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('navigation', { name: 'Settings' })

    await expect(within(nav).getByRole('button', { name: 'Organization' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(within(nav).queryByRole('list', { name: 'Organization pages' })).toBeNull()
    await expect(canvas.getByRole('tab', { name: 'Profile' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await userEvent.click(canvas.getByRole('tab', { name: 'Branding' }))
    await expect(args.onTabChange).toHaveBeenCalledWith('branding')

    // The shell does not pick a tab for the new section; the page does.
    await userEvent.click(within(nav).getByRole('button', { name: 'Members' }))
    await expect(args.onSectionChange).toHaveBeenCalledWith('members')
    await expect(canvas.getByRole('tab', { name: 'People' })).toBeInTheDocument()
  },
}

/** A section with one page has no tab strip. */
export const SinglePage: Story = {
  args: { sectionId: 'audit', tabId: 'events' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('tablist')).toBeNull()
  },
}

/** Every control is a real button: focus reaches it and Enter commits. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('navigation', { name: 'Settings' })

    const members = within(nav).getByRole('button', { name: 'Members' })
    members.focus()
    await expect(members).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onSectionChange).toHaveBeenCalledWith('members')
  },
}

/**
 * A section where every tab is unavailable.
 *
 * It stays in the strip and stays selectable: the alternative is a section
 * that silently disappears, which reads as "the feature was removed" rather
 * than "not on this account". The panel says which it is, through `EmptyState`.
 */
export const SectionEntirelyUnavailable: Story = {
  args: { sectionId: 'integrations', tabId: 'connected' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('navigation', { name: 'Settings' })

    const integrations = within(nav).getByRole('button', { name: 'Integrations' })
    await expect(integrations).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByText('Integrations is unavailable')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('tab', { name: 'Marketplace' }))
    await expect(canvas.getByText('Integrations is unavailable')).toBeInTheDocument()
  },
}

/** One unavailable tab inside a section that otherwise works. */
export const SingleTabUnavailable: Story = {
  args: { sectionId: 'invoicing', tabId: 'templates' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText(/Invoicing \/ Templates/)).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('tab', { name: 'Dunning' }))
    await expect(canvas.getByText('Dunning is unavailable')).toBeInTheDocument()
  },
}

const LONG_SECTIONS: SettingsSection[] = [
  {
    id: 'long',
    label: 'Organization profile and legal entity details',
    icon: <Building2 aria-hidden />,
    tabs: [
      { id: 'a', label: 'Registered legal entity and trading address' },
      { id: 'b', label: 'Statutory filings, incorporation and governance' },
      { id: 'c', label: 'Beneficial ownership disclosure' },
    ],
  },
  {
    id: 'other',
    label: 'Consolidated revenue recognition configuration',
    icon: <Receipt aria-hidden />,
    tabs: [{ id: 'd', label: 'Deferred revenue schedules and waterfall reporting' }],
  },
]

/**
 * Labels nobody sized for. Labels truncate inside the rail: the failure being
 * avoided is the page itself growing a horizontal scrollbar.
 */
export const LongLabels: Story = {
  args: { sections: LONG_SECTIONS, sectionId: 'long', tabId: 'a' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('tab', { name: 'Registered legal entity and trading address' }),
    ).toBeInTheDocument()

    const root = canvasElement.ownerDocument.documentElement
    await expect(root.scrollWidth).toBe(root.clientWidth)
  },
}

/** 390, the narrowest width this console is audited at. */
export const PhoneWidth: Story = {
  args: { sectionId: 'billing', tabId: 'plan' },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const root = canvasElement.ownerDocument.documentElement

    // Asserted, because every claim below is worthless if the viewport global
    // silently stopped being applied.
    await expect(root.clientWidth).toBe(390)
    await expect(root.scrollWidth).toBe(root.clientWidth)

    await userEvent.click(await canvas.findByRole('tab', { name: 'Usage and limits' }))
    await expect(args.onTabChange).toHaveBeenCalledWith('usage')
    await expect(root.scrollWidth).toBe(root.clientWidth)
  },
}

/** 768. */
export const TabletWidth: Story = {
  args: { sectionId: 'billing', tabId: 'plan' },
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const root = canvasElement.ownerDocument.documentElement

    await expect(root.clientWidth).toBe(768)
    await expect(root.scrollWidth).toBe(root.clientWidth)

    await userEvent.click(await canvas.findByRole('button', { name: 'Invoicing' }))
    await expect(args.onSectionChange).toHaveBeenCalledWith('invoicing')
    await expect(root.scrollWidth).toBe(root.clientWidth)
  },
}

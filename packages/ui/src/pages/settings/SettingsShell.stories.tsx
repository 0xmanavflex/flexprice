import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Bell, Building2, CreditCard, KeyRound, Plug, Receipt, Users, Webhook } from 'lucide-react'
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
    // Nothing in this section is available — and it is still in the rail, still
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
 * picks the tab the new section opens on — here, its first. On a real screen
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

/**
 * Two-level settings navigation: a section rail (`settings-7`) whose active
 * section expands its tabs in place, beside the active tab's content.
 *
 * Fully controlled. The stories own both ids the way a page owns them, because
 * on a real screen they live in the URL.
 */
const meta = {
  title: 'Surfaces/SettingsShell',
  component: SettingsShell,
  parameters: {
    layout: 'padded',
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

/** The active section is expanded; picking a tab or another section is reported. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('navigation', { name: 'Settings' })

    await expect(within(nav).getByRole('button', { name: 'Organization' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(within(nav).getByRole('button', { name: 'Profile' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(within(nav).queryByRole('button', { name: 'People' })).toBeNull()

    await userEvent.click(within(nav).getByRole('button', { name: 'Branding' }))
    await expect(args.onTabChange).toHaveBeenCalledWith('branding')

    // The shell does not pick a tab for the new section; the page does.
    await userEvent.click(within(nav).getByRole('button', { name: 'Members' }))
    await expect(args.onSectionChange).toHaveBeenCalledWith('members')
    await expect(within(nav).getByRole('button', { name: 'People' })).toBeInTheDocument()
  },
}

/** Every control is a real button: Tab reaches it and Enter commits. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('navigation', { name: 'Settings' })

    const branding = within(nav).getByRole('button', { name: 'Branding' })
    branding.focus()
    await expect(branding).toHaveFocus()
    await expect(branding.matches(':focus-visible')).toBe(true)

    await userEvent.keyboard('{Enter}')
    await expect(args.onTabChange).toHaveBeenCalledWith('branding')

    const members = within(nav).getByRole('button', { name: 'Members' })
    members.focus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onSectionChange).toHaveBeenCalledWith('members')
  },
}

/**
 * A section where every tab is unavailable.
 *
 * It stays in the rail and stays selectable — the alternative is a section that
 * silently disappears, which reads as "the feature was removed" rather than
 * "not on this account". The panel says which it is, through `EmptyState`.
 */
export const SectionEntirelyUnavailable: Story = {
  args: { sectionId: 'integrations', tabId: 'connected' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('navigation', { name: 'Settings' })

    const integrations = within(nav).getByRole('button', { name: 'Integrations' })
    await expect(integrations).toBeEnabled()
    await expect(integrations).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByText('Integrations is unavailable')).toBeInTheDocument()

    await userEvent.click(within(nav).getByRole('button', { name: 'Marketplace' }))
    await expect(canvas.getByText('Integrations is unavailable')).toBeInTheDocument()
  },
}

/** One unavailable tab inside a section that otherwise works. */
export const SingleTabUnavailable: Story = {
  args: { sectionId: 'invoicing', tabId: 'templates' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('navigation', { name: 'Settings' })

    await expect(canvas.getByText(/Invoicing \/ Templates/)).toBeInTheDocument()

    await userEvent.click(within(nav).getByRole('button', { name: 'Dunning' }))
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
 * Labels nobody sized for. They truncate — the failure being avoided is a rail
 * item that wraps mid-word and shoves the content column sideways.
 */
export const LongLabels: Story = {
  args: { sections: LONG_SECTIONS, sectionId: 'long', tabId: 'a' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('navigation', { name: 'Settings' })

    for (const name of [
      'Organization profile and legal entity details',
      'Registered legal entity and trading address',
    ]) {
      const label = within(nav).getByRole('button', { name }).querySelector('span')
      await expect(label).not.toBeNull()
      if (!label) return

      const style = getComputedStyle(label)
      await expect(style.textOverflow).toBe('ellipsis')
      await expect(style.whiteSpace).toBe('nowrap')
      await expect(style.overflowX).toBe('hidden')
      await expect(label.getBoundingClientRect().height).toBeLessThan(32)
    }

    const root = canvasElement.ownerDocument.documentElement
    await expect(root.scrollWidth).toBe(root.clientWidth)
  },
}

/** 390, the narrowest width this console is audited at: the nav stacks above the content. */
export const PhoneWidth: Story = {
  args: { sectionId: 'billing', tabId: 'plan' },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const root = canvasElement.ownerDocument.documentElement

    // Asserted, because every claim below is worthless if the viewport global
    // silently stopped being applied.
    await expect(root.clientWidth).toBe(390)

    const nav = await canvas.findByRole('navigation', { name: 'Settings' })
    await expect(root.scrollWidth).toBe(root.clientWidth)

    const last = within(nav).getByRole('button', { name: 'Usage and limits' })
    const navBox = nav.getBoundingClientRect()
    const lastBox = last.getBoundingClientRect()
    await expect(lastBox.left).toBeGreaterThanOrEqual(navBox.left - 1)
    await expect(lastBox.right).toBeLessThanOrEqual(navBox.right + 1)

    await userEvent.click(last)
    await expect(args.onTabChange).toHaveBeenCalledWith('usage')
    await expect(root.scrollWidth).toBe(root.clientWidth)
  },
}

/** 768 — still below `lg`, so the nav stacks above the content rather than sitting beside it. */
export const TabletWidth: Story = {
  args: { sectionId: 'billing', tabId: 'plan' },
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const root = canvasElement.ownerDocument.documentElement

    await expect(root.clientWidth).toBe(768)

    const nav = await canvas.findByRole('navigation', { name: 'Settings' })
    await expect(root.scrollWidth).toBe(root.clientWidth)

    const last = within(nav).getByRole('button', { name: 'Invoicing' })
    await userEvent.click(last)
    await expect(args.onSectionChange).toHaveBeenCalledWith('invoicing')
    await expect(root.scrollWidth).toBe(root.clientWidth)
  },
}

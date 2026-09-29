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
 * Two-level settings navigation: a section rail (`settings-7`) beside the
 * selected section's underlined tab strip (`settings-11`) above its content.
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

/** The rail on the left, the section's tabs above its content. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    const rail = canvas.getByRole('tablist', { name: 'Settings sections' })
    await expect(rail).toHaveAttribute('aria-orientation', 'vertical')
    await expect(within(rail).getByRole('tab', { name: 'Organization' })).toHaveAttribute(
      'data-active',
    )

    // The inner strip belongs to the selected section, and clicking one of its
    // tabs is reported to the page rather than swallowed.
    const strip = canvas.getByRole('tablist', { name: 'Organization tabs' })
    await userEvent.click(within(strip).getByRole('tab', { name: 'Branding' }))
    await expect(args.onTabChange).toHaveBeenCalledWith('branding')

    // Changing section is reported too — and the shell does not quietly pick a
    // tab for the new section; the page does (see `Controlled`).
    await userEvent.click(within(rail).getByRole('tab', { name: 'Members' }))
    await expect(args.onSectionChange).toHaveBeenCalledWith('members')
    await expect(canvas.getByRole('tablist', { name: 'Members tabs' })).toBeInTheDocument()
  },
}

/**
 * Keyboard.
 *
 * Both levels are real `Tabs`, so arrows move between triggers (Base UI moves
 * focus without activating — Enter or Space commits), and the moved-to trigger
 * matches `:focus-visible`, which is what draws the teal ring.
 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const strip = canvas.getByRole('tablist', { name: 'Organization tabs' })

    within(strip).getByRole('tab', { name: 'Profile' }).focus()
    await userEvent.keyboard('{ArrowRight}')

    const branding = within(strip).getByRole('tab', { name: 'Branding' })
    await expect(branding).toHaveFocus()
    await expect(branding.matches(':focus-visible')).toBe(true)

    await userEvent.keyboard('{Enter}')
    await expect(args.onTabChange).toHaveBeenCalledWith('branding')

    // The rail is vertical at this width, so it answers to up and down.
    const rail = canvas.getByRole('tablist', { name: 'Settings sections' })
    within(rail).getByRole('tab', { name: 'Organization' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(within(rail).getByRole('tab', { name: 'Members' })).toHaveFocus()
  },
}

/**
 * A section where every tab is unavailable.
 *
 * It stays in the rail and stays selectable — the alternative is a section that
 * silently disappears, which reads as "the feature was removed" rather than
 * "not on this account". The panel says which it is, through `EmptyState`, so
 * the state is announced and not merely blank.
 */
export const SectionEntirelyUnavailable: Story = {
  args: { sectionId: 'integrations', tabId: 'connected' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const rail = canvas.getByRole('tablist', { name: 'Settings sections' })
    const integrations = within(rail).getByRole('tab', { name: 'Integrations' })
    await expect(integrations).toBeEnabled()
    await expect(integrations).toHaveAttribute('data-active')

    await expect(canvas.getByText('Integrations is unavailable')).toBeInTheDocument()

    // Its tabs are still there and still reachable, so the state is explained
    // from either of them rather than only from the first.
    const strip = canvas.getByRole('tablist', { name: 'Integrations tabs' })
    await userEvent.click(within(strip).getByRole('tab', { name: 'Marketplace' }))
    await expect(canvas.getByText('Integrations is unavailable')).toBeInTheDocument()
  },
}

/** One unavailable tab inside a section that otherwise works. */
export const SingleTabUnavailable: Story = {
  args: { sectionId: 'invoicing', tabId: 'templates' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const strip = canvas.getByRole('tablist', { name: 'Invoicing tabs' })

    await expect(canvas.getByText(/Invoicing \/ Templates/)).toBeInTheDocument()

    await userEvent.click(within(strip).getByRole('tab', { name: 'Dunning' }))
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
    const rail = canvas.getByRole('tablist', { name: 'Settings sections' })
    const label = within(rail)
      .getByRole('tab', { name: 'Organization profile and legal entity details' })
      .querySelector('span')

    await expect(label).not.toBeNull()
    if (!label) return

    const style = getComputedStyle(label)
    await expect(style.textOverflow).toBe('ellipsis')
    await expect(style.whiteSpace).toBe('nowrap')
    await expect(style.overflowX).toBe('hidden')

    // One line, not three.
    await expect(label.getBoundingClientRect().height).toBeLessThan(32)

    // And the page is not wider than the window because of it.
    const root = canvasElement.ownerDocument.documentElement
    await expect(root.scrollWidth).toBe(root.clientWidth)
  },
}

/**
 * 390, the narrowest width this console is audited at.
 *
 * Below `lg` the rail becomes a horizontally scrolling strip and the section's
 * tab strip scrolls too. The assertion that matters is the one the audit found
 * broken elsewhere: the **last** tab of an overflowing strip can be scrolled to
 * and is genuinely on screen. And nothing overflows the page itself.
 */
export const PhoneWidth: Story = {
  args: { sectionId: 'billing', tabId: 'plan' },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const root = canvasElement.ownerDocument.documentElement

    // The story is genuinely at 390 — asserted, because every claim below is
    // worthless if the viewport global silently stopped being applied.
    await expect(root.clientWidth).toBe(390)

    // The rail is a row now, not a column: Base UI only writes
    // `aria-orientation` when vertical, so its absence is the horizontal case.
    const rail = await canvas.findByRole('tablist', { name: 'Settings sections' })
    await expect(rail).not.toHaveAttribute('aria-orientation')
    await expect(getComputedStyle(rail).overflowX).toBe('auto')
    await expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth)

    // Nothing is painted outside the viewport: no horizontal page scroll.
    await expect(root.scrollWidth).toBe(root.clientWidth)

    // Billing has five tabs; at 390 they cannot all fit.
    const strip = canvas.getByRole('tablist', { name: 'Billing tabs' })
    await expect(getComputedStyle(strip).overflowX).toBe('auto')
    await expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth)
    await expect(getComputedStyle(strip).scrollSnapType).toContain('x')

    // An overflowing strip fades at the edge that is hiding something, so
    // there is a visible signal that it continues.
    await expect(getComputedStyle(strip).maskImage).toContain('linear-gradient')

    // The last one is reachable by scrolling, and then really inside the strip
    // — the defect guarded against is a tab painted beyond it, where no scroll
    // could ever bring it back.
    const last = within(strip).getByRole('tab', { name: 'Usage and limits' })
    last.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    await expect(strip.scrollLeft).toBeGreaterThan(0)

    const stripBox = strip.getBoundingClientRect()
    const tabBox = last.getBoundingClientRect()
    await expect(tabBox.left).toBeGreaterThanOrEqual(stripBox.left - 1)
    await expect(tabBox.right).toBeLessThanOrEqual(stripBox.right + 1)

    // And it works when clicked, which is the whole reason it had to be
    // reachable.
    await userEvent.click(last)
    await expect(args.onTabChange).toHaveBeenCalledWith('usage')

    // Still no page-level horizontal overflow after all of that.
    await expect(root.scrollWidth).toBe(root.clientWidth)
  },
}

/**
 * 768 — the width the audit found worst, because it is neither thing.
 *
 * The shell's sidebar is still a 260px push panel here, so the rail has to be
 * the strip and not the column: `lg`, not `md`, is what makes that true. Eight
 * sections do not fit across 768 either, so the rail scrolls exactly as it does
 * on a phone — and the page still does not.
 */
export const TabletWidth: Story = {
  args: { sectionId: 'billing', tabId: 'plan' },
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const root = canvasElement.ownerDocument.documentElement

    await expect(root.clientWidth).toBe(768)

    // Below `lg`, so still the strip — 768 is precisely the width a `md`
    // breakpoint would have got wrong.
    const rail = await canvas.findByRole('tablist', { name: 'Settings sections' })
    await expect(rail).not.toHaveAttribute('aria-orientation')
    await expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth)
    await expect(root.scrollWidth).toBe(root.clientWidth)

    // The last section is reachable, really on screen, and selecting it is
    // reported to the page.
    const last = within(rail).getByRole('tab', { name: 'Invoicing' })
    last.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    await expect(rail.scrollLeft).toBeGreaterThan(0)

    const railBox = rail.getBoundingClientRect()
    const tabBox = last.getBoundingClientRect()
    await expect(tabBox.left).toBeGreaterThanOrEqual(railBox.left - 1)
    await expect(tabBox.right).toBeLessThanOrEqual(railBox.right + 1)

    await userEvent.click(last)
    await expect(args.onSectionChange).toHaveBeenCalledWith('invoicing')
    await expect(root.scrollWidth).toBe(root.clientWidth)
  },
}

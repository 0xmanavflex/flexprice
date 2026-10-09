import { useEffect, useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import {
  BadgeDollarSignIcon,
  BellIcon,
  BotIcon,
  KeyRoundIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SmileIcon,
  TagIcon,
  UsersIcon,
} from 'lucide-react'
import {
  ErrorState,
  LoadingRows,
  SettingRow,
  SettingsCard,
  SettingsFieldGroup,
} from '@ui/compositions'
import { SettingsShell, type SettingsSection } from '@ui/pages/settings/SettingsShell'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { PAGE_STORY_PARAMETERS, PageShell } from './shellFixtures'

/** The rail and tab strips, as `apps/console` declares them in its settings table. */
const SECTIONS: SettingsSection[] = [
  {
    id: 'team',
    label: 'Team',
    icon: <UsersIcon aria-hidden className="size-4" />,
    tabs: [{ id: 'members', label: 'Members' }],
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    icon: <ReceiptTextIcon aria-hidden className="size-4" />,
    tabs: [{ id: 'invoices', label: 'Invoices' }],
  },
  {
    id: 'subscription',
    label: 'Contract',
    icon: <RepeatIcon aria-hidden className="size-4" />,
    tabs: [{ id: 'subscriptions', label: 'Contracts' }],
  },
  {
    id: 'currency',
    label: 'Currency',
    icon: <BadgeDollarSignIcon aria-hidden className="size-4" />,
    tabs: [{ id: 'currencies', label: 'Currencies' }],
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: <BellIcon aria-hidden className="size-4" />,
    tabs: [
      { id: 'alert-rules', label: 'Alert rules' },
      { id: 'wallet-alerts', label: 'Wallet alerts' },
    ],
  },
  {
    id: 'labels',
    label: 'Labels',
    icon: <TagIcon aria-hidden className="size-4" />,
    tabs: [{ id: 'labels', label: 'Labels' }],
  },
  {
    id: 'customer-experience',
    label: 'Customer experience',
    icon: <SmileIcon aria-hidden className="size-4" />,
    tabs: [
      { id: 'portal', label: 'Portal' },
      { id: 'onboarding', label: 'Onboarding' },
    ],
  },
  {
    id: 'api-keys',
    label: 'API keys',
    icon: <KeyRoundIcon aria-hidden className="size-4" />,
    tabs: [{ id: 'api-keys', label: 'API keys' }],
  },
  {
    id: 'service-accounts',
    label: 'Service accounts',
    icon: <BotIcon aria-hidden className="size-4" />,
    tabs: [{ id: 'service-accounts', label: 'Service accounts' }],
  },
]

/** What each section is for, used as the standing-in panel's card blurb now the shell no longer prints it. */
const BLURB: Record<string, string> = {
  team: 'The people who can sign in, and what they can do.',
  invoicing: 'What goes on every invoice, how it is numbered and when it is finalized.',
  subscription: 'What happens to a contract when its invoices go unpaid.',
  currency: 'Fiat currencies you invoice in, and custom ones like credits.',
  alerts: 'When Flexprice warns you about wallet balances and usage.',
  labels: 'Group products and charges for reporting and filters.',
  'customer-experience': 'What your customers see in their billing portal.',
  'api-keys': 'Keys your servers use to call the Flexprice API.',
  'service-accounts': 'Non-human identities with scoped access.',
}

const MEMBERS = [
  { name: 'Dinesh K', email: 'dinesh@flexprice.io', role: 'Owner' },
  { name: 'Asha Rao', email: 'asha@flexprice.io', role: 'Admin' },
  { name: 'Lee Park', email: 'lee@flexprice.io', role: 'Finance' },
  { name: 'Maya Chen', email: 'maya@flexprice.io', role: 'Developer' },
  { name: 'Omar Haddad', email: 'omar@flexprice.io', role: 'Viewer' },
]

/** The Invoicing panel: numbering and payment terms, drawn with the settings-7 surfaces. */
function InvoicesPanel({ environment }: { environment: string }) {
  return (
    <>
      <SettingsCard
        title="Invoice numbering"
        description={`Stored per environment, so ${environment} never shares a sequence.`}
        footer={<Button onClick={fn()}>Save changes</Button>}
      >
        <SettingsFieldGroup
          legend="Invoice numbering"
          description="Prefix and start number for invoices."
        >
          <SettingRow
            title="Prefix"
            description="Shown at the start of every invoice number."
            labelFor="invoice-prefix"
          >
            <Input id="invoice-prefix" defaultValue="INV" />
          </SettingRow>
          <SettingRow
            title="Start number"
            description="The first number in the sequence."
            labelFor="invoice-start"
          >
            <Input id="invoice-start" inputMode="numeric" defaultValue="1" />
          </SettingRow>
          <SettingRow title="Example" description="How the next invoice will read." last>
            <span className="font-mono text-sm">INV-202609-00001</span>
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsCard>
      <SettingsCard title="Payment terms">
        <SettingsFieldGroup
          legend="Payment terms"
          description="When invoices fall due and are finalized."
        >
          <SettingRow
            title="Due in (days)"
            description="Days after finalizing before an invoice is overdue."
            labelFor="invoice-due"
          >
            <Input id="invoice-due" inputMode="numeric" defaultValue="30" />
          </SettingRow>
          <SettingRow
            title="Finalize automatically"
            description="Finalize each draft as soon as its period closes."
            last
          >
            <Switch aria-label="Finalize automatically" defaultChecked />
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsCard>
    </>
  )
}

/** The Members panel: who can sign in. */
function MembersPanel({ memberCount }: { memberCount: number }) {
  return (
    <SettingsCard
      title="Members"
      description="People with access to this organization."
      footer={<Button onClick={fn()}>Invite member</Button>}
    >
      <SettingsFieldGroup legend="Members" description="People with access to this organization.">
        {MEMBERS.slice(0, memberCount).map((member, index, all) => (
          <SettingRow
            key={member.email}
            title={member.name}
            description={member.email}
            last={index === all.length - 1}
          >
            <span className="text-muted-foreground text-sm">{member.role}</span>
          </SettingRow>
        ))}
      </SettingsFieldGroup>
    </SettingsCard>
  )
}

/** Any other tab: one card with two toggles, standing in for that panel's form. */
function GenericPanel({ title, description }: { title: string; description: string }) {
  return (
    <SettingsCard title={title} description={description}>
      <SettingsFieldGroup legend={title} description={`Settings for ${title.toLowerCase()}`}>
        <SettingRow title="Enabled" description={`Turn ${title.toLowerCase()} on.`}>
          <Switch aria-label={`${title} enabled`} defaultChecked />
        </SettingRow>
        <SettingRow title="Notify owners" description="Email the owners when this changes." last>
          <Switch aria-label={`${title} notify owners`} />
        </SettingRow>
      </SettingsFieldGroup>
    </SettingsCard>
  )
}

interface SettingsPageProps {
  sectionId: string
  tabId: string
  environment: 'Sandbox' | 'Production'
  memberCount: number
  isLoading: boolean
  hasError: boolean
}

/** The settings route as the console composes it: shell, SettingsShell, then the tab's panel. */
function SettingsPage({
  sectionId,
  tabId,
  environment,
  memberCount,
  isLoading,
  hasError,
}: SettingsPageProps) {
  const [section, setSection] = useState(sectionId)
  const [tab, setTab] = useState(tabId)
  // The rail and strip are the page's own state; the controls only re-seed them.
  useEffect(() => {
    setSection(sectionId)
    setTab(tabId)
  }, [sectionId, tabId])

  const sections = SECTIONS
  const active = sections.find((entry) => entry.id === section) ?? sections[0]!
  const activeTab = active.tabs.find((item) => item.id === tab) ?? active.tabs[0]!

  let panel: ReactNode
  if (isLoading) panel = <LoadingRows rows={6} columns={2} />
  else if (hasError) {
    panel = (
      <ErrorState
        title={`Flexprice had a problem loading ${active.label.toLowerCase()}.`}
        onRetry={fn()}
      />
    )
  } else if (active.id === 'invoicing') panel = <InvoicesPanel environment={environment} />
  else if (active.id === 'team' && activeTab.id === 'members') {
    panel = <MembersPanel memberCount={memberCount} />
  } else panel = <GenericPanel title={activeTab.label} description={BLURB[active.id] ?? ''} />

  return (
    <PageShell
      activeItemId="settings"
      trail={['Settings', active.label]}
      environment={{
        id: environment === 'Sandbox' ? 'env_dev' : 'env_prod',
        name: environment,
        kind: environment === 'Sandbox' ? 'sandbox' : 'production',
      }}
    >
      <SettingsShell
        sections={sections}
        sectionId={active.id}
        tabId={activeTab.id}
        onSectionChange={(next) => {
          setSection(next)
          setTab(sections.find((entry) => entry.id === next)?.tabs[0]?.id ?? '')
        }}
        onTabChange={setTab}
      >
        {panel}
      </SettingsShell>
    </PageShell>
  )
}

const meta = {
  title: 'Pages/Settings/Settings',
  component: SettingsPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: {
    sectionId: 'team',
    tabId: 'members',
    environment: 'Sandbox',
    memberCount: 4,
    isLoading: false,
    hasError: false,
  },
  argTypes: {
    sectionId: { control: 'select', options: SECTIONS.map((section) => section.id) },
    tabId: {
      control: 'select',
      options: [...new Set(SECTIONS.flatMap((section) => section.tabs.map((tab) => tab.id)))],
    },
    environment: { control: 'inline-radio', options: ['Sandbox', 'Production'] },
    memberCount: { control: { type: 'range', min: 0, max: MEMBERS.length, step: 1 } },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
} satisfies Meta<typeof SettingsPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/settings?section=&tab=` with every control live: pick any section and tab, load or fail the panel. */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    await expect((await within(canvasElement).findAllByText('Members')).length).toBeGreaterThan(0)
  },
}

/** `/settings?section=invoicing&tab=invoices`, a form panel built from settings cards and rows. */
export const Invoicing: Story = {
  args: { sectionId: 'invoicing', tabId: 'invoices' },
}

/** `/settings?section=team`, a section with one tab: no tab strip is drawn. */
export const SingleTab: Story = {
  args: { sectionId: 'team', tabId: 'members' },
  play: async ({ canvasElement }) => {
    await expect((await within(canvasElement).findAllByText('Members')).length).toBeGreaterThan(0)
    await expect(within(canvasElement).queryByRole('tablist')).toBeNull()
  },
}

/** `/settings?section=alerts&tab=alert-rules`, a section with a tab strip. */
export const Alerts: Story = {
  args: { sectionId: 'alerts', tabId: 'alert-rules' },
}

/** `/settings` while the panel is loading. */
export const Loading: Story = {
  args: { isLoading: true },
}

/** `/settings` when the panel could not load. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Flexprice had a problem loading team.'),
    ).toBeInTheDocument()
  },
}

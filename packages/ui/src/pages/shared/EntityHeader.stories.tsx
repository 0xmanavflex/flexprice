import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  ArchiveIcon,
  BracesIcon,
  GaugeIcon,
  HashIcon,
  PencilIcon,
  ToggleRightIcon,
} from '@ui/icons'
import { FeatureType } from '@fp/domain'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { DetailMenuItem } from '@ui/compositions/detail/DetailKit'
import { CatalogStatusBadge, FeatureTypeBadge, type CatalogStatus } from './StatusBadge'
import { EntityHeader } from './EntityHeader'

const TYPE_ICON = {
  [FeatureType.Metered]: GaugeIcon,
  [FeatureType.Static]: HashIcon,
  [FeatureType.Boolean]: ToggleRightIcon,
  [FeatureType.Config]: BracesIcon,
} as const

function menuItems(): DetailMenuItem[] {
  return [
    {
      id: 'edit',
      label: 'Edit feature',
      icon: <PencilIcon className="text-muted-foreground" aria-hidden />,
      onSelect: fn(),
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: <ArchiveIcon aria-hidden />,
      destructive: true,
      onSelect: fn(),
    },
  ]
}

const meta = {
  title: 'Building blocks/Detail pages/EntityHeader',
  component: EntityHeader,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      // Base UI's portal focus guards: see AppShell.stories.tsx.
      config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] },
    },
  },
  args: {
    trail: [{ label: 'Features', onClick: fn() }, { label: 'API calls' }],
    icon: <GaugeIcon aria-hidden className="size-5" />,
    title: 'API calls',
    id: 'feat_01HZX3API',
    email: 'billing@acme.test',
    badges: (
      <>
        <FeatureTypeBadge type={FeatureType.Metered} />
        <CatalogStatusBadge status="published" />
      </>
    ),
    menuLabel: 'Feature actions',
    menu: menuItems(),
  },
  argTypes: {
    title: { control: 'text' },
    id: { control: 'text' },
    email: { control: 'text' },
    trail: { control: 'object' },
    icon: { control: false },
    badges: { control: false },
    menuLabel: { control: 'text' },
    menu: { control: false },
  },
} satisfies Meta<typeof EntityHeader>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  parent: string
  title: string
  id: string
  email: string
  type: FeatureType
  status: CatalogStatus
  showBadges: boolean
  showId: boolean
  showEmail: boolean
  showMenu: boolean
  onBack: () => void
}

/** Every slot as a control: names, type (tile icon and type chip), status chip, id and email chips, and the More menu that holds every action. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    parent: 'Features',
    title: 'API calls',
    id: 'feat_01HZX3API',
    email: 'billing@acme.test',
    type: FeatureType.Metered,
    status: 'published',
    showBadges: true,
    showId: true,
    showEmail: false,
    showMenu: true,
    onBack: fn(),
  },
  argTypes: {
    parent: { control: 'text' },
    title: { control: 'text' },
    id: { control: 'text' },
    email: { control: 'text' },
    type: { control: 'select', options: Object.values(FeatureType) },
    status: { control: 'inline-radio', options: ['published', 'archived'] },
    showBadges: { control: 'boolean' },
    showId: { control: 'boolean' },
    showEmail: { control: 'boolean' },
    showMenu: { control: 'boolean' },
    onBack: { control: false },
  },
  render: (args) => {
    const Icon = TYPE_ICON[args.type]
    return (
      <EntityHeader
        trail={[{ label: args.parent, onClick: args.onBack }, { label: args.title }]}
        icon={<Icon aria-hidden className="size-5" />}
        title={args.title}
        {...(args.showId && args.id ? { id: args.id } : {})}
        {...(args.showEmail && args.email ? { email: args.email } : {})}
        {...(args.showBadges
          ? {
              badges: (
                <>
                  <FeatureTypeBadge type={args.type} />
                  <CatalogStatusBadge status={args.status} />
                </>
              ),
            }
          : {})}
        menuLabel="Feature actions"
        {...(args.showMenu ? { menu: menuItems() } : {})}
      />
    )
  },
}

/** Tile and name on the left; chips, copyable id and a single More menu on the right. No inline action buttons. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'API calls' })).toBeVisible()
    await expect(canvas.getByText('Published')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Copy ID feat_01HZX3API' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Edit feature' })).not.toBeInTheDocument()
  },
}

/** Every action lives in the More menu; the destructive one is last. */
export const MoreMenu: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Feature actions' }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('menuitem', { name: 'Edit feature' }))
    await expect(args.menu?.[0]?.onSelect).toHaveBeenCalledOnce()
  },
}

/** Bare (outside the console shell) the page draws the trail itself, and the parent is a way back. */
export const TrailGoesBack: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Features' }))
    await expect(args.trail[0]?.onClick).toHaveBeenCalled()
    await expect(canvas.getByText('API calls', { selector: 'span' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}

/** Only the required slots: no chips, id, email or menu. */
export const Minimal: Story = {
  render: (args) => <EntityHeader trail={args.trail} icon={args.icon} title={args.title} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'API calls' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /Copy ID/ })).not.toBeInTheDocument()
  },
}

/** An archived record: the badge says so. */
export const Archived: Story = {
  args: { badges: <CatalogStatusBadge status="archived" /> },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Archived')).toBeVisible()
  },
}

/** A very long name truncates inside its column instead of pushing the actions off screen. */
export const LongTitle: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
  args: {
    title:
      'Gigabytes of cold storage retained beyond the contractual window for enterprise tenants',
    trail: [{ label: 'Features', onClick: fn() }, { label: 'Cold storage retention' }],
  },
}

/** Other record kinds use the same tile with their own glyph. */
export const OtherGlyphs: Story = {
  args: {
    icon: <BracesIcon aria-hidden className="size-5" />,
    title: 'Enterprise plan',
    trail: [{ label: 'Plans', onClick: fn() }, { label: 'Enterprise plan' }],
  },
}

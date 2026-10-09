import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoreHorizontalIcon, UserIcon } from 'lucide-react'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@ui/components/primitives/breadcrumb'
import { Badge } from '@ui/components/reui/badge'
import { DetailHeader, type DetailHeaderProps } from './DetailHeader'

type PlaygroundArgs = DetailHeaderProps & {
  showIcon: boolean
  showBadges: boolean
  showPrimary: boolean
  showActions: boolean
  showBreadcrumb: boolean
}

function DetailHeaderDemo({
  showIcon,
  showBadges,
  showPrimary,
  showActions,
  showBreadcrumb,
  ...props
}: PlaygroundArgs) {
  return (
    <DetailHeader
      {...props}
      {...(showIcon ? { icon: <UserIcon aria-hidden /> } : {})}
      {...(showBadges ? { badges: <Badge variant="success-light">Active</Badge> } : {})}
      {...(showPrimary ? { primary: <Button size="sm">Edit customer</Button> } : {})}
      {...(showActions
        ? {
            actions: (
              <Button size="icon-sm" variant="outline" aria-label="More actions">
                <MoreHorizontalIcon aria-hidden />
              </Button>
            ),
          }
        : {})}
      {...(showBreadcrumb
        ? {
            breadcrumb: (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#customers">Customers</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{props.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            ),
          }
        : {})}
    />
  )
}

const meta = {
  title: 'Building blocks/Detail pages/DetailHeader',
  component: DetailHeader,
  parameters: { layout: 'padded' },
  argTypes: {
    title: { control: 'text' },
    id: { control: 'text' },
    identifier: { control: 'text' },
    icon: { control: false },
    email: { control: 'text' },
    primary: { control: false },
    badges: { control: false },
    actions: { control: false },
    breadcrumb: { control: false },
    showIcon: { control: 'boolean' },
    showBadges: { control: 'boolean' },
    showPrimary: { control: 'boolean' },
    showActions: { control: 'boolean' },
    showBreadcrumb: { control: 'boolean' },
  },
  args: {
    title: 'Acme Corporation',
    id: 'cus_01HZX3K8Q2',
    showIcon: true,
    showBadges: true,
    showPrimary: true,
    showActions: true,
    showBreadcrumb: false,
  },
  render: (args) => <DetailHeaderDemo {...args} />,
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

/** Toggle each slot (icon, badges, primary action, More menu, breadcrumb) and edit the title, id and email. */
export const Playground: Story = {}

/** Every slot filled: the usual shape of a record's page. */
export const Full: Story = {
  args: { showBreadcrumb: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Acme Corporation' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Copy ID cus_01HZX3K8Q2' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Edit customer' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'More actions' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Customers' })).toBeVisible()
  },
}

/** An email renders as a mail-icon copy chip beside the id. */
export const WithEmail: Story = {
  args: { email: 'billing@acme.example' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /copy email/i })).toBeVisible()
  },
}

/** Just a name: nothing else is rendered around it. */
export const TitleOnly: Story = {
  args: {
    id: '',
    showIcon: false,
    showBadges: false,
    showPrimary: false,
    showActions: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Acme Corporation' })).toBeVisible()
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
  },
}

/** `identifier` is an alias of `id` and renders the same copy button. */
export const IdentifierAlias: Story = {
  args: { id: undefined as unknown as string, identifier: 'cus_ALIAS0001' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Copy ID cus_ALIAS0001' }),
    ).toBeVisible()
  },
}

/** Status and type chips sit in the right-hand cluster. */
export const BadgesOnly: Story = {
  args: { showPrimary: false, showActions: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Active')).toBeVisible()
  },
}

/** A very long name truncates instead of pushing the actions off the row. */
export const LongTitle: Story = {
  args: {
    title:
      'Acme Corporation International Holdings Limited (EMEA Regional Billing Entity, Frankfurt)',
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Edit customer' })).toBeVisible()
  },
}

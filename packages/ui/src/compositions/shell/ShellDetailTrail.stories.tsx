import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DetailBreadcrumb, type DetailCrumb } from '../detail/DetailShell'
import { ShellBreadcrumb, type ShellCrumb } from './ShellBreadcrumb'
import { ShellDetailTrailProvider, type ShellDetailCrumb } from './ShellDetailTrail'

/**
 * A detail page hands its own trail up to the shell header. The provider is the
 * shell's end of that wire; `DetailBreadcrumb` (via `usePublishDetailTrail`)
 * is the page's end. Bare, with no provider, the page draws its own trail.
 */
const meta = {
  title: 'Building blocks/Shell/ShellDetailTrail',
  component: ShellDetailTrailProvider,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ShellDetailTrailProvider>

export default meta

interface HostArgs {
  /** How many crumbs the page publishes (1 publishes nothing; 2 or 3 reach the header). */
  depth: number
  insideShell: boolean
  onNavigate: (id: string) => void
}

/** The nav the shell already knows: environment, group, and the section the route sits in. */
const NAV_TRAIL: ShellCrumb[] = [
  {
    label: 'Sandbox',
    mark: <span aria-hidden className="bg-muted-foreground/50 size-2 rounded-full" />,
  },
  { label: 'Billing' },
  { label: 'Customers' },
]

/** Maps the published trail onto the nav trail exactly as the console shell does. */
function headerTrail(published: ShellDetailCrumb[] | null): ShellCrumb[] {
  if (!published || published.length < 2) return NAV_TRAIL
  const first = published[0]!
  const last = published[published.length - 1]!
  return [
    ...NAV_TRAIL.slice(0, -1),
    { ...NAV_TRAIL[NAV_TRAIL.length - 1]!, ...(first.hasClick ? { onClick: first.onClick } : {}) },
    { label: last.label },
  ]
}

function Page({ trail }: { trail: DetailCrumb[] }) {
  return (
    <section aria-label="Page" className="flex flex-col gap-3 p-6">
      <DetailBreadcrumb trail={trail} />
      <h1 className="text-xl font-medium tracking-tight">{trail[trail.length - 1]?.label}</h1>
      <p className="text-muted-foreground text-sm">
        The page publishes {trail.length} crumb{trail.length === 1 ? '' : 's'}.
      </p>
    </section>
  )
}

function Host({ depth, insideShell, onNavigate }: HostArgs) {
  const [published, setPublished] = useState<ShellDetailCrumb[] | null>(null)
  const full: DetailCrumb[] = [
    { label: 'Customers', onClick: () => onNavigate('customers') },
    { label: 'Acme Robotics', onClick: () => onNavigate('acme') },
    { label: 'Invoice INV-0042' },
  ]
  // The last crumb is always the current page, whatever the depth.
  const trail = full
    .slice(0, depth)
    .map((crumb, index, all) => (index === all.length - 1 ? { label: crumb.label } : crumb))
  const body = <Page trail={trail} />

  return (
    <div className="bg-background min-h-64 border">
      <header className="flex h-12 items-center border-b px-4">
        <ShellBreadcrumb trail={headerTrail(insideShell ? published : null)} />
      </header>
      {insideShell ? (
        <ShellDetailTrailProvider value={setPublished}>{body}</ShellDetailTrailProvider>
      ) : (
        body
      )}
    </div>
  )
}

type Story = StoryObj<HostArgs>

const argTypes: Story['argTypes'] = {
  depth: { control: { type: 'range', min: 1, max: 3, step: 1 } },
  insideShell: { control: 'boolean', description: 'Mount under the provider, as in the console.' },
  onNavigate: { control: false },
}

const render: Story['render'] = (args) => <Host {...args} />

/** Change the depth or step outside the shell and watch the header and the page swap who draws the trail. */
export const Playground: Story = {
  args: { depth: 3, insideShell: true, onNavigate: fn() },
  argTypes,
  render,
}

/** Under the provider the header takes the trail and the page draws none. */
export const PublishedToTheHeader: Story = {
  args: { depth: 3, insideShell: true, onNavigate: fn() },
  argTypes,
  render,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const header = canvas.getByRole('navigation', { name: 'breadcrumb' })
    // The first crumb of the page's trail becomes the way back from the header.
    await userEvent.click(within(header).getByRole('button', { name: 'Customers' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('customers')
    await expect(within(header).getByLabelText('Invoice INV-0042')).toBeInTheDocument()
    await expect(
      within(canvas.getByRole('region', { name: 'Page' })).queryByRole('navigation'),
    ).not.toBeInTheDocument()
  },
}

/** Two crumbs (a list, then a record) is the common case. */
export const TwoCrumbs: Story = {
  args: { depth: 2, insideShell: true, onNavigate: fn() },
  argTypes,
  render,
  play: async ({ canvasElement }) => {
    const header = within(canvasElement).getByRole('navigation', { name: 'breadcrumb' })
    await expect(within(header).getByLabelText('Acme Robotics')).toBeInTheDocument()
  },
}

/** A single crumb publishes nothing: the header keeps the nav trail and the section is the page. */
export const OneCrumbPublishesNothing: Story = {
  args: { depth: 1, insideShell: true, onNavigate: fn() },
  argTypes,
  render,
  play: async ({ canvasElement }) => {
    const header = within(canvasElement).getByRole('navigation', { name: 'breadcrumb' })
    await expect(
      within(header).queryByRole('button', { name: 'Customers' }),
    ).not.toBeInTheDocument()
    await expect(within(header).getByLabelText('Customers')).toBeInTheDocument()
  },
}

/** Without the provider (bare stories, tests) the page draws its own trail. */
export const OutsideTheShell: Story = {
  // The header and the page both draw an breadcrumb nav (same landmark name) here, by design.
  parameters: { a11y: { config: { rules: [{ id: 'landmark-unique', enabled: false }] } } },
  args: { depth: 3, insideShell: false, onNavigate: fn() },
  argTypes,
  render,
  play: async ({ canvasElement, args }) => {
    const page = within(within(canvasElement).getByRole('region', { name: 'Page' }))
    await userEvent.click(page.getByRole('button', { name: 'Acme Robotics' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('acme')
    await expect(page.getByText('Invoice INV-0042', { selector: 'span' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}

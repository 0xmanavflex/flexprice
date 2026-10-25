import type { ComponentProps, ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowUpRightIcon } from '@ui/icons'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { EmptyState, ListOfferProvider } from './EmptyState'
import { PageBody } from '../layout/Page'

const meta = {
  title: 'Building blocks/Feedback & states/EmptyState',
  component: EmptyState,
  parameters: { layout: 'padded' },
  args: { title: 'No features yet' },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    size: { control: 'inline-radio', options: ['page', 'inline'] },
    isFiltered: {
      control: 'boolean',
      description: 'A filter caused the emptiness: offers clearing it.',
    },
    action: { control: false },
    secondaryAction: { control: false },
    onClearFilters: { control: false },
    scene: { control: 'select', options: ['table', 'developers', 'settings', 'home'] },
    guides: { control: false },
  },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof EmptyState> & {
  showAction: boolean
  showSecondaryAction: boolean
  showClearFilters: boolean
}

/** Switch page/inline size, flip `isFiltered`, and show or hide each action slot. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'No features yet',
    description: 'Features describe what your customers are entitled to and what you meter.',
    size: 'page',
    isFiltered: false,
    showAction: true,
    showSecondaryAction: false,
    showClearFilters: true,
  },
  argTypes: {
    showAction: { control: 'boolean' },
    showSecondaryAction: { control: 'boolean' },
    showClearFilters: { control: 'boolean', description: 'Only used when `isFiltered` is on.' },
  },
  render: ({ showAction, showSecondaryAction, showClearFilters, ...args }) => (
    <EmptyState
      {...args}
      action={showAction ? <Button>New feature</Button> : undefined}
      secondaryAction={showSecondaryAction ? <Button variant="outline">Import</Button> : undefined}
      onClearFilters={
        showClearFilters ? <Button variant="outline">Clear filters</Button> : undefined
      }
    />
  ),
}

/** Nothing created yet: invite the first one. */
export const NothingYet: Story = {
  args: {
    description: 'Features describe what your customers are entitled to and what you meter.',
    action: <Button>New feature</Button>,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'New feature' })).toBeVisible()
  },
}

/**
 * A filter matched nothing: offer to clear it.
 *
 * Showing "create your first feature" to someone who just typed a search is the
 * confusion this separation prevents.
 */
export const NoResults: Story = {
  args: {
    title: 'No features match these filters',
    isFiltered: true,
    action: <Button>New feature</Button>,
    onClearFilters: <Button variant="outline">Clear filters</Button>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Clear filters' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'New feature' })).not.toBeInTheDocument()
  },
}

/** The change is announced, not only seen. */
export const IsAnnounced: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toBeInTheDocument()
  },
}

/**
 * The first-run offer takes the grid's empty body in place.
 *
 * A grid can only describe a filtered miss: from inside the table, "nothing
 * matched" and "nothing exists" are both zero rows. So the page publishes
 * which one it is, and the copy written for the filter gives way to the
 * invitation, in the same slot, under the same toolbar.
 */
export const FirstRunTakesTheSlot: Story = {
  args: {
    title: 'No features match these filters',
    size: 'inline',
    isFiltered: true,
    onClearFilters: <Button variant="outline">Clear filters</Button>,
  },
  decorators: [
    (Story) => (
      <ListOfferProvider
        value={{
          isFirstRun: true,
          title: 'No features yet',
          description: 'Features describe what you meter and what customers are entitled to.',
          action: <Button>New feature</Button>,
        }}
      >
        <Story />
      </ListOfferProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No features yet')).toBeInTheDocument()
    await expect(canvas.queryByText(/match these filters/)).not.toBeInTheDocument()
    // The create action is the toolbar's; the empty body does not repeat it.
    await expect(canvas.queryByRole('button', { name: 'New feature' })).not.toBeInTheDocument()
    // The filter had nothing to do with this, so it is not offered as the fix.
    await expect(canvas.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  },
}

/**
 * A filtered miss is still a filtered miss when the list has records.
 *
 * `isFirstRun` is false here, so the grid's own copy stands and the way out
 * is the one that caused it.
 */
export const FilteredMissKeepsItsCopy: Story = {
  args: {
    title: 'No features match these filters',
    size: 'inline',
    isFiltered: true,
    onClearFilters: <Button variant="outline">Clear filters</Button>,
  },
  decorators: [
    (Story) => (
      <ListOfferProvider
        value={{
          isFirstRun: false,
          title: 'No features yet',
          action: <Button>New feature</Button>,
        }}
      >
        <Story />
      </ListOfferProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No features match these filters')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Clear filters' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'New feature' })).not.toBeInTheDocument()
  },
}

/**
 * A page-sized empty state centres in the height it is given.
 *
 * Measured at 1920×1080 the block used to span y 221→323 with ~750px of blank
 * white under it, which reads as a table that failed to render rather than a
 * screen with nothing on it yet.
 */
export const PageSizedIsCentred: Story = {
  args: {
    description: 'Features describe what you meter and what customers are entitled to.',
    action: <Button>New feature</Button>,
  },
  decorators: [
    (Story) => (
      <div className="flex h-[32rem] flex-col border">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const block = canvas.getByRole('status')
    const parent = block.parentElement as HTMLElement

    // It takes the height it is offered rather than shrinking to its content,
    // which is what gives `justify-center` something to centre in.
    await expect(block.getBoundingClientRect().height).toBeGreaterThan(
      parent.getBoundingClientRect().height - 4,
    )

    // And the slack is shared: roughly as much room above the illustration as
    // below the button, instead of all of it in one blank band underneath.
    const blockBox = block.getBoundingClientRect()
    const header = block.querySelector('[data-slot="empty-header"]') as HTMLElement
    const above = header.getBoundingClientRect().top - blockBox.top
    const below =
      blockBox.bottom -
      canvas.getByRole('button', { name: 'New feature' }).getBoundingClientRect().bottom

    await expect(above).toBeGreaterThan(60)
    await expect(Math.abs(above - below)).toBeLessThan(24)
  },
}

/*
 * The Developers panels' first run (`/api-keys`, `/service-accounts`).
 *
 * The console's `PanelFirstRun` renders exactly this: a page-sized
 * `EmptyState` alone in the page body (`PageBody` > a `flex-1` panel), with the
 * create button and an outline link to the docs, and no toolbar above it: so
 * the create action appears once. The copy here mirrors the panels'.
 */
function DeveloperFirstRunFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[36rem] flex-col border">
      <PageBody>
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </PageBody>
    </div>
  )
}

function DocsLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      // Base UI marks a non-native button `role="button"`; this one navigates.
      render={<a href={href} target="_blank" rel="noreferrer" role="link" />}
    >
      {children}
      <ArrowUpRightIcon aria-hidden data-icon="inline-end" />
    </Button>
  )
}

/** Checks the first run is centred in the page body and offers create once. */
async function expectCentredFirstRun(canvasElement: HTMLElement, create: string, docs: string) {
  const canvas = within(canvasElement)
  const block = canvas.getByRole('status')
  const body = block.closest('[class*="overflow-y-auto"]') as HTMLElement

  await expect(canvas.getAllByRole('button', { name: create })).toHaveLength(1)
  const link = canvas.getByRole('link', { name: docs })
  await expect(link).toHaveAttribute('target', '_blank')

  // Centred both ways in the page body, not pinned to its top-left corner.
  const bodyBox = body.getBoundingClientRect()
  const header = block.querySelector('[data-slot="empty-header"]') as HTMLElement
  const headerBox = header.getBoundingClientRect()
  const above = headerBox.top - bodyBox.top
  const below =
    bodyBox.bottom - canvas.getByRole('button', { name: create }).getBoundingClientRect().bottom
  await expect(above).toBeGreaterThan(80)
  await expect(Math.abs(above - below)).toBeLessThan(48)
  const left = headerBox.left - bodyBox.left
  const right = bodyBox.right - headerBox.right
  await expect(Math.abs(left - right)).toBeLessThan(24)
}

/** `/api-keys` with no keys: the page is this, and only this. */
export const ApiKeysFirstRun: Story = {
  args: {
    size: 'page',
    scene: 'settings',
    title: 'No API keys yet',
    description:
      'An API key lets your servers send usage events and call the Flexprice API without a person signing in.',
    action: <Button>Create API key</Button>,
    secondaryAction: (
      <DocsLink href="https://docs.flexprice.io/api-reference/introduction">API docs</DocsLink>
    ),
  },
  decorators: [(Story) => <DeveloperFirstRunFrame>{<Story />}</DeveloperFirstRunFrame>],
  play: async ({ canvasElement }) => {
    await expectCentredFirstRun(canvasElement, 'Create API key', 'API docs')
  },
}

/** `/service-accounts` with none: the same layout as API keys, its own copy. */
export const ServiceAccountsFirstRun: Story = {
  args: {
    size: 'page',
    scene: 'developers',
    title: 'No service accounts yet',
    description:
      'A service account lets one of your systems hold its own roles instead of borrowing a person’s. Create one, then issue it an API key.',
    action: <Button>New service account</Button>,
    secondaryAction: (
      <DocsLink href="https://docs.flexprice.io/docs/rbac/service-accounts/create">
        Read the docs
      </DocsLink>
    ),
  },
  decorators: [(Story) => <DeveloperFirstRunFrame>{<Story />}</DeveloperFirstRunFrame>],
  play: async ({ canvasElement }) => {
    await expectCentredFirstRun(canvasElement, 'New service account', 'Read the docs')
  },
}

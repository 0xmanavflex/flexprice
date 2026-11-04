import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookOpenIcon, CodeIcon, ZapIcon } from '@ui/icons'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import {
  GuideGrid,
  GuidedEmptyState,
  type GuideCard,
  type GuidedEmptyStateProps,
} from './GuidedEmptyState'
import { DOCS } from '@fp/domain'

const allGuides: GuideCard[] = [
  {
    title: 'Model your first plan',
    description: 'Plans bundle prices and entitlements into something a customer can subscribe to.',
    href: DOCS.plans,
    icon: <BookOpenIcon aria-hidden />,
  },
  {
    title: 'Send usage events',
    description: 'Meter what customers consume with the events API and bill on it.',
    href: DOCS.eventDebugger,
    icon: <ZapIcon aria-hidden />,
  },
  {
    title: 'Use the API',
    description: 'Everything in the console is available over REST and the SDKs.',
    href: DOCS.apiReference,
    icon: <CodeIcon aria-hidden />,
  },
  {
    title: 'A fourth guide',
    description: 'Only the first three are ever shown.',
    href: DOCS.featureUseCases,
    icon: <BookOpenIcon aria-hidden />,
  },
]

const meta = {
  title: 'Building blocks/Feedback & states/GuidedEmptyState',
  component: GuidedEmptyState,
  parameters: { layout: 'padded' },
  args: {
    title: 'Create your first feature',
    description: 'Features describe what you meter and what customers are entitled to.',
    label: 'No features yet',
    actions: <Button>New feature</Button>,
    guides: allGuides.slice(0, 3),
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    label: { control: 'text', description: 'Accessible name of the status region.' },
    actions: { control: false },
    guides: { control: 'object' },
  },
} satisfies Meta<typeof GuidedEmptyState>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs extends Omit<GuidedEmptyStateProps, 'guides' | 'actions'> {
  guideCount: number
  showAction: boolean
}

function GuidedPlayground({ guideCount, showAction, ...props }: PlaygroundArgs) {
  const guides = Array.from({ length: guideCount }, (_, index) => {
    const base = allGuides[index % allGuides.length] as GuideCard
    return {
      ...base,
      href: `${base.href}?n=${index}`,
      title: `${base.title}${index >= 4 ? ` ${index + 1}` : ''}`,
    }
  })
  return (
    <GuidedEmptyState
      {...props}
      guides={guides}
      actions={showAction ? <Button onClick={fn()}>New feature</Button> : undefined}
    />
  )
}

/** Drag the guide count from 0 to 6 (only three are ever drawn) and toggle the primary action. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'Create your first feature',
    description: 'Features describe what you meter and what customers are entitled to.',
    label: 'No features yet',
    guideCount: 3,
    showAction: true,
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    label: { control: 'text' },
    guideCount: { control: { type: 'range', min: 0, max: 6, step: 1 } },
    showAction: { control: 'boolean' },
  },
  render: (args) => <GuidedPlayground {...args} />,
}

/** Illustration, copy, one action and three routes forward. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status', { name: 'No features yet' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'New feature' })).toBeVisible()
    await expect(canvas.getAllByRole('link')).toHaveLength(3)
  },
}

/** Without guides the card row disappears and only the message remains. */
export const NoGuides: Story = {
  args: { guides: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole('link')).toHaveLength(0)
  },
}

/** Without a description or action: title and illustration only. */
export const TitleOnly: Story = {
  args: { description: undefined, actions: undefined, guides: undefined },
}

/** A fourth guide is dropped: the grid is three routes forward, never four. */
export const OnlyFirstThreeGuides: Story = {
  args: { guides: allGuides },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('link')).toHaveLength(3)
    await expect(canvas.queryByText('A fourth guide')).not.toBeInTheDocument()
  },
}

/** Each guide opens its docs in a new tab, named for what it is. */
export const GuidesOpenDocs: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', {
      name: 'Send usage events: read docs',
    })
    await expect(link).toHaveAttribute('href', DOCS.eventDebugger)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noreferrer')
  },
}

/** The primary action is the caller's: clicking it reports to the page. */
export const PrimaryActionIsTheCallers: Story = {
  args: { actions: <Button onClick={fn()}>New feature</Button> },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'New feature' }))
  },
}

/** `GuideGrid` on its own, for pages that compose their own empty state. */
export const GuideGridAlone: Story = {
  render: () => <GuideGrid guides={allGuides.slice(0, 3)} className="max-w-6xl" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('link')).toHaveLength(3)
  },
}

/** Guides without icons or descriptions collapse to title and link only. */
export const GuideGridBare: Story = {
  render: () => (
    <GuideGrid
      guides={[
        { title: 'Plans', href: DOCS.plans },
        { title: 'Events', href: DOCS.eventDebugger },
        { title: 'API', href: DOCS.apiReference },
      ]}
    />
  ),
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BlurredEmpty, MetricChart } from './charts'
import type { MetricTab } from './charts'

const days = ['Mar 1', 'Mar 2', 'Mar 3', 'Mar 4', 'Mar 5', 'Mar 6', 'Mar 7', 'Mar 8']

/**
 * The shape behind the message. Deliberately plausible-looking and deliberately
 * unreadable: it is a texture that says "a chart goes here", and it is inert
 * and `aria-hidden` so it can never be mistaken for a reading.
 */
const placeholder: MetricTab[] = [
  {
    id: 'events',
    label: 'Events',
    value: '—',
    points: days.map((label, index) => ({
      label,
      value: Math.round(40 + Math.sin(index / 1.3) * 18 + index * 3),
    })),
  },
]

const meta = {
  title: 'Building blocks/Feedback & states/BlurredEmpty',
  component: BlurredEmpty,
  parameters: { layout: 'padded' },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    action: { control: false },
    secondaryAction: { control: false },
    children: { control: false },
    className: { control: false },
  },
  args: {
    title: 'No events yet',
    description:
      'Send your first usage event and this chart fills in with ingestion as it happens.',
    action: { label: 'Quickstart', onClick: fn() },
    secondaryAction: { label: 'Send test event', onClick: fn() },
    children: (
      <MetricChart tabs={placeholder} activeTab="events" onTabChange={() => {}} height={220} />
    ),
  },
} satisfies Meta<typeof BlurredEmpty>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

interface PlaygroundArgs {
  title: string
  description: string
  showAction: boolean
  showSecondaryAction: boolean
  chartHeight: number
  onAction: () => void
}

/** Edit the message, toggle either action (clicks log to Actions), and resize the chart behind it. */
export const Playground = {
  args: {
    title: 'No events yet',
    description:
      'Send your first usage event and this chart fills in with ingestion as it happens.',
    showAction: true,
    showSecondaryAction: true,
    chartHeight: 220,
    onAction: fn(),
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    showAction: { control: 'boolean' },
    showSecondaryAction: { control: 'boolean' },
    chartHeight: { control: { type: 'range', min: 140, max: 420, step: 10 } },
    onAction: { control: false },
  },
  parameters: {
    controls: {
      include: [
        'title',
        'description',
        'showAction',
        'showSecondaryAction',
        'chartHeight',
        'onAction',
      ],
    },
  },
  render: ({ title, description, showAction, showSecondaryAction, chartHeight, onAction }) => (
    <BlurredEmpty
      title={title}
      description={description}
      action={showAction ? { label: 'Quickstart', onClick: onAction } : undefined}
      secondaryAction={
        showSecondaryAction ? { label: 'Send test event', onClick: onAction } : undefined
      }
    >
      <MetricChart
        tabs={placeholder}
        activeTab="events"
        onTabChange={() => {}}
        height={chartHeight}
      />
    </BlurredEmpty>
  ),
} satisfies StoryObj<PlaygroundArgs>

/**
 * The guarantee this component exists for.
 *
 * The chart underneath is decoration, so it must be unreachable three ways at
 * once: out of the accessibility tree, out of the tab order, and out of the way
 * of the pointer. The tab strip behind the card is a real, focusable control:
 * if `inert` were missing, a keyboard user would land on a tab they cannot see
 * and a screen reader would then decline to tell them what it was.
 */
export const DecorationIsInert: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // The tabs behind the card exist in the DOM...
    const hidden = canvasElement.querySelector('[aria-hidden="true"][inert]')
    await expect(hidden).not.toBeNull()
    await expect(hidden?.querySelectorAll('[role="tab"]').length ?? 0).toBeGreaterThan(0)

    // ...but not to anybody reading the page.
    await expect(canvas.queryByRole('tab')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument()

    // Only the message card's own buttons are reachable.
    await expect(canvas.getAllByRole('button')).toHaveLength(2)
  },
}

/** Both actions fire what the page gave them, and nothing else. */
export const ActionsFire: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Quickstart' }))
    await expect(args.action?.onClick).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Send test event' }))
    await expect(args.secondaryAction?.onClick).toHaveBeenCalled()
  },
}

/** One way forward, not two. */
export const SingleAction: Story = {
  args: { secondaryAction: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('button')).toHaveLength(1)
  },
}

/** A message with nothing to do about it: an explanation, not an invitation. */
export const NoActions: Story = {
  args: {
    title: 'Revenue analytics unavailable',
    description: 'Flexprice could not load revenue for this window. Try again in a moment.',
    action: undefined,
    secondaryAction: undefined,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}

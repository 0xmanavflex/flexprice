import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ShellPromoCard } from './ShellPromoCard'

/**
 * The sidebar's promo card, at the width it renders in the rail's `pinned` slot.
 */
const meta = {
  title: 'Building blocks/Shell/ShellPromoCard',
  component: ShellPromoCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
  args: {
    title: 'Build with the API',
    description: 'Meter usage, price it however you sell, and invoice from one catalogue.',
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    cta: { control: false },
    dismissKey: {
      control: 'text',
      description: 'Persists the dismissal to localStorage under this key.',
    },
    className: { control: false },
  },
} satisfies Meta<typeof ShellPromoCard>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = Omit<ComponentProps<typeof ShellPromoCard>, 'cta' | 'dismissKey'> & {
  showCta: boolean
  ctaLabel: string
  onCta: () => void
}

/** Edit the copy and the call to action; the card remounts on each edit, so a dismissal resets. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'Build with the API',
    description: 'Meter usage, price it however you sell, and invoice from one catalogue.',
    showCta: true,
    ctaLabel: 'Read the docs',
    onCta: fn(),
  },
  argTypes: {
    showCta: { control: 'boolean' },
    ctaLabel: { control: 'text' },
    onCta: { control: false },
  },
  render: ({ showCta, ctaLabel, onCta, ...args }) => (
    <ShellPromoCard
      key={`${args.title}|${args.description}|${showCta}|${ctaLabel}`}
      {...args}
      {...(showCta ? { cta: { label: ctaLabel, onClick: onCta } } : {})}
    />
  ),
}

export const Default: Story = {}

/** With a call to action: the reason the card is there. */
export const WithCta: Story = {
  args: { cta: { label: 'Read the docs', onClick: fn() } },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Read the docs' }))
    await expect(args.cta!.onClick).toHaveBeenCalledOnce()
  },
}

/**
 * Dismissible: the close button removes the card. (With a `dismissKey` the
 * dismissal also persists to localStorage; here, without one, it just unmounts.)
 */
export const Dismissible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Build with the API' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }))
    await expect(
      canvas.queryByRole('region', { name: 'Build with the API' }),
    ).not.toBeInTheDocument()
  },
}

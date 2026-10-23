import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PlusIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Section } from '../layout/Section'
import { SectionEmpty } from './SectionEmpty'

const meta = {
  title: 'Building blocks/Feedback & states/SectionEmpty',
  component: SectionEmpty,
  parameters: { layout: 'padded' },
  args: {
    title: 'No entitlements yet',
    description:
      'Entitlements decide what is included of each feature. Add one to define what subscribers get.',
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    action: { control: false },
  },
} satisfies Meta<typeof SectionEmpty>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof SectionEmpty> & {
  showRetry: boolean
}

/** Edit the copy and toggle the non-create way out ("Try again"). */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'No entitlements yet',
    description: 'Entitlements decide what is included of each feature.',
    showRetry: false,
  },
  argTypes: { showRetry: { control: 'boolean' } },
  render: ({ showRetry, ...args }) => (
    <SectionEmpty
      {...args}
      {...(showRetry
        ? {
            action: (
              <Button type="button" variant="outline" size="sm" className="h-8 px-3">
                Try again
              </Button>
            ),
          }
        : {})}
    />
  ),
}

export const Default: Story = {}

/**
 * Inside its card: the create action is the section header's, top right, and
 * the empty body does not repeat it.
 */
export const InSection: Story = {
  render: (args) => (
    <Section
      table
      title="Entitlements"
      action={
        <Button type="button" variant="outline" size="sm" className="h-8 px-3">
          <PlusIcon aria-hidden />
          Add entitlement
        </Button>
      }
    >
      <SectionEmpty {...args} />
    </Section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('button', { name: 'Add entitlement' })).toHaveLength(1)
    const status = canvas.getByRole('status')
    await expect(status.contains(canvas.getByRole('button', { name: 'Add entitlement' }))).toBe(
      false,
    )
  },
}

/** A failed load offers the way back, not the create action. */
export const WithRetry: Story = {
  args: {
    title: 'Entitlements could not be loaded',
    description: 'The rest of the page still works.',
    action: (
      <Button type="button" variant="outline" size="sm" className="h-8 px-3">
        Try again
      </Button>
    ),
  },
}

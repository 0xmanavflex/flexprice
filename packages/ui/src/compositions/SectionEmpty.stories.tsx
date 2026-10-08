import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlusIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import { SectionEmpty } from './SectionEmpty'

const meta = {
  title: 'Foundation/Compositions/SectionEmpty',
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
  showAction: boolean
  actionLabel: string
}

/** Edit the copy and toggle the call to action. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'No entitlements yet',
    description: 'Entitlements decide what is included of each feature.',
    showAction: true,
    actionLabel: 'Add entitlement',
  },
  argTypes: { showAction: { control: 'boolean' }, actionLabel: { control: 'text' } },
  render: ({ showAction, actionLabel, ...args }) => (
    <SectionEmpty
      {...args}
      {...(showAction
        ? {
            action: (
              <Button type="button" size="sm" className="h-8 px-3">
                <PlusIcon aria-hidden />
                {actionLabel}
              </Button>
            ),
          }
        : {})}
    />
  ),
}

export const Default: Story = {}

export const WithAction: Story = {
  args: {
    action: (
      <Button type="button" size="sm" className="h-8 px-3">
        <PlusIcon aria-hidden />
        Add entitlement
      </Button>
    ),
  },
}

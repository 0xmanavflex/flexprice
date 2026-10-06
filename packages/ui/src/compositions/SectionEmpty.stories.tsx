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
} satisfies Meta<typeof SectionEmpty>

export default meta
type Story = StoryObj<typeof meta>

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

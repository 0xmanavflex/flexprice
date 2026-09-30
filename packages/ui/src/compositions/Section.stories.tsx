import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { Section } from './Section'

const meta = {
  title: 'Foundation/Compositions/Section',
  component: Section,
  parameters: { layout: 'padded' },
  args: {
    title: 'Entitlements',
    children: <p className="text-sm text-muted-foreground">Section content.</p>,
  },
} satisfies Meta<typeof Section>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDescriptionAndActions: Story = {
  args: {
    description: 'What this plan includes.',
    actions: <Button size="sm" variant="outline">Add</Button>,
  },
}

/** A region labelled by a real heading, not by large text. */
export const IsALabelledRegion: Story = {
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Entitlements' })
    await expect(region).toBeInTheDocument()
  },
}

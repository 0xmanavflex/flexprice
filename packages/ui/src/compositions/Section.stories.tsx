import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { Panel, Section } from './Section'
import { SimpleTable } from './DetailKit'

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

/** `flush` drops the body padding so a table runs edge to edge inside the border. */
export const FlushTable: Story = {
  args: {
    flush: true,
    children: (
      <SimpleTable
        columns={[
          { key: 'name', header: 'Name', cell: (row: { id: string; name: string }) => row.name },
        ]}
        rows={[
          { id: 'a', name: 'Seats' },
          { id: 'b', name: 'API calls' },
        ]}
      />
    ),
  },
}

/** The reference Panel: a muted tray holding a white inner surface. */
export const PanelTray: StoryObj = {
  render: () => (
    <Panel title="Usage" description="Last 30 days">
      <p className="text-muted-foreground p-5 text-sm">Panel content.</p>
    </Panel>
  ),
}

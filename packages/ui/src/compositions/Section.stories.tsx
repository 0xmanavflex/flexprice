import type { ComponentProps } from 'react'
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
    children: <p className="text-muted-foreground text-sm">Section content.</p>,
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    as: { control: 'inline-radio', options: ['h1', 'h2', 'h3'], description: 'Heading level.' },
    flush: { control: 'boolean', description: 'No body padding.' },
    bare: { control: 'boolean', description: 'No header band.' },
    table: { control: 'boolean', description: 'No title row; the name stays for assistive tech.' },
    actions: { control: false },
    action: { control: false },
    children: { control: false },
    className: { control: false },
    bodyClassName: { control: false },
  },
} satisfies Meta<typeof Section>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = Omit<ComponentProps<typeof Section>, 'children'> & {
  body: 'text' | 'table'
  rows: number
  showActions: boolean
}

/** Flip the header treatments, heading level, and body between text and a table of N rows. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'Entitlements',
    description: 'What each subscriber gets.',
    as: 'h2',
    flush: false,
    bare: false,
    table: false,
    body: 'text',
    rows: 3,
    showActions: true,
  },
  argTypes: {
    body: { control: 'inline-radio', options: ['text', 'table'] },
    rows: {
      control: { type: 'range', min: 0, max: 20, step: 1 },
      description: 'Rows when the body is a table.',
    },
    showActions: { control: 'boolean' },
  },
  render: ({ body, rows, showActions, ...args }) => (
    <Section
      {...args}
      {...(showActions
        ? {
            actions: (
              <Button size="sm" variant="outline">
                Add
              </Button>
            ),
          }
        : {})}
    >
      {body === 'table' ? (
        <SimpleTable
          columns={[
            { key: 'name', header: 'Name', cell: (row: { id: string; name: string }) => row.name },
          ]}
          rows={Array.from({ length: rows }, (_, i) => ({
            id: `row-${i}`,
            name: `Feature ${i + 1}`,
          }))}
        />
      ) : (
        <p className="text-muted-foreground text-sm">Section content.</p>
      )}
    </Section>
  ),
}

export const Default: Story = {}

export const WithActions: Story = {
  args: {
    actions: (
      <Button size="sm" variant="outline">
        Add
      </Button>
    ),
  },
}

/** `bare` drops the header band: the title stays for screen readers, and the body leads with its own search. */
export const Bare: Story = {
  args: { bare: true, flush: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Entitlements' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Entitlements' })).toBeInTheDocument()
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
    <Panel title="Usage">
      <p className="text-muted-foreground p-5 text-sm">Panel content.</p>
    </Panel>
  ),
}

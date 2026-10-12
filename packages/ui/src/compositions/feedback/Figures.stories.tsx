import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { EMPTY_CATALOGUE, type EmptyKind } from './emptyCatalogue'
import { EmptyState } from './EmptyState'
import { Figure, FIGURE_NAMES } from './Figures'

const meta = {
  title: 'Building blocks/Feedback & states/Figures',
  component: Figure,
  parameters: { layout: 'padded' },
  args: { name: 'drawer', motion: 'interactive' },
  argTypes: {
    name: { control: 'select', options: FIGURE_NAMES },
    motion: { control: 'inline-radio', options: ['static', 'ambient', 'interactive'] },
  },
} satisfies Meta<typeof Figure>

export default meta
type Story = StoryObj<typeof meta>

/** Move the pointer over the figure: the layers lean toward it. Reduced motion shows the plain drawing. */
export const Playground: Story = {}

/** Every figure at once, static, so they can be compared as a set. */
export const Gallery: Story = {
  render: () => (
    <ul className="grid grid-cols-2 gap-6 sm:grid-cols-4">
      {FIGURE_NAMES.map((name) => (
        <li key={name} className="flex flex-col items-center gap-2">
          <Figure name={name} motion="static" />
          <span className="text-muted-foreground text-xs">{name}</span>
        </li>
      ))}
    </ul>
  ),
}

const KINDS = Object.keys(EMPTY_CATALOGUE) as EmptyKind[]

/** The whole empty-state catalogue: figure, copy and motion for each situation. */
export const Catalogue: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="grid gap-px p-6 sm:grid-cols-2 xl:grid-cols-3">
      {KINDS.map((kind) => {
        const copy = EMPTY_CATALOGUE[kind]
        return (
          <section key={kind} aria-label={kind} className="border-border rounded-lg border">
            <EmptyState
              size="inline"
              figure={copy.figure}
              motion={copy.motion}
              title={copy.title}
              description={copy.description}
            />
          </section>
        )
      })}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('status')).toHaveLength(KINDS.length)
  },
}

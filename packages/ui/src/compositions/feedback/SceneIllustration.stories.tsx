import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { GuidedEmptyState } from './GuidedEmptyState'
import { EMPTY_SCENES, SceneIllustration } from './SceneIllustration'

const meta = {
  title: 'Building blocks/Feedback & states/SceneIllustration',
  component: SceneIllustration,
  parameters: { layout: 'padded' },
  args: { scene: 'table', size: 'md' },
  argTypes: {
    scene: { control: 'select', options: EMPTY_SCENES },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof SceneIllustration>

export default meta
type Story = StoryObj<typeof meta>

/** Move the pointer over the figure. Reduced motion leaves the resting drawing. */
export const Playground: Story = {}

/** One per area of the product: tables, developers, settings, home. */
export const Scenes: Story = {
  render: () => (
    <ul className="grid grid-cols-2 gap-8 lg:grid-cols-4">
      {EMPTY_SCENES.map((scene) => (
        <li key={scene} className="flex flex-col items-center gap-3">
          <SceneIllustration scene={scene} size="md" />
          <span className="text-muted-foreground text-xs">{scene}</span>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    // Decoration only: nothing in the reading order, nothing to tab to.
    const canvas = within(canvasElement)
    await expect(canvas.queryAllByRole('img')).toHaveLength(0)
    await expect(
      canvasElement.querySelectorAll('[aria-hidden="true"] [tabindex="0"]'),
    ).toHaveLength(0)
  },
}

/** The first-run page for each area, as a list page shows it. */
export const FirstRunPages: Story = {
  render: () => (
    <div className="grid gap-12">
      {EMPTY_SCENES.map((scene) => (
        <GuidedEmptyState
          key={scene}
          scene={scene}
          title={`First run: ${scene}`}
          description="Nothing here yet. Create the first one to see it listed."
          actions={<Button>Create</Button>}
          label={`${scene}: nothing here yet`}
        />
      ))}
    </div>
  ),
}

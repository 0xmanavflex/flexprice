import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DEFAULT_EVENT_IMPORT_QUERY } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { UploadIcon } from '@ui/icons'
import { EventImportGrid } from './EventImportGrid'
import { EventImportsOverview } from './EventImportsOverview'
import { eventImportFixtures } from './eventImportFixtures'

const meta = {
  title: 'App/Developers/Imports/Imports',
  component: EventImportsOverview,
  parameters: { layout: 'fullscreen' },
  args: {
    onDownloadTemplate: fn(),
    children: (
      <EventImportGrid
        imports={eventImportFixtures()}
        total={4}
        query={{ ...DEFAULT_EVENT_IMPORT_QUERY }}
        onQueryChange={fn()}
        onRefresh={fn()}
        primaryAction={
          <Button>
            <UploadIcon aria-hidden />
            Import CSV
          </Button>
        }
        locale="en-US"
      />
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof EventImportsOverview>

export default meta
type Story = StoryObj<typeof meta>

/** The imports, then the columns an import reads and the template to start from. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('CSV format')).toBeInTheDocument()
    await expect(canvas.getByText('event_name')).toBeInTheDocument()
    await expect(canvas.getByText('external_customer_id')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Download template' }))
    await expect(args.onDownloadTemplate).toHaveBeenCalled()
  },
}

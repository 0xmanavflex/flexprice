import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent } from 'storybook/test'
import type { EventImport } from '@fp/domain'
import { EventImportSheet } from './EventImportSheet'
import { eventImportFixtures } from './eventImportFixtures'

const [running, partial, clean, failed] = eventImportFixtures() as [
  EventImport,
  EventImport,
  EventImport,
  EventImport,
]

const meta = {
  title: 'App/Developers/Imports/Import detail sheet',
  component: EventImportSheet,
  args: { row: partial, onClose: fn(), onRefresh: fn(), locale: 'en-US' },
  argTypes: { row: { control: false } },
} satisfies Meta<typeof EventImportSheet>

export default meta
type Story = StoryObj<typeof meta>

/** Finished, with each rejected row's reason on its own line. */
export const WithRowErrors: Story = {
  play: async () => {
    await expect(await screen.findByText('Completed with errors')).toBeInTheDocument()
    await expect(screen.getByText('3 errors')).toBeInTheDocument()
    await expect(screen.getByText('Record 402: event_name is required')).toBeInTheDocument()
    // Refresh is for an import still in progress only.
    await expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
  },
}

export const Running: Story = {
  args: { row: running },
  play: async ({ args }) => {
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }))
    await expect(args.onRefresh).toHaveBeenCalled()
  },
}

export const Clean: Story = { args: { row: clean } }

export const FailedOutright: Story = {
  args: { row: failed },
  play: async () => {
    await expect(await screen.findByText('Error')).toBeInTheDocument()
  },
}

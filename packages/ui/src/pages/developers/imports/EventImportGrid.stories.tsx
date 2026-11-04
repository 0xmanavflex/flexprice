import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DEFAULT_EVENT_IMPORT_QUERY } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { UploadIcon } from '@ui/icons'
import { EventImportGrid } from './EventImportGrid'
import { eventImportFixtures } from './eventImportFixtures'

const meta = {
  title: 'App/Developers/Imports/Import table',
  component: EventImportGrid,
  parameters: { layout: 'padded' },
  args: {
    imports: eventImportFixtures(),
    total: 4,
    query: { ...DEFAULT_EVENT_IMPORT_QUERY },
    onQueryChange: fn(),
    onRefresh: fn(),
    onOpen: fn(),
    primaryAction: (
      <Button>
        <UploadIcon aria-hidden />
        Import CSV
      </Button>
    ),
    locale: 'en-US',
  },
  argTypes: {
    imports: { control: false },
    total: { control: false },
    query: { control: false },
    primaryAction: { control: false },
    isLoading: { control: 'boolean' },
    error: { control: false },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
  },
} satisfies Meta<typeof EventImportGrid>

export default meta
type Story = StoryObj<typeof meta>

/** One import of each state: running, done with rejected rows, clean, and failed outright. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('clickpost-usage-october.csv')).toBeInTheDocument()
    await expect(canvas.getByText('Importing')).toBeInTheDocument()
    await expect(canvas.getByText('Completed with errors')).toBeInTheDocument()
    // The column header and the failed import's pill.
    await expect(canvas.getAllByText('Failed').length).toBeGreaterThan(1)
    await userEvent.click(canvas.getByText('august-usage.csv'))
    await expect(args.onOpen).toHaveBeenCalled()
  },
}

/** The search box narrows the page on screen by file name. */
export const SearchingThePage: Story = {
  args: { query: { ...DEFAULT_EVENT_IMPORT_QUERY, search: 'backfill' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('sms-backfill-september.csv')).toBeInTheDocument()
    await expect(canvas.queryByText('august-usage.csv')).not.toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: { imports: [], total: 0 },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No imports yet')).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { imports: [], total: 0, isLoading: true } }

export const LoadFailed: Story = {
  args: { imports: [], total: 0, error: 'Could not load imports. Try again.', onRetry: fn() },
}

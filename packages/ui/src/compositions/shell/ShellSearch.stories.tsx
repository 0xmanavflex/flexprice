import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FileSignatureIcon, UsersIcon } from '@ui/icons'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { ShellSearch } from './ShellSearch'

/**
 * Search as a button that opens a dialog, not a field that sits there
 * collecting focus. It rides in the top bar beside Create, so it is a plain
 * control with no sidebar context to mount.
 */
const meta = {
  title: 'Building blocks/Shell/ShellSearch',
  component: ShellSearch,
  parameters: {
    // The dialog is a Base UI portal; its focus guards trip axe. The dialog
    // has an sr-only title and the field is labelled. See AppShell.stories.tsx.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: {
    items: [
      { id: 'page:customers', label: 'Customers', group: 'Pages' },
      { id: 'page:plans', label: 'Plans', group: 'Pages' },
    ],
    onSelect: fn(),
    placeholder: 'Search…',
  },
  argTypes: {
    items: {
      control: 'object',
      description: 'Always-available destinations: id, label, group, optional hint.',
    },
    results: { control: 'object', description: 'Server results shown beneath `items`.' },
    isSearching: { control: 'boolean', description: 'Shows the searching state in the dialog.' },
    hasError: {
      control: 'boolean',
      description: 'The server lookup failed: says so instead of "No results".',
    },
    onRetry: { control: false },
    placeholder: { control: 'text' },
    onSelect: { control: false },
    onTermChange: { control: false },
  },
} satisfies Meta<typeof ShellSearch>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof ShellSearch> & { enabled: boolean }

/** Open the dialog and type; edit `items` and `results`, flip `isSearching`, or switch `enabled` off for the unavailable state. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    enabled: true,
    isSearching: false,
    hasError: false,
    placeholder: 'Search…',
    items: [
      { id: 'page:customers', label: 'Customers', group: 'Pages' },
      { id: 'page:plans', label: 'Plans', group: 'Pages' },
      { id: 'page:invoices', label: 'Invoices', group: 'Pages', hint: 'Billing' },
      { id: 'action:new-plan', label: 'New plan', group: 'Actions' },
    ],
    results: [
      { id: 'customer:acme', label: 'Acme Corp', group: 'Customers', hint: 'billing@acme.io' },
      { id: 'customer:globex', label: 'Globex', group: 'Customers', hint: 'ap@globex.com' },
    ],
    onSelect: fn(),
    onTermChange: fn(),
  },
  argTypes: {
    enabled: {
      control: 'boolean',
      description: 'Off omits `onSelect`: search is not available yet.',
    },
  },
  render: ({ enabled, onSelect, ...args }) => (
    <ShellSearch {...args} {...(enabled && onSelect ? { onSelect } : {})} />
  ),
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Search' })).toBeVisible()
  },
}

/** The button opens the dialog, and choosing a result reports it. */
export const OpensADialogAndReports: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Search' }))

    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByRole('combobox', { name: 'Search' }), 'cust{Enter}')
    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'page:customers' }),
    )
  },
}

/**
 * Rows from one table sit under that table's heading, each with the sidebar's
 * icon for it: customers under "Customers" with the Customers glyph, pages
 * under "Pages" with their section's glyph.
 */
export const GroupsRowsWithIcons: Story = {
  args: {
    items: [
      {
        id: 'page:subscriptions',
        label: 'Contracts',
        group: 'Pages',
        icon: <FileSignatureIcon data-testid="page-icon" />,
      },
    ],
    results: [
      {
        id: 'customer:acme',
        label: 'Acme Corp',
        group: 'Customers',
        hint: 'billing@acme.io',
        icon: <UsersIcon data-testid="customer-icon" />,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Search' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByRole('combobox', { name: 'Search' }), 'c')

    const heading = await dialog.findByText('Customers', { selector: 'div' })
    const row = dialog.getByRole('option', { name: /Acme Corp/ })
    await expect(
      heading.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await expect(within(row).getByTestId('customer-icon')).toBeInTheDocument()
    await expect(
      within(dialog.getByRole('option', { name: /Contracts/ })).getByTestId('page-icon'),
    ).toBeInTheDocument()
  },
}

/** Autofill and some extensions dispatch keydown events with no `key`; the shortcut ignores them. */
export const IgnoresKeylessKeydown: Story = {
  play: async ({ canvasElement }) => {
    const event = new KeyboardEvent('keydown', { ctrlKey: true })
    Object.defineProperty(event, 'key', { value: undefined })
    window.dispatchEvent(event)
    await expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await expect(within(canvasElement).getByRole('button', { name: 'Search' })).toBeVisible()
  },
}

/**
 * Without `onSelect` there is no field.
 *
 * An input that takes a query, closes the dialog and drops it teaches that
 * search is broken rather than absent: and it was doing exactly that in the
 * console, where no global search endpoint is wired. The unavailable state
 * says so, and names the per-list search boxes that do work. The `/` hint and
 * the shortcuts are not advertised either.
 */
export const NotAvailableYet: Story = {
  render: () => <ShellSearch />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Search' })
    await expect(trigger).not.toHaveAttribute('aria-keyshortcuts')

    await userEvent.click(trigger)
    const dialog = within(await screen.findByRole('dialog'))
    // `waitFor`, so the check retries while the dialog animates open.
    await waitFor(() => expect(dialog.getByText(/available yet/)).toBeVisible())
    // Nothing that could swallow a query.
    await expect(dialog.queryByRole('combobox')).not.toBeInTheDocument()
  },
}

/** The count is announced politely, so typing is answered without moving focus. */
export const AnnouncesResultCount: Story = {
  args: {
    results: [{ id: 'customer:acme', label: 'Acme Corp', group: 'Customers' }],
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Search' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByRole('combobox', { name: 'Search' }), 'c')
    const status = await dialog.findByRole('status')
    await expect(status).toHaveAttribute('aria-live', 'polite')
    await waitFor(() => expect(status).toHaveTextContent('2 results'))
  },
}

/** A failed lookup is not "No results": it says search is unavailable and offers a retry. */
export const SearchUnavailable: Story = {
  args: { items: [], results: [], hasError: true, onRetry: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Search' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByRole('combobox', { name: 'Search' }), 'acme')
    await waitFor(() =>
      expect(dialog.getAllByText('Search is unavailable. Try again.').length).toBeGreaterThan(0),
    )
    await expect(dialog.queryByText(/No results/)).not.toBeInTheDocument()
    await userEvent.click(dialog.getByRole('button', { name: 'Retry' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** Pages still match locally when the record lookup fails; the gap is named rather than hidden. */
export const PartialFailure: Story = {
  args: { results: [], hasError: true, onRetry: fn() },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Search' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByRole('combobox', { name: 'Search' }), 'cust')
    await expect(await dialog.findByRole('option', { name: /Customers/ })).toBeVisible()
    await expect(dialog.getByText('Some results could not be loaded.')).toBeVisible()
  },
}

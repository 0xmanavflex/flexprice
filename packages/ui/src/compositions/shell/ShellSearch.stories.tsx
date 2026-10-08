import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { ShellSearch } from './ShellSearch'

/**
 * Search as a button that opens a dialog, not a field that sits there
 * collecting focus. It rides in the top bar beside Create, so it is a plain
 * control with no sidebar context to mount.
 */
const meta = {
  title: 'Foundation/Compositions/Shell/ShellSearch',
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
 * Without `onSelect` there is no field.
 *
 * An input that takes a query, closes the dialog and drops it teaches that
 * search is broken rather than absent — and it was doing exactly that in the
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

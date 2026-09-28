import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
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
    onSearch: fn(),
    placeholder: 'Search…',
  },
} satisfies Meta<typeof ShellSearch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Search' })).toBeVisible()
  },
}

/** The button opens the dialog, and submitting reports the term. */
export const OpensADialogAndReports: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Search' }))

    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByRole('searchbox', { name: 'Search' }), 'acme{Enter}')
    await expect(args.onSearch).toHaveBeenCalledWith('acme')
  },
}

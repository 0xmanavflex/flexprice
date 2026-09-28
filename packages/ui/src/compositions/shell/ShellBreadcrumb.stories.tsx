import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ShellBreadcrumb } from './ShellBreadcrumb'

/**
 * Where am I. A crumb may carry a mark that survives when its label is dropped
 * at narrow widths, and the current page is never a link.
 */
const onCatalog = fn()

const meta = {
  title: 'Foundation/Compositions/Shell/ShellBreadcrumb',
  component: ShellBreadcrumb,
  parameters: { layout: 'padded' },
  args: {
    trail: [
      {
        label: 'Sandbox',
        mark: <span aria-hidden className="bg-muted-foreground/50 size-2 rounded-full" />,
      },
      { label: 'Product Catalog', onClick: onCatalog },
      { label: 'Features' },
    ],
  },
} satisfies Meta<typeof ShellBreadcrumb>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'breadcrumb' })

    // Every crumb is named even where its label is hidden.
    await expect(within(nav).getByLabelText('Sandbox')).toBeInTheDocument()

    // The current page is not a link. A link to where you already are does
    // nothing, and offering it is a promise the interface cannot keep.
    await expect(within(nav).queryByRole('button', { name: 'Features' })).not.toBeInTheDocument()
  },
}

/** A crumb with an `onClick` is navigable; it reports the intent. */
export const ReportsACrumbClick: Story = {
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'breadcrumb' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Product Catalog' }))
    await expect(onCatalog).toHaveBeenCalled()
  },
}

/** A shallow trail: environment then page. */
export const TwoLevels: Story = {
  args: {
    trail: [
      {
        label: 'Production',
        mark: <span aria-hidden className="bg-destructive size-2 rounded-full" />,
      },
      { label: 'Revenue' },
    ],
  },
}

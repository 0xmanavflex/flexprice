import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/components/primitives/table'
import { CopyIcon } from '@ui/icons'
import { RowActionsMenu } from './RowActionsMenu'

const meta = {
  title: 'Building blocks/Tables & lists/RowActionsMenu',
  component: RowActionsMenu,
  parameters: {
    layout: 'centered',
    // Base UI renders aria-hidden focus guards around portalled popups; see ConfirmDialog.stories.tsx.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: {
    label: 'API calls',
    onEdit: fn(),
    onRemove: fn(),
  },
  argTypes: {
    label: { control: 'text', description: 'Names the trigger: "Actions for <label>".' },
    removeLabel: { control: 'text' },
    onEdit: { control: false },
    onRemove: { control: false },
  },
} satisfies Meta<typeof RowActionsMenu>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  label: string
  removeLabel: string
  hasEdit: boolean
  hasRemove: boolean
  onEdit: () => void
  onRemove: () => void
}

/** Toggle which actions the caller wired and rename the destructive one; open the menu to see the result. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    label: 'API calls',
    removeLabel: 'Remove',
    hasEdit: true,
    hasRemove: true,
    onEdit: fn(),
    onRemove: fn(),
  },
  argTypes: {
    label: { control: 'text' },
    removeLabel: { control: 'text' },
    hasEdit: { control: 'boolean' },
    hasRemove: { control: 'boolean' },
    onEdit: { control: false },
    onRemove: { control: false },
  },
  render: ({ label, removeLabel, hasEdit, hasRemove, onEdit, onRemove }) => (
    <RowActionsMenu
      label={label}
      removeLabel={removeLabel}
      onEdit={hasEdit ? onEdit : undefined}
      onRemove={hasRemove ? onRemove : undefined}
    />
  ),
}

/** The trigger is named for the row it acts on, not just "More". */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Actions for API calls' }),
    ).toBeVisible()
  },
}

/** Edit reports to the caller and closes the menu. */
export const EditsTheRow: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Actions for API calls' }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    await expect(args.onEdit).toHaveBeenCalledTimes(1)
    await expect(args.onRemove).not.toHaveBeenCalled()
  },
}

/** The destructive item uses the caller's wording. */
export const RemovesWithCustomLabel: Story = {
  args: { removeLabel: 'Archive feature' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Actions for API calls' }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archive feature' }))
    await expect(args.onRemove).toHaveBeenCalledTimes(1)
  },
}

/** Only the actions the caller wired appear: here, no Edit. */
export const OnlyRemove: Story = {
  render: (args) => <RowActionsMenu label={args.label} onRemove={args.onRemove} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Actions for API calls' }),
    )
    await expect(await screen.findByRole('menuitem', { name: 'Remove' })).toBeInTheDocument()
    await expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
  },
}

/** Only Edit: no destructive item. */
export const OnlyEdit: Story = {
  render: (args) => <RowActionsMenu label={args.label} onEdit={args.onEdit} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Actions for API calls' }),
    )
    await expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
    await expect(screen.queryByRole('menuitem', { name: 'Remove' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
  },
}

/** In its natural home: the last cell of a table row, each trigger named for its row. */
export const InATable: Story = {
  render: (args) => (
    <div className="w-[28rem] rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feature</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {['API calls', 'Seats', 'Storage'].map((name) => (
            <TableRow key={name}>
              <TableCell>{name}</TableCell>
              <TableCell>
                <RowActionsMenu label={name} onEdit={args.onEdit} onRemove={args.onRemove} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('button', { name: /^Actions for / })).toHaveLength(3)
    await expect(canvas.getByRole('button', { name: 'Actions for Seats' })).toBeVisible()
  },
}

/** Every item leads with an icon, so the labels line up: Edit, the row's own items and the destructive one. */
export const EveryItemHasAnIcon: Story = {
  args: {
    extra: [
      {
        label: 'Copy ID',
        icon: <CopyIcon aria-hidden />,
        readOnly: true,
        onSelect: fn(),
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Actions for API calls' }),
    )
    const items = await screen.findAllByRole('menuitem')
    await expect(items.map((item) => item.textContent)).toEqual(['Edit', 'Copy ID', 'Remove'])
    for (const item of items) await expect(item.querySelector('svg')).not.toBeNull()
    await userEvent.keyboard('{Escape}')
  },
}

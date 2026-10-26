import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Composer } from '../detail/DetailKit'
import { Field } from './Field'
import { FormActions } from './FormActions'
import { FormDialog, type FormDialogProps } from './FormDialog'

type PlaygroundArgs = FormDialogProps & {
  /** Number of fields in the body; raise it to make the body scroll. */
  fields: number
  /** Use a `Composer` (which knows it is in a dialog) instead of a bare form. */
  useComposer: boolean
  onSubmit: () => void
}

function FormDialogDemo({
  open: initialOpen,
  onOpenChange,
  title,
  size,
  fields,
  useComposer,
  onSubmit,
  isPending,
  dismissible,
}: PlaygroundArgs) {
  const [open, setOpen] = useState(initialOpen)
  useEffect(() => setOpen(initialOpen), [initialOpen])
  const change = (next: boolean) => {
    onOpenChange(next)
    setOpen(next)
  }
  const inputs = Array.from({ length: Math.max(1, fields) }, (_, index) => (
    <Field key={index} label={index === 0 ? 'Name' : `Field ${index + 1}`}>
      {(p) => <Input {...p} />}
    </Field>
  ))
  return (
    <>
      <Button onClick={() => change(true)}>{title}</Button>
      <FormDialog
        open={open}
        onOpenChange={change}
        title={title}
        {...(size ? { size } : {})}
        {...(isPending ? { isPending } : {})}
        {...(dismissible === false ? { dismissible } : {})}
      >
        {useComposer ? (
          <Composer submitLabel="Create" onSubmit={onSubmit} onCancel={() => change(false)}>
            {inputs}
          </Composer>
        ) : (
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              onSubmit()
            }}
          >
            {inputs}
            <FormActions mode="create" noun="thing" onCancel={() => change(false)} />
          </form>
        )}
      </FormDialog>
    </>
  )
}

const meta = {
  title: 'Building blocks/Forms/FormDialog',
  component: FormDialog,
  parameters: {
    layout: 'padded',
    // Base UI renders `aria-hidden` focus guards with `tabindex="0"` around
    // every portalled surface; axe flags them and we cannot fix a vendored
    // library. See ConfirmDialog.stories.tsx.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  argTypes: {
    open: { control: 'boolean' },
    title: { control: 'text' },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    isPending: {
      control: 'boolean',
      description: 'Submit in flight: the dialog cannot be dismissed.',
    },
    dismissible: {
      control: 'boolean',
      description: 'False hides the close control and ignores Escape/overlay (a one-time secret).',
    },
    fields: { control: { type: 'number', min: 1, max: 30, step: 1 } },
    useComposer: { control: 'boolean' },
    onOpenChange: { control: false },
    onSubmit: { control: false },
    children: { control: false },
  },
  args: {
    open: true,
    title: 'New group',
    size: 'md',
    fields: 3,
    useComposer: false,
    onOpenChange: fn(),
    onSubmit: fn(),
    children: null,
  },
  render: (args) => <FormDialogDemo {...args} />,
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

/** Resize with `size`, add `fields` until the body scrolls, switch the footer between Composer and FormActions. */
export const Playground: Story = {
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: 'New group' })
    await expect(within(dialog).getByRole('textbox', { name: 'Name' })).toBeVisible()
  },
}

/** Closed until the trigger is pressed; closing reports through `onOpenChange`. */
export const OpensAndCloses: Story = {
  args: { open: false },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'New group' }))
    const dialog = await screen.findByRole('dialog', { name: 'New group' })
    await expect(args.onOpenChange).toHaveBeenCalledWith(true)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(args.onOpenChange).toHaveBeenLastCalledWith(false))
  },
}

/** `dismissible={false}`: no close control and Escape is ignored; only the body's own button exits. */
export const NotDismissible: Story = {
  args: { dismissible: false },
  play: async ({ args }) => {
    const dialog = await screen.findByRole('dialog', { name: 'New group' })
    await expect(within(dialog).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await expect(args.onOpenChange).not.toHaveBeenCalledWith(false)
    await expect(dialog).toBeVisible()
  },
}

/** `sm` for a name and a code. */
export const Small: Story = {
  args: { size: 'sm', fields: 2 },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: 'New group' })
    await expect(dialog).toHaveClass('sm:max-w-md')
  },
}

/** `lg` for forms that need room. */
export const Large: Story = {
  args: { size: 'lg', fields: 4 },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: 'New group' })
    await expect(dialog).toHaveClass('sm:max-w-4xl')
  },
}

/** A body taller than the viewport scrolls under a fixed header; the last field is still reachable. */
export const LongBody: Story = {
  args: { fields: 30 },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: 'New group' })
    await expect(within(dialog).getByRole('textbox', { name: 'Field 30' })).toBeInTheDocument()
    await waitFor(() =>
      expect(within(dialog).getByRole('heading', { name: 'New group' })).toBeVisible(),
    )
  },
}

/** A `Composer` inside knows it is in a dialog and does not pad twice. */
export const WithComposer: Story = {
  args: { useComposer: true },
  play: async ({ args }) => {
    const dialog = await screen.findByRole('dialog', { name: 'New group' })
    await expect(dialog.querySelector('form')).not.toHaveClass('p-6')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Platform')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }))
    await expect(args.onSubmit).toHaveBeenCalledOnce()
  },
}

/** A submit in flight: Escape is ignored and the close control is withdrawn, so the dialog cannot close under the request. */
export const Pending: Story = {
  args: { isPending: true },
  play: async ({ args }) => {
    const dialog = await screen.findByRole('dialog', { name: 'New group' })
    await expect(within(dialog).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await expect(args.onOpenChange).not.toHaveBeenCalled()
    await expect(screen.getByRole('dialog', { name: 'New group' })).toBeInTheDocument()
  },
}

/** Dismissing and reopening gives a clean form, not the half-typed values of last time. */
export const ResetsOnReopen: Story = {
  args: { open: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'New group' }))
    let dialog = await screen.findByRole('dialog', { name: 'New group' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Half typed')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'New group' }))
    dialog = await screen.findByRole('dialog', { name: 'New group' })
    await expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('')
  },
}

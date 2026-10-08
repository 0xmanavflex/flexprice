import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Badge } from '@ui/components/reui/badge'
import { ContextualSection, type ContextualSectionProps } from './ContextualSection'
import { SimpleTable } from './DetailKit'
import { Field } from './Field'

interface SubscriptionRow {
  id: string
  plan: string
  status: 'Active' | 'Paused'
}

type PlaygroundArgs = ContextualSectionProps & {
  /** Number of table rows; 0 shows the empty table state. */
  rows: number
  /** Whether the section starts with its form open. */
  formOpen: boolean
  onCreate: () => void
}

const PLANS = ['Starter', 'Growth', 'Scale', 'Enterprise']
const makeRows = (count: number): SubscriptionRow[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `sub_${String(index + 1).padStart(3, '0')}`,
    plan: PLANS[index % PLANS.length] ?? 'Starter',
    status: index % 4 === 3 ? 'Paused' : 'Active',
  }))

function ContextualSectionDemo({ rows, formOpen, onCreate, onBack, ...props }: PlaygroundArgs) {
  const [open, setOpen] = useState(formOpen)
  useEffect(() => setOpen(formOpen), [formOpen])
  const close = () => {
    onBack?.()
    setOpen(false)
  }
  return (
    <div className="max-w-3xl">
      <ContextualSection
        {...props}
        onBack={close}
        actions={
          <Button
            size="sm"
            onClick={() => {
              onCreate()
              setOpen(true)
            }}
          >
            Create subscription
          </Button>
        }
        form={
          open ? (
            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault()
                close()
              }}
            >
              <Field label="Plan" required>
                {(p) => <Input {...p} />}
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          ) : undefined
        }
      >
        <SimpleTable<SubscriptionRow>
          columns={[
            { key: 'id', header: 'ID', cell: (row) => row.id },
            { key: 'plan', header: 'Plan', cell: (row) => row.plan },
            {
              key: 'status',
              header: 'Status',
              cell: (row) => (
                <Badge variant={row.status === 'Active' ? 'success-light' : 'secondary'}>
                  {row.status}
                </Badge>
              ),
            },
          ]}
          rows={makeRows(rows)}
          empty="This customer has no subscriptions yet."
        />
      </ContextualSection>
    </div>
  )
}

const meta = {
  title: 'Foundation/Compositions/ContextualSection',
  component: ContextualSection,
  parameters: { layout: 'padded' },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    formTitle: { control: 'text' },
    formDescription: { control: 'text' },
    backLabel: { control: 'text' },
    className: { control: 'text' },
    actions: { control: false },
    children: { control: false },
    form: { control: false },
    onBack: { control: false },
    onCreate: { control: false },
    rows: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    formOpen: { control: 'boolean' },
  },
  args: {
    title: 'Subscriptions',
    description: 'Plans this customer is billed for.',
    formTitle: 'Create subscription',
    formDescription: 'It starts today and bills on the plan cadence.',
    rows: 3,
    formOpen: false,
    onBack: fn(),
    onCreate: fn(),
    children: null,
  },
  render: (args) => <ContextualSectionDemo {...args} />,
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

/** Drag `rows` from 0 to 30, toggle `formOpen`; the Create button and Back also swap the form in place. */
export const Playground: Story = {}

/** The table state, with its create action in the header. */
export const TableState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Subscriptions' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Create subscription' })).toBeVisible()
    await expect(canvas.getAllByRole('row')).toHaveLength(4)
  },
}

/** No rows: the table's own empty copy shows in the section body. */
export const Empty: Story = {
  args: { rows: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('This customer has no subscriptions yet.'),
    ).toBeVisible()
  },
}

/** A long list stays inside the section. */
export const LongList: Story = { args: { rows: 30 } }

/** The form has taken the table's place: back link, form heading, the form itself. */
export const FormOpen: Story = {
  args: { formOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Create subscription' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Subscriptions' })).toBeVisible()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
  },
}

/** Opening the form swaps the table out, moves focus to the form heading, and Back restores the table. */
export const OpensAndReturns: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create subscription' }))
    await expect(args.onCreate).toHaveBeenCalledOnce()
    const heading = await canvas.findByRole('heading', { name: 'Create subscription' })
    await waitFor(() => expect(heading.parentElement).toHaveFocus())
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Subscriptions' }))
    await expect(args.onBack).toHaveBeenCalledOnce()
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible())
  },
}

/** `backLabel` names the way back when it should not just repeat the section title. */
export const CustomBackLabel: Story = {
  args: { formOpen: true, backLabel: 'Back to subscriptions' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Back to subscriptions' }),
    ).toBeVisible()
  },
}

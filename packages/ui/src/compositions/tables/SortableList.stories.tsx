import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SortableItem, SortableList } from './SortableList'

function Demo({
  initialIds,
  disabled,
  onReorder,
}: {
  initialIds: readonly string[]
  disabled?: boolean | undefined
  onReorder?: ((ids: string[]) => void) | undefined
}) {
  const [ids, setIds] = useState<string[]>([...initialIds])
  // Follow the `ids` control; dragging still reorders in between.
  useEffect(() => setIds([...initialIds]), [initialIds])
  const flag = disabled === undefined ? {} : { disabled }
  return (
    <SortableList
      ids={ids}
      onReorder={(next) => {
        setIds(next)
        onReorder?.(next)
      }}
      className="max-w-md gap-2"
      {...flag}
    >
      {ids.map((id) => (
        <SortableItem key={id} id={id} label={id} className="rounded-lg border p-3" {...flag}>
          {(grip) => (
            <div className="flex items-center gap-2">
              {grip}
              <span className="text-sm capitalize">{id}</span>
            </div>
          )}
        </SortableItem>
      ))}
    </SortableList>
  )
}

const meta = {
  title: 'Foundation/Compositions/SortableList',
  component: SortableList,
  parameters: { layout: 'padded' },
  args: { ids: ['usage', 'invoices', 'wallet'], onReorder: fn(), children: null },
  argTypes: {
    ids: {
      control: 'object',
      description: 'Ids in display order; add or remove entries to change the count.',
    },
    disabled: {
      control: 'boolean',
      description: 'Freezes the order and hides the drag affordance.',
    },
    onReorder: { control: false },
    children: { control: false },
    className: { control: false },
  },
  render: (args) => (
    <Demo initialIds={args.ids} disabled={args.disabled} onReorder={args.onReorder} />
  ),
} satisfies Meta<typeof SortableList>

export default meta
type Story = StoryObj<typeof meta>

/** Drag, or focus a grip and use the keyboard; edit `ids` to change the rows. */
export const Playground: Story = {
  args: { ids: ['usage', 'invoices', 'wallet', 'credits', 'taxes'], disabled: false },
}

export const Default: Story = {}

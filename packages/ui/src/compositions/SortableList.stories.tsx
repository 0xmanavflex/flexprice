import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SortableItem, SortableList } from './SortableList'

function Demo() {
  const [ids, setIds] = useState(['usage', 'invoices', 'wallet'])
  return (
    <SortableList ids={ids} onReorder={setIds} className="max-w-md gap-2">
      {ids.map((id) => (
        <SortableItem key={id} id={id} label={id} className="rounded-lg border p-3">
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
  args: { ids: ['usage', 'invoices', 'wallet'], onReorder: () => undefined, children: null },
  render: () => <Demo />,
} satisfies Meta<typeof SortableList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

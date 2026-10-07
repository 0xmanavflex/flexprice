import type { CSSProperties, ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon } from 'lucide-react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

export const SortableListProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'A vertical drag-to-reorder list over dnd-kit (the same library the data-grid row dnd uses); the grip is a button, so the keyboard reorders too (Space, arrows, Space).',
})

export interface SortableListProps {
  /** The ids, in the order they are shown. */
  ids: readonly string[]
  /** The ids in their new order. */
  onReorder: (ids: string[]) => void
  disabled?: boolean
  className?: string
  /** `SortableItem`s, one per id. */
  children: ReactNode
}

export function SortableList({ ids, onReorder, disabled, className, children }: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    onReorder(arrayMove([...ids], from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={[...ids]}
        strategy={verticalListSortingStrategy}
        disabled={!!disabled}
      >
        <ul className={cn('flex flex-col', className)}>{children}</ul>
      </SortableContext>
    </DndContext>
  )
}

export interface SortableItemProps {
  id: string
  /** Names the grip for assistive tech: "Drag <label> to reorder". */
  label: string
  disabled?: boolean
  className?: string
  /** Receives the grip, to place wherever the row wants it. */
  children: (grip: ReactNode) => ReactNode
}

export function SortableItem({ id, label, disabled, className, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !!disabled })
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition }

  const grip = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      disabled={disabled}
      aria-label={`Drag ${label} to reorder`}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -ml-1 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded outline-none focus-visible:ring-3 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
      {...attributes}
      {...listeners}
    >
      <GripVerticalIcon aria-hidden className="size-4" />
    </button>
  )

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'bg-background relative z-10 rounded-lg shadow-md', className)}
    >
      {children(grip)}
    </li>
  )
}

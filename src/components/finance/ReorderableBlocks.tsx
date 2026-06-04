/**
 * Fluid drag-to-reorder list of "block" cards (dnd-kit).
 *
 * Each card has a dedicated grip handle so dragging never conflicts with the
 * card's inline controls (edit, status pickers, links). The parent passes the
 * already-ordered items, a getId, the per-item card renderer, and onReorder
 * (receives the new full id sequence to persist).
 */

import { type ReactNode } from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableItemProps {
  id: string;
  children: ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-stretch gap-1 rounded-2xl',
        isDragging && 'shadow-2xl shadow-black/30 ring-2 ring-primary/40 opacity-95',
      )}
    >
      {/* Drag handle — only this initiates the drag */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar"
        className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-2xl bg-muted/40 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

interface Props<T> {
  items: T[];
  getId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  /** Receives the new full sequence of ids after a drop. */
  onReorder: (orderedIds: string[]) => void;
}

export default function ReorderableBlocks<T>({ items, getId, renderCard, onReorder }: Props<T>) {
  const sensors = useSensors(
    // small distance so taps still work for inline buttons inside the card
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map(getId);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <SortableItem key={getId(item)} id={getId(item)}>
              {renderCard(item)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, ReactNode } from 'react';

interface DraggableTableHeaderProps {
  id: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function DraggableTableHeader({ id, children, style }: DraggableTableHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const combinedStyle: CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'grab',
    userSelect: 'none',
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? 'var(--bg-tertiary)' : undefined,
    position: 'relative',
  };

  return (
    <th
      ref={setNodeRef}
      style={combinedStyle}
      {...attributes}
      {...listeners}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{
          opacity: 0.4,
          fontSize: '10px',
          marginRight: '2px',
        }}>
          ⋮⋮
        </span>
        {children}
      </span>
    </th>
  );
}

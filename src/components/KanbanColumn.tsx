"use client";

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task, Column } from "@/lib/types";
import TaskCard from "./TaskCard";
import AddTask from "./AddTask";
import ColumnHeader from "./ColumnHeader";

interface Props {
  columnId: string;
  label: string;
  columnIndex: number;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (title: string, column: Column) => Promise<void>;
  onRenameColumn: (columnId: string, newLabel: string) => Promise<void>;
  onDeleteColumn: (columnId: string) => void;
  isDynamic?: boolean;
}

const COLUMN_TINTS = [
  "bg-blue-100",
  "bg-amber-100",
  "bg-green-100",
  "bg-purple-100",
  "bg-pink-100",
  "bg-cyan-100",
];

export default function KanbanColumn({
  columnId,
  label,
  columnIndex,
  tasks,
  onTaskClick,
  onAddTask,
  onRenameColumn,
  onDeleteColumn,
  isDynamic = false,
}: Props) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: columnId });
  const {
    setNodeRef: setSortableRef,
    attributes,
    listeners,
    isDragging,
    transform,
  } = useSortable({ id: columnId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : "transform 200ms cubic-bezier(0.2, 0, 0, 1)",
    opacity: isDragging ? 0.5 : 1,
  };

  const handleRename = async (newLabel: string) => {
    await onRenameColumn(columnId, newLabel);
  };

  const handleDelete = () => {
    onDeleteColumn(columnId);
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex flex-col min-w-0 flex-shrink-0 w-96"
    >
      <ColumnHeader
        columnId={columnId}
        label={label}
        columnIndex={columnIndex}
        taskCount={tasks.length}
        onRename={handleRename}
        onDelete={handleDelete}
        isDynamic={isDynamic}
        isDragging={isDragging}
      />

      {/* Drop zone */}
      <div
        ref={setDropRef}
        className={`flex-1 rounded-2xl p-3 transition-colors duration-150 min-h-[120px] ${
          isOver ? "bg-accent-light" : "bg-column-bg"
        }`}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
              />
            ))}
          </div>
        </SortableContext>

        <AddTask column={columnId} onAdd={onAddTask} />
      </div>
    </div>
  );
}

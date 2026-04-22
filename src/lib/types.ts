export type Column = string; // Now dynamic, any string is valid

export interface ColumnData {
  id: string;
  label: string;
  order: number;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string | Date;
  taskId: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string | Date | null;
  createdAt: string | Date;
  column: Column;
  columnUpdatedAt: string | Date;
  assignee: string;
  order: number;
  comments: Comment[];
}

export const COLUMNS: { id: Column; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "doing", label: "In Progress" },
  { id: "done", label: "Done" },
];

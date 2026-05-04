export interface Board {
  id: string;
  name: string;
  createdAt: string | Date;
}

export interface ColumnData {
  id: string;
  label: string;
  order: number;
  isDone: boolean;
  boardId: string;
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
  updatedAt: string | Date;
  completedAt: string | Date | null;
  column: string;
  columnUpdatedAt: string | Date;
  assignee: string;
  order: number;
  priority: string;
  comments: Comment[];
}

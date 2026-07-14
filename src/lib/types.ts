export interface Board {
  id: string;
  name: string;
  order: number;
  createdAt: string | Date;
  realtimeSecret?: string;
  publicViewEnabled?: boolean;
  publicViewToken?: string;
}

export interface ColumnData {
  id: string;
  label: string;
  order: number;
  isDone: boolean;
  color?: string | null;
  boardId: string;
}

export interface Comment {
  id: string;
  content: string;
  author: string;
  createdAt: string | Date;
  taskId: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  boardId: string;
}

export interface Attachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedBy: string;
  createdAt: string | Date;
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
  assigneeId: string | null;
  assigneeUser?: {
    id: string;
    name: string;
    color: string;
    handle?: string | null;
  } | null;
  // Full assignee set (multi-assignee). assigneeId/assigneeUser mirror the
  // first entry for legacy single-assignee paths.
  assignees?: {
    id: string;
    name: string;
    color: string;
    handle?: string | null;
  }[];
  order: number;
  priority: string;
  movedByNonAssignee: boolean;
  comments?: Comment[];
  commentCount?: number;
  _count?: {
    comments?: number;
  };
  tags?: Tag[];
  activities?: TaskActivity[];
  attachments?: Attachment[];
}

export interface TaskActivity {
  id: string;
  type: string;
  content: string;
  userId: string;
  taskId: string;
  createdAt: string | Date;
  user?: {
    id: string;
    name: string;
    color: string;
    handle?: string | null;
  };
}

export interface BoardMemberData {
  id: string;
  name: string;
  color: string;
  email: string;
  handle?: string | null;
  role?: string;
  classRole?: string | null;
}

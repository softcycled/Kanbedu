"use client";

import { useState, useCallback } from "react";
import { Task } from "@/lib/types";
import Board from "./Board";
import Header from "./Header";

interface Props {
  initialTasks: Task[];
}

export default function BoardContainer({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const handleTasksUpdate = useCallback((updatedTasks: Task[]) => {
    setTasks(updatedTasks);
  }, []);

  return (
    <>
      <Header tasks={tasks} />
      <main className="flex-1 px-8 py-8 overflow-hidden flex flex-col">
        <Board initialTasks={tasks} onTasksUpdate={handleTasksUpdate} />
      </main>
    </>
  );
}

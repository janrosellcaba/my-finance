"use client";

import { useCallback, useEffect, useState } from "react";
import { type Todo, formatDate } from "../shared";
import { AddTodoModal } from "./AddTodoModal";
import { IconCheckSquare, IconTrash } from "./icons";

function TodoRow({ todo, onToggle, onDelete }: { todo: Todo; onToggle: () => void; onDelete: () => void }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <button
                type="button"
                onClick={onToggle}
                aria-label={todo.completed ? "Mark as not done" : "Mark as done"}
                className={`shrink-0 rounded-lg transition-colors duration-150 ${
                    todo.completed ? "text-brand" : "text-line hover:text-muted"
                }`}
            >
                <IconCheckSquare className="h-6 w-6" checked={todo.completed} />
            </button>
            <div className="min-w-0 flex-1">
                <p className={`truncate font-medium ${todo.completed ? "text-muted line-through" : "text-ink"}`}>
                    {todo.text}
                </p>
                {todo.dueDate && <p className="text-xs text-muted">{formatDate(todo.dueDate)}</p>}
            </div>
            <button
                type="button"
                onClick={onDelete}
                aria-label="Delete task"
                className="shrink-0 rounded-full p-2 text-muted transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
            >
                <IconTrash className="h-4 w-4" />
            </button>
        </div>
    );
}

export function TodoView() {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    const loadTodos = useCallback(async () => {
        const res = await fetch("/api/todos");
        const data = (await res.json()) as { success: boolean; todos?: Todo[] };
        if (data.success && data.todos) setTodos(data.todos);
    }, []);

    useEffect(() => {
        setLoading(true);
        loadTodos().finally(() => setLoading(false));
    }, [loadTodos]);

    async function handleToggle(t: Todo) {
        setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !t.completed } : x)));
        await fetch("/api/todos", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: t.id, completed: !t.completed }),
        });
    }

    async function handleDelete(id: string) {
        setTodos((prev) => prev.filter((x) => x.id !== id));
        await fetch("/api/todos", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
    }

    const active = todos.filter((t) => !t.completed);
    const completed = todos.filter((t) => t.completed);

    return (
        <div className="space-y-4 px-5 pt-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-extrabold text-ink">To-Do</h1>
                <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-ink/90 hover:shadow-md active:translate-y-0 select-none"
                >
                    + Add
                </button>
            </div>

            {loading ? (
                <p className="pt-10 text-center text-muted">Loading…</p>
            ) : (
                <>
                    {active.length === 0 ? (
                        <p className="pt-10 text-center text-muted">No tasks yet. Add one to get started.</p>
                    ) : (
                        <div className="divide-y divide-line rounded-2xl border border-line bg-paper shadow-sm">
                            {active.map((t) => (
                                <TodoRow
                                    key={t.id}
                                    todo={t}
                                    onToggle={() => handleToggle(t)}
                                    onDelete={() => handleDelete(t.id)}
                                />
                            ))}
                        </div>
                    )}

                    {completed.length > 0 && (
                        <div className="space-y-2 pt-2">
                            <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
                                Completed · {completed.length}
                            </h2>
                            <div className="divide-y divide-line rounded-2xl border border-line bg-paper shadow-sm">
                                {completed.map((t) => (
                                    <TodoRow
                                        key={t.id}
                                        todo={t}
                                        onToggle={() => handleToggle(t)}
                                        onDelete={() => handleDelete(t.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {showAddModal && (
                <AddTodoModal
                    onClose={() => setShowAddModal(false)}
                    onSaved={() => {
                        setShowAddModal(false);
                        loadTodos();
                    }}
                />
            )}
        </div>
    );
}

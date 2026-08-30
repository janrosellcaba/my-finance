"use client";

import { useCallback, useEffect, useState } from "react";
import { type Todo, formatDate } from "../shared";
import { AddTodoModal } from "./AddTodoModal";
import { useUndoToast } from "./UndoToastProvider";
import { IconCheckSquare, IconTrash } from "./icons";

function TodoRow({
    todo,
    onToggle,
    onDelete,
    onEdit,
}: {
    todo: Todo;
    onToggle: () => void;
    onDelete: () => void;
    onEdit: () => void;
}) {
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
            <button type="button" onClick={onEdit} aria-label="Edit task" className="min-w-0 flex-1 text-left">
                <p
                    className={`truncate font-medium ${
                        todo.completed ? "text-muted line-through" : "text-ink hover:text-brand"
                    }`}
                >
                    {todo.text}
                </p>
                {todo.dueDate && <p className="text-xs text-muted">Due {formatDate(todo.dueDate)}</p>}
            </button>
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
    const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
    const { requestDelete } = useUndoToast();

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

    function handleDelete(id: string) {
        setPendingDeleteIds((prev) => new Set(prev).add(id));
        requestDelete({
            message: "Task deleted.",
            onUndo: () => {
                setPendingDeleteIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            },
            onCommit: async () => {
                await fetch("/api/todos", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id }),
                });
                setTodos((prev) => prev.filter((x) => x.id !== id));
                setPendingDeleteIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            },
        });
    }

    const visibleTodos = todos.filter((t) => !pendingDeleteIds.has(t.id));
    const active = visibleTodos.filter((t) => !t.completed);
    const completed = visibleTodos.filter((t) => t.completed);

    return (
        <div className="space-y-4 px-5 pt-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-extrabold text-ink">To-Do</h1>
                <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-ink/90 hover:shadow-md active:translate-y-0 select-none"
                >
                    + Add
                </button>
            </div>

            {loading ? (
                <p className="pt-10 text-center text-muted">Loading…</p>
            ) : (
                <>
                    {active.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                                <IconCheckSquare className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="font-bold text-ink">All caught up!</p>
                                <p className="mt-0.5 text-xs text-muted">No pending financial tasks or reminders.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(true)}
                                className="mt-2 rounded-xl bg-chip px-4 py-2 text-xs font-bold text-ink transition-colors hover:bg-chip-hover"
                            >
                                + Create a task
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-line rounded-2xl border border-line bg-paper shadow-sm">
                            {active.map((t) => (
                                <TodoRow
                                    key={t.id}
                                    todo={t}
                                    onToggle={() => handleToggle(t)}
                                    onDelete={() => handleDelete(t.id)}
                                    onEdit={() => setEditingTodo(t)}
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
                                        onEdit={() => setEditingTodo(t)}
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

            {editingTodo && (
                <AddTodoModal
                    todo={editingTodo}
                    onClose={() => setEditingTodo(null)}
                    onSaved={() => {
                        setEditingTodo(null);
                        loadTodos();
                    }}
                />
            )}
        </div>
    );
}

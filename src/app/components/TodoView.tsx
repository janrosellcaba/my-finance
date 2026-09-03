"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { type Todo, INK_BTN } from "../shared";
import { AddTodoModal } from "./AddTodoModal";
import { SortableTodoRow, TodoRow } from "./SortableTodoRow";
import { useUndoToast } from "./UndoToastProvider";
import { IconCheckSquare } from "./icons";

function bySortOrder(a: Todo, b: Todo) {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return b.createdAt.localeCompare(a.createdAt);
}

export function TodoView() {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addParentId, setAddParentId] = useState<string | null>(null);
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

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    async function handleToggle(t: Todo) {
        const nextCompleted = !t.completed;
        setTodos((prev) =>
            prev.map((x) => {
                if (x.id === t.id) return { ...x, completed: nextCompleted };
                // Completing a parent completes its subtasks too (matches API).
                if (nextCompleted && !t.parentId && x.parentId === t.id) {
                    return { ...x, completed: true };
                }
                return x;
            }),
        );
        await fetch("/api/todos", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: t.id, completed: nextCompleted }),
        });
    }

    function handleDelete(id: string) {
        const childIds = todos.filter((t) => t.parentId === id).map((t) => t.id);
        const idsToHide = [id, ...childIds];
        setPendingDeleteIds((prev) => {
            const next = new Set(prev);
            idsToHide.forEach((x) => next.add(x));
            return next;
        });
        requestDelete({
            message: childIds.length > 0 ? "Task and subtasks deleted." : "Task deleted.",
            onUndo: () => {
                setPendingDeleteIds((prev) => {
                    const next = new Set(prev);
                    idsToHide.forEach((x) => next.delete(x));
                    return next;
                });
            },
            onCommit: async () => {
                await fetch("/api/todos", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id }),
                });
                setTodos((prev) => prev.filter((x) => x.id !== id && x.parentId !== id));
                setPendingDeleteIds((prev) => {
                    const next = new Set(prev);
                    idsToHide.forEach((x) => next.delete(x));
                    return next;
                });
            },
        });
    }

    async function persistReorder(parentId: string | null, orderedIds: string[]) {
        const res = await fetch("/api/todos", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reorder", parentId, orderedIds }),
        });
        return res.ok;
    }

    function applyLocalOrder(parentId: string | null, orderedIds: string[]) {
        setTodos((prev) =>
            prev.map((t) => {
                if ((t.parentId ?? null) !== parentId) return t;
                const index = orderedIds.indexOf(t.id);
                if (index === -1) return t;
                return { ...t, sortOrder: index };
            }),
        );
    }

    async function handleDragEnd(event: DragEndEvent, parentId: string | null, items: Todo[]) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex((x) => x.id === active.id);
        const newIndex = items.findIndex((x) => x.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(items, oldIndex, newIndex);
        const orderedIds = reordered.map((x) => x.id);
        const previous = todos;
        applyLocalOrder(parentId, orderedIds);
        const ok = await persistReorder(parentId, orderedIds);
        if (!ok) setTodos(previous);
    }

    const visibleTodos = useMemo(
        () => todos.filter((t) => !pendingDeleteIds.has(t.id)),
        [todos, pendingDeleteIds],
    );

    const activeRoots = useMemo(
        () => visibleTodos.filter((t) => !t.parentId && !t.completed).sort(bySortOrder),
        [visibleTodos],
    );

    const childrenByParent = useMemo(() => {
        const map = new Map<string, Todo[]>();
        for (const t of visibleTodos) {
            if (!t.parentId) continue;
            // Under an active parent, show all children (done ones stay indented with strikethrough).
            const list = map.get(t.parentId) ?? [];
            list.push(t);
            map.set(t.parentId, list);
        }
        for (const [key, list] of map) {
            map.set(
                key,
                list.sort((a, b) => {
                    if (a.completed !== b.completed) return a.completed ? 1 : -1;
                    return bySortOrder(a, b);
                }),
            );
        }
        return map;
    }, [visibleTodos]);

    const completedRoots = useMemo(
        () => visibleTodos.filter((t) => !t.parentId && t.completed).sort(bySortOrder),
        [visibleTodos],
    );

    function openAdd(parentId: string | null = null) {
        setAddParentId(parentId);
        setShowAddModal(true);
    }

    function closeAdd() {
        setShowAddModal(false);
        setAddParentId(null);
    }

    return (
        <div className="space-y-4 px-5 pt-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-extrabold text-ink">To-Do</h1>
                <button type="button" onClick={() => openAdd()} className={`${INK_BTN} px-4 py-2 text-sm`}>
                    + Add
                </button>
            </div>

            {loading ? (
                <p className="pt-10 text-center text-muted">Loading…</p>
            ) : (
                <>
                    {activeRoots.length === 0 ? (
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
                                onClick={() => openAdd()}
                                className="mt-2 rounded-xl bg-chip px-4 py-2 text-xs font-bold text-ink transition-colors hover:bg-chip-hover"
                            >
                                + Create a task
                            </button>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(e) => handleDragEnd(e, null, activeRoots)}
                        >
                            <SortableContext
                                items={activeRoots.map((t) => t.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="divide-y divide-line overflow-hidden surface rounded-2xl">
                                    {activeRoots.map((root) => {
                                        const children = childrenByParent.get(root.id) ?? [];
                                        const activeChildren = children.filter((c) => !c.completed);
                                        const doneChildren = children.filter((c) => c.completed);

                                        return (
                                            <div key={root.id}>
                                                <SortableTodoRow
                                                    todo={root}
                                                    onToggle={() => handleToggle(root)}
                                                    onDelete={() => handleDelete(root.id)}
                                                    onEdit={() => setEditingTodo(root)}
                                                    onAddSubtask={() => openAdd(root.id)}
                                                />
                                                {activeChildren.length > 0 && (
                                                    <NestedSortableList
                                                        parentId={root.id}
                                                        items={activeChildren}
                                                        sensors={sensors}
                                                        onDragEnd={handleDragEnd}
                                                        onToggle={handleToggle}
                                                        onDelete={handleDelete}
                                                        onEdit={setEditingTodo}
                                                    />
                                                )}
                                                {doneChildren.map((child) => (
                                                    <TodoRow
                                                        key={child.id}
                                                        todo={child}
                                                        depth={1}
                                                        reserveHandleSlot
                                                        onToggle={() => handleToggle(child)}
                                                        onDelete={() => handleDelete(child.id)}
                                                        onEdit={() => setEditingTodo(child)}
                                                    />
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}

                    {completedRoots.length > 0 && (
                        <div className="space-y-2 pt-2">
                            <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
                                Completed · {completedRoots.length}
                            </h2>
                            <div className="divide-y divide-line surface rounded-2xl">
                                {completedRoots.map((root) => {
                                    const children = childrenByParent.get(root.id) ?? [];
                                    return (
                                        <div key={root.id}>
                                            <TodoRow
                                                todo={root}
                                                onToggle={() => handleToggle(root)}
                                                onDelete={() => handleDelete(root.id)}
                                                onEdit={() => setEditingTodo(root)}
                                            />
                                            {children.map((child) => (
                                                <TodoRow
                                                    key={child.id}
                                                    todo={child}
                                                    depth={1}
                                                    onToggle={() => handleToggle(child)}
                                                    onDelete={() => handleDelete(child.id)}
                                                    onEdit={() => setEditingTodo(child)}
                                                />
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {showAddModal && (
                <AddTodoModal
                    parentId={addParentId}
                    onClose={closeAdd}
                    onSaved={() => {
                        closeAdd();
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

function NestedSortableList({
    parentId,
    items,
    sensors,
    onDragEnd,
    onToggle,
    onDelete,
    onEdit,
}: {
    parentId: string;
    items: Todo[];
    sensors: ReturnType<typeof useSensors>;
    onDragEnd: (event: DragEndEvent, parentId: string | null, items: Todo[]) => void;
    onToggle: (t: Todo) => void;
    onDelete: (id: string) => void;
    onEdit: (t: Todo) => void;
}) {
    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => onDragEnd(e, parentId, items)}
        >
            <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {items.map((child) => (
                    <SortableTodoRow
                        key={child.id}
                        todo={child}
                        depth={1}
                        onToggle={() => onToggle(child)}
                        onDelete={() => onDelete(child.id)}
                        onEdit={() => onEdit(child)}
                    />
                ))}
            </SortableContext>
        </DndContext>
    );
}

"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ReactNode } from "react";
import { type Todo, formatDate } from "../shared";
import { IconCheckSquare, IconGrip, IconTrash } from "./icons";

function TodoRowContent({
    todo,
    depth = 0,
    dragHandle,
    onToggle,
    onDelete,
    onEdit,
    onAddSubtask,
    isDragging,
}: {
    todo: Todo;
    depth?: number;
    dragHandle?: ReactNode;
    onToggle: () => void;
    onDelete: () => void;
    onEdit: () => void;
    onAddSubtask?: () => void;
    isDragging?: boolean;
}) {
    return (
        <div
            className={`flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 ${
                depth > 0 ? "bg-chip/40 pl-10 sm:pl-12" : ""
            } ${isDragging ? "relative z-10 bg-paper shadow-md ring-1 ring-brand/30" : ""}`}
        >
            {dragHandle}
            <button
                type="button"
                onClick={onToggle}
                aria-label={todo.completed ? "Mark as not done" : "Mark as done"}
                className={`shrink-0 rounded-lg transition-colors duration-150 ${
                    todo.completed ? "text-brand" : "text-line hover:text-muted"
                }`}
            >
                <IconCheckSquare className="h-5 w-5 sm:h-6 sm:w-6" checked={todo.completed} />
            </button>
            <button type="button" onClick={onEdit} aria-label="Edit task" className="min-w-0 flex-1 text-left">
                <p
                    className={`truncate text-sm font-medium sm:text-base ${
                        todo.completed ? "text-muted line-through" : "text-ink hover:text-brand"
                    }`}
                >
                    {todo.text}
                </p>
                {todo.dueDate && <p className="text-xs text-muted">Due {formatDate(todo.dueDate)}</p>}
            </button>
            {onAddSubtask && (
                <button
                    type="button"
                    onClick={onAddSubtask}
                    aria-label="Add subtask"
                    title="Add subtask"
                    className="shrink-0 rounded-full px-2 py-1 text-sm font-bold text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                >
                    +
                </button>
            )}
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

export function TodoRow({
    todo,
    depth = 0,
    reserveHandleSlot = false,
    onToggle,
    onDelete,
    onEdit,
    onAddSubtask,
}: {
    todo: Todo;
    depth?: number;
    reserveHandleSlot?: boolean;
    onToggle: () => void;
    onDelete: () => void;
    onEdit: () => void;
    onAddSubtask?: () => void;
}) {
    return (
        <TodoRowContent
            todo={todo}
            depth={depth}
            onToggle={onToggle}
            onDelete={onDelete}
            onEdit={onEdit}
            onAddSubtask={onAddSubtask}
            dragHandle={reserveHandleSlot ? <span className="w-7 shrink-0" aria-hidden /> : undefined}
        />
    );
}

export function SortableTodoRow({
    todo,
    depth = 0,
    onToggle,
    onDelete,
    onEdit,
    onAddSubtask,
}: {
    todo: Todo;
    depth?: number;
    onToggle: () => void;
    onDelete: () => void;
    onEdit: () => void;
    onAddSubtask?: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style}>
            <TodoRowContent
                todo={todo}
                depth={depth}
                isDragging={isDragging}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                onAddSubtask={onAddSubtask}
                dragHandle={
                    <button
                        type="button"
                        {...attributes}
                        {...listeners}
                        aria-label={`Reorder ${todo.text}`}
                        className="shrink-0 cursor-grab touch-none rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink active:cursor-grabbing"
                    >
                        <IconGrip className="h-4 w-4" />
                    </button>
                }
            />
        </div>
    );
}

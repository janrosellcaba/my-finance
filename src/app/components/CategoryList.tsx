"use client";

import { useEffect, useState } from "react";
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
import { type Category } from "../shared";
import { SortableCategoryRow } from "./SortableCategoryRow";

export function CategoryList({
    title,
    type,
    items,
    onReorder,
    onSetDefault,
    onSetColor,
    onRename,
    onDelete,
}: {
    title: string;
    type: "income" | "expense";
    items: Category[];
    onReorder: (type: "income" | "expense", orderedIds: string[]) => Promise<boolean>;
    onSetDefault: (c: Category) => void;
    onSetColor: (c: Category, color: string) => void;
    onRename: (c: Category, name: string) => void;
    onDelete: (c: Category) => void;
}) {
    const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [localItems, setLocalItems] = useState(items);

    useEffect(() => {
        setLocalItems(items);
    }, [items]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    function startEditing(c: Category) {
        setEditingId(c.id);
        setEditingValue(c.name);
    }

    function commitEditing(c: Category) {
        const trimmed = editingValue.trim();
        if (trimmed && trimmed !== c.name) {
            onRename(c, trimmed);
        }
        setEditingId(null);
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = localItems.findIndex((x) => x.id === active.id);
        const newIndex = localItems.findIndex((x) => x.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const previous = localItems;
        const reordered = arrayMove(localItems, oldIndex, newIndex);
        setLocalItems(reordered);
        const ok = await onReorder(type, reordered.map((x) => x.id));
        if (!ok) setLocalItems(previous);
    }

    return (
        <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
            {localItems.length === 0 ? (
                <p className="text-sm text-muted">No categories yet.</p>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={localItems.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                            {localItems.map((c) => (
                                <SortableCategoryRow
                                    key={c.id}
                                    category={c}
                                    isColorPickerOpen={colorPickerFor === c.id}
                                    onToggleColorPicker={() => setColorPickerFor(colorPickerFor === c.id ? null : c.id)}
                                    onSetDefault={() => onSetDefault(c)}
                                    onSetColor={(color) => {
                                        onSetColor(c, color);
                                        setColorPickerFor(null);
                                    }}
                                    onDelete={() => onDelete(c)}
                                    isEditing={editingId === c.id}
                                    editingValue={editingValue}
                                    onStartEditing={() => startEditing(c)}
                                    onEditingValueChange={setEditingValue}
                                    onCommitEditing={() => commitEditing(c)}
                                    onCancelEditing={() => setEditingId(null)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}

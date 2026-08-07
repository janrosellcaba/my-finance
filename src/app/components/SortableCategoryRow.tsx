"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Category, CATEGORY_COLOR_PALETTE, CATEGORY_ICON_KEYS } from "../shared";
import { CATEGORY_ICON_COMPONENTS, CategoryIcon, IconClose, IconGrip, IconPencil, IconRadioDot } from "./icons";

export function SortableCategoryRow({
    category,
    isColorPickerOpen,
    onToggleColorPicker,
    isIconPickerOpen,
    onToggleIconPicker,
    onSetDefault,
    onSetColor,
    onSetIcon,
    onDelete,
    isEditing,
    editingValue,
    onStartEditing,
    onEditingValueChange,
    onCommitEditing,
    onCancelEditing,
}: {
    category: Category;
    isColorPickerOpen: boolean;
    onToggleColorPicker: () => void;
    isIconPickerOpen: boolean;
    onToggleIconPicker: () => void;
    onSetDefault: () => void;
    onSetColor: (color: string) => void;
    onSetIcon: (icon: string | null) => void;
    onDelete: () => void;
    isEditing: boolean;
    editingValue: string;
    onStartEditing: () => void;
    onEditingValueChange: (value: string) => void;
    onCommitEditing: () => void;
    onCancelEditing: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style} className="relative bg-paper">
            <div className={`flex items-center gap-1 px-2 py-2 ${isDragging ? "shadow-md ring-1 ring-brand/30" : ""}`}>
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label={`Reorder ${category.name}`}
                    className="shrink-0 cursor-grab touch-none rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink active:cursor-grabbing"
                >
                    <IconGrip className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={onSetDefault}
                    role="radio"
                    aria-checked={category.isDefault}
                    title={category.isDefault ? "Default category" : "Set as default"}
                    aria-label={category.isDefault ? `${category.name} is the default` : `Set ${category.name} as default`}
                    className={`shrink-0 rounded-full p-1.5 transition-colors duration-150 ${
                        category.isDefault ? "text-brand" : "text-muted hover:text-ink"
                    }`}
                >
                    <IconRadioDot className="h-4 w-4" checked={category.isDefault} />
                </button>
                <button
                    type="button"
                    onClick={onToggleColorPicker}
                    aria-label={`Change color for ${category.name}`}
                    className="h-5 w-5 shrink-0 rounded-full border border-line/50"
                    style={{ backgroundColor: category.color ?? "#e5e0d8" }}
                />
                <button
                    type="button"
                    onClick={onToggleIconPicker}
                    aria-label={`Change icon for ${category.name}`}
                    className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink"
                >
                    {category.icon ? (
                        <CategoryIcon iconKey={category.icon} className="h-4 w-4" />
                    ) : (
                        <span className="block h-4 w-4 rounded border border-dashed border-line" />
                    )}
                </button>
                {isEditing ? (
                    <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => onEditingValueChange(e.target.value)}
                        onBlur={onCommitEditing}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                onCommitEditing();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                onCancelEditing();
                            }
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                ) : (
                    <>
                        <span className="min-w-0 flex-1 truncate pl-2 text-sm font-medium text-ink">{category.name}</span>
                        <button
                            type="button"
                            onClick={onStartEditing}
                            aria-label={`Rename ${category.name}`}
                            className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink"
                        >
                            <IconPencil className="h-4 w-4" />
                        </button>
                    </>
                )}
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label={`Delete ${category.name}`}
                    className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                >
                    <IconClose className="h-4 w-4" />
                </button>
            </div>
            {isColorPickerOpen && (
                <div className="flex flex-wrap gap-2 border-t border-line bg-chip px-3 py-3">
                    {CATEGORY_COLOR_PALETTE.map((swatch) => (
                        <button
                            key={swatch}
                            type="button"
                            onClick={() => onSetColor(swatch)}
                            aria-label={`Set ${category.name} color to ${swatch}`}
                            className={`h-6 w-6 shrink-0 rounded-full border-2 transition-transform duration-150 hover:scale-110 ${
                                category.color === swatch ? "border-ink" : "border-white/60"
                            }`}
                            style={{ backgroundColor: swatch }}
                        />
                    ))}
                </div>
            )}
            {isIconPickerOpen && (
                <div className="flex flex-wrap gap-2 border-t border-line bg-chip px-3 py-3">
                    <button
                        type="button"
                        onClick={() => onSetIcon(null)}
                        aria-label={`Remove icon from ${category.name}`}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-transform duration-150 hover:scale-110 ${
                            category.icon === null ? "border-ink bg-paper" : "border-white/60 bg-paper"
                        }`}
                    >
                        <IconClose className="h-3.5 w-3.5 text-muted" />
                    </button>
                    {CATEGORY_ICON_KEYS.map((key) => {
                        const Icon = CATEGORY_ICON_COMPONENTS[key];
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onSetIcon(key)}
                                aria-label={`Set ${category.name} icon to ${key}`}
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-paper text-ink transition-transform duration-150 hover:scale-110 ${
                                    category.icon === key ? "border-ink" : "border-white/60"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

"use client";

import { IconChevronRight } from "./icons";

export function MenuRow({
    label,
    onClick,
    danger = false,
    chevron = true,
    last = false,
}: {
    label: string;
    onClick: () => void;
    danger?: boolean;
    chevron?: boolean;
    last?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-150 select-none ${
                last ? "" : "border-b border-line"
            } ${danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-chip"}`}
        >
            <span className="flex-1 text-base font-semibold">{label}</span>
            {chevron && <IconChevronRight className="h-4 w-4 shrink-0 text-muted" />}
        </button>
    );
}

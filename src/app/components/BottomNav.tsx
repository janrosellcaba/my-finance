"use client";

import { type ReactElement } from "react";
import { type Tab } from "../shared";
import { IconChart, IconCheckSquare, IconHome, IconList, IconSettings } from "./icons";

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
    const items: { key: Tab; label: string; Icon: (props: { className?: string }) => ReactElement }[] = [
        { key: "home", label: "Home", Icon: IconHome },
        { key: "transactions", label: "Transactions", Icon: IconList },
        { key: "todo", label: "To-Do", Icon: IconCheckSquare },
        { key: "analytics", label: "Analytics", Icon: IconChart },
        { key: "config", label: "Settings", Icon: IconSettings },
    ];

    return (
        <nav className="shrink-0 border-t border-line bg-paper/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
            <div className="mx-auto flex max-w-md px-1">
                {items.map(({ key, label, Icon }) => {
                    const isActive = active === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onChange(key)}
                            className={`group relative flex flex-1 flex-col items-center gap-1 py-2 text-xs font-bold transition-all duration-150 select-none ${
                                isActive ? "text-brand" : "text-muted hover:text-ink"
                            }`}
                        >
                            <span
                                className={`flex h-7 w-12 items-center justify-center rounded-full transition-all duration-200 ${
                                    isActive
                                        ? "bg-brand/12 scale-105 shadow-xs"
                                        : "group-hover:bg-chip/60"
                                }`}
                            >
                                <Icon className="h-5 w-5" />
                            </span>
                            <span className="text-[11px] leading-tight font-medium">{label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

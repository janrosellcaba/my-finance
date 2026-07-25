"use client";

import { type ReactElement } from "react";
import { type Tab } from "../shared";
import { IconChart, IconHome, IconList, IconSettings } from "./icons";

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
    const items: { key: Tab; label: string; Icon: (props: { className?: string }) => ReactElement }[] = [
        { key: "home", label: "Home", Icon: IconHome },
        { key: "transactions", label: "Transactions", Icon: IconList },
        { key: "analytics", label: "Analytics", Icon: IconChart },
        { key: "config", label: "Settings", Icon: IconSettings },
    ];

    return (
        <nav className="shrink-0 border-t border-line bg-paper/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
            <div className="mx-auto flex max-w-md">
                {items.map(({ key, label, Icon }) => {
                    const isActive = active === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onChange(key)}
                            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-bold transition-all duration-150 select-none ${
                                isActive ? "text-brand" : "text-muted hover:-translate-y-0.5 hover:text-ink"
                            }`}
                        >
                            <Icon className="h-6 w-6" />
                            {label}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

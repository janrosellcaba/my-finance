"use client";

import { useState } from "react";
import { INPUT_CLS } from "../shared";
import { IconEye, IconEyeOff } from "./icons";

export function PasswordInput({
    value,
    onChange,
    autoComplete,
    required,
    minLength,
}: {
    value: string;
    onChange: (value: string) => void;
    autoComplete?: string;
    required?: boolean;
    minLength?: number;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <input
                type={visible ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                minLength={minLength}
                autoComplete={autoComplete}
                className={`pr-11 ${INPUT_CLS}`}
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
            >
                {visible ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
            </button>
        </div>
    );
}

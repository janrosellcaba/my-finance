import { type ReactElement } from "react";
import { type AccountIconKey, type CategoryIconKey } from "../shared";

export function IconHome({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11.5 12 4l8 7.5" />
            <path d="M6 10.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-8.5" />
        </svg>
    );
}

export function IconList({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M8 9h8M8 12.5h8M8 16h5" />
        </svg>
    );
}

export function IconSettings({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="9" cy="6" r="2.1" fill="currentColor" />
            <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="15" cy="12" r="2.1" fill="currentColor" />
            <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="7" cy="18" r="2.1" fill="currentColor" />
        </svg>
    );
}

export function IconClose({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
        </svg>
    );
}

export function IconEye({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

export function IconEyeOff({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18" />
            <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a13.5 13.5 0 0 1-3.1 3.9M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.4-.9" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </svg>
    );
}

export function IconChart({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="12" width="4" height="8" rx="1" />
            <rect x="10" y="8" width="4" height="12" rx="1" />
            <rect x="16" y="4" width="4" height="16" rx="1" />
        </svg>
    );
}

export function IconChevronRight({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
        </svg>
    );
}

export function IconArrowLeft({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
    );
}

export function IconArrowUpRight({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7M7 7h10v10" />
        </svg>
    );
}

export function IconArrowDownRight({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 7 17 17M17 7v10H7" />
        </svg>
    );
}

export function IconArrowLeftRight({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 7h12M17 4l3 3-3 3M16 17H4M7 14l-3 3 3 3" />
        </svg>
    );
}

export function IconSearch({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </svg>
    );
}

export function IconFilter({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16M7 12h10M10 19h4" />
        </svg>
    );
}

export function IconRadioDot({ className, checked }: { className?: string; checked?: boolean }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="8" />
            {checked && <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />}
        </svg>
    );
}

export function IconPencil({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            <path d="M14.5 5.5l3 3" />
        </svg>
    );
}

export function IconCheckSquare({ className, checked }: { className?: string; checked?: boolean }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill={checked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="4" y="4" width="16" height="16" rx="5" fill={checked ? "currentColor" : "none"} />
            {checked && <path d="m8.5 12.5 2.5 2.5 5-5" stroke="white" />}
        </svg>
    );
}

export function IconTrash({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.8 12a2 2 0 0 1-2 1.9H9.8a2 2 0 0 1-2-1.9L7 7" />
            <path d="M10 11v6M14 11v6" />
        </svg>
    );
}

export function IconGrip({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
            <circle cx="9" cy="6" r="1.4" />
            <circle cx="15" cy="6" r="1.4" />
            <circle cx="9" cy="12" r="1.4" />
            <circle cx="15" cy="12" r="1.4" />
            <circle cx="9" cy="18" r="1.4" />
            <circle cx="15" cy="18" r="1.4" />
        </svg>
    );
}

// ---------- category icon picker set ----------

export function IconUtensils({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2v7a2 2 0 0 0 4 0V2M8 9v13" />
            <path d="M17 2c-1.7 0-3 2-3 5s1.3 5 3 5M17 2v18" />
        </svg>
    );
}

export function IconCar({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16 5.5 10.5A2 2 0 0 1 7.4 9h9.2a2 2 0 0 1 1.9 1.5L20 16" />
            <rect x="2.5" y="16" width="19" height="4" rx="1.5" />
            <circle cx="7" cy="20.3" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="17" cy="20.3" r="1.3" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function IconShoppingBag({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
    );
}

export function IconBolt({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" />
        </svg>
    );
}

export function IconBriefcase({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7.5" width="18" height="12" rx="2" />
            <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
            <path d="M3 12.5h18" />
        </svg>
    );
}

export function IconTrendingUp({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17 9.5 10.5 13.5 14.5 21 7" />
            <path d="M15 7h6v6" />
        </svg>
    );
}

export function IconGift({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="9" width="17" height="4" rx="1" />
            <path d="M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 9v12" />
            <path d="M12 9C10.5 9 8 8.2 8 6a2 2 0 1 1 4 0 2 2 0 1 1 4 0c0 2.2-2.5 3-4 3Z" />
        </svg>
    );
}

export function IconHeart({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20.5s-8-5-8-11.2A4.3 4.3 0 0 1 12 6a4.3 4.3 0 0 1 8 3.3c0 6.2-8 11.2-8 11.2Z" />
        </svg>
    );
}

export function IconFilm({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9h18M3 15h18M8 4v16M16 4v16" />
        </svg>
    );
}

export function IconPlane({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 3 3 10.5l7 2.5M21 3 13.5 21l-2.5-8M21 3 10 13.5" />
        </svg>
    );
}

export function IconBook({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4.5A2 2 0 0 1 6 3h5v18H6a2 2 0 0 1-2-2Z" />
            <path d="M20 4.5A2 2 0 0 0 18 3h-5v18h5a2 2 0 0 0 2-2Z" />
        </svg>
    );
}

export const CATEGORY_ICON_COMPONENTS: Record<CategoryIconKey, (props: { className?: string }) => ReactElement> = {
    food: IconUtensils,
    transport: IconCar,
    shopping: IconShoppingBag,
    services: IconBolt,
    salary: IconBriefcase,
    investments: IconTrendingUp,
    gift: IconGift,
    home: IconHome,
    health: IconHeart,
    entertainment: IconFilm,
    travel: IconPlane,
    education: IconBook,
};

export function CategoryIcon({ iconKey, className }: { iconKey: string | null; className?: string }) {
    if (!iconKey || !(iconKey in CATEGORY_ICON_COMPONENTS)) return null;
    const Icon = CATEGORY_ICON_COMPONENTS[iconKey as CategoryIconKey];
    return <Icon className={className} />;
}

// ---------- account icon picker set ----------

export function IconBank({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 3 8h18L12 3Z" />
            <path d="M5 8v10M9 8v10M15 8v10M19 8v10" />
            <path d="M3 21h18" />
        </svg>
    );
}

export function IconWallet({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
            <path d="M16 12.5h3.5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H16a1.5 1.5 0 0 1 0-4Z" />
        </svg>
    );
}

export function IconCard({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="6" width="19" height="13" rx="2.2" />
            <path d="M2.5 10.5h19" />
            <path d="M6 15h4" />
        </svg>
    );
}

export function IconCash({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="M5.5 9v.01M18.5 15v.01" />
        </svg>
    );
}

export function IconPiggyBank({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5c0-3 2.6-5.5 6-5.8V5l2 1.3 2-1.3v1.7c2 .5 3.5 2 3.9 3.8H19a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1.1c-.4 1.9-2 3.4-4 3.9V19h-2v-1.1a7 7 0 0 1-1-.1V19H9v-1.6c-3-.9-5-3.6-5-6.9Z" />
            <circle cx="14.5" cy="10.5" r=".6" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function IconSafe({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 12V9.8" />
            <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01" />
        </svg>
    );
}

export const ACCOUNT_ICON_COMPONENTS: Record<AccountIconKey, (props: { className?: string }) => ReactElement> = {
    bank: IconBank,
    wallet: IconWallet,
    card: IconCard,
    cash: IconCash,
    piggybank: IconPiggyBank,
    safe: IconSafe,
};

export function AccountIcon({ iconKey, className }: { iconKey: string | null; className?: string }) {
    if (!iconKey || !(iconKey in ACCOUNT_ICON_COMPONENTS)) return null;
    const Icon = ACCOUNT_ICON_COMPONENTS[iconKey as AccountIconKey];
    return <Icon className={className} />;
}

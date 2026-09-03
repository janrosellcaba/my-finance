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
            <path d="M4.5 3.5v6.2c0 1.4 1.1 2.5 2.5 2.5h2c1.4 0 2.5-1.1 2.5-2.5V3.5" />
            <path d="M8.5 3.5v17" />
            <path d="M16.5 3.5v17" />
            <path d="M16.5 3.5a5.25 5.25 0 0 1 0 10.5" />
        </svg>
    );
}

export function IconCar({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15.5 5.8 10a2 2 0 0 1 1.9-1.4h8.6A2 2 0 0 1 18.2 10L20 15.5" />
            <path d="M3.5 15.5h17v2.2a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3Z" />
            <circle cx="7.2" cy="19.5" r="1.2" />
            <circle cx="16.8" cy="19.5" r="1.2" />
            <path d="M8 12.5h8" />
        </svg>
    );
}

export function IconShoppingBag({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 8.5h11l-.9 11a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8Z" />
            <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
        </svg>
    );
}

export function IconWrench({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" />
            <circle cx="12" cy="12" r="7.2" />
        </svg>
    );
}

export function IconBolt({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2 6 13h5l-1 9 7-11h-5l1-9Z" />
        </svg>
    );
}

export function IconBriefcase({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
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
            <rect x="4" y="9" width="16" height="3.5" rx="1" />
            <path d="M5.5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6.5M12 9v11.5" />
            <path d="M12 9c-1.4 0-3.5-.8-3.5-2.5a1.75 1.75 0 1 1 3.5 0 1.75 1.75 0 1 1 3.5 0C15.5 8.2 13.4 9 12 9Z" />
        </svg>
    );
}

export function IconHeart({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20S4.5 15.2 4.5 9.6A3.9 3.9 0 0 1 12 7.2a3.9 3.9 0 0 1 7.5 2.4C19.5 15.2 12 20 12 20Z" />
        </svg>
    );
}

export function IconTicket({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 9.5A2 2 0 0 0 5.5 11.5 2 2 0 0 0 3.5 13.5v3a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2 2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-13a2 2 0 0 0-2 2Z" />
            <path d="M9.5 7.5v11" strokeDasharray="2 2.5" />
        </svg>
    );
}

export function IconPlane({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2-7H7L5 16H3l1.8-4L3 8h2l2 2h4L9 3h3z" />
        </svg>
    );
}

export function IconBook({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4.5A2 2 0 0 1 7 3h11v16.5H7a2 2 0 0 0-2 2Z" />
            <path d="M5 4.5v15" />
            <path d="M9 7.5h6M9 11h6" />
        </svg>
    );
}

export function IconPeople({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
            <circle cx="16.5" cy="9" r="2.4" />
            <path d="M14.2 14.6c1.7-.5 3.6.1 4.8 2.1.4.7.6 1.5.7 2.3" />
        </svg>
    );
}

export function IconFuel({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="4" width="11" height="16.5" rx="1.5" />
            <path d="M7 8h4" />
            <path d="M14.5 8.5h2.2a2 2 0 0 1 2 2V16a2 2 0 0 0 2 2h.8" />
            <path d="M14.5 20.5V4" />
        </svg>
    );
}

export function IconMoto({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6.5" cy="16.5" r="3" />
            <circle cx="17.5" cy="16.5" r="3" />
            <path d="M9.5 16.5h4.2L16 11.5h3" />
            <path d="M12.2 11.5 10 16.5M12.2 11.5 9.2 8.2H6.5" />
            <path d="M15.8 11.5h2.4l1.3-2.2" />
        </svg>
    );
}

export function IconSport({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="9" width="2.5" height="6" rx="1" />
            <rect x="5" y="7.5" width="3" height="9" rx="1" />
            <path d="M8 12h8" />
            <rect x="16" y="7.5" width="3" height="9" rx="1" />
            <rect x="19" y="9" width="2.5" height="6" rx="1" />
        </svg>
    );
}

/** Bizum-style mark: lightning bolt + two dots. */
export function IconBizum({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
            <path d="M13.4 2.2 6.2 13.1h5.05L9 21.8l8.2-11.4h-5.05L13.4 2.2Z" />
            <circle cx="18.35" cy="16.1" r="1.55" />
            <circle cx="20.7" cy="19.35" r="1.55" />
        </svg>
    );
}

export function IconCoffee({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5.5 8.5h10.5v7a3.5 3.5 0 0 1-3.5 3.5h-3.5A3.5 3.5 0 0 1 5.5 15.5Z" />
            <path d="M16 10.5h1.8a2.7 2.7 0 1 1 0 5.4H16" />
            <path d="M8 4.5c.4.6.4 1.2 0 1.8M11 4.5c.4.6.4 1.2 0 1.8" />
            <path d="M5 21h11.5" />
        </svg>
    );
}

export function IconPhone({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
            <path d="M11 18.5h2" />
        </svg>
    );
}

export function IconDots({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="17.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
    );
}

export const CATEGORY_ICON_COMPONENTS: Record<CategoryIconKey, (props: { className?: string }) => ReactElement> = {
    food: IconUtensils,
    transport: IconCar,
    shopping: IconShoppingBag,
    services: IconWrench,
    salary: IconBriefcase,
    investments: IconTrendingUp,
    gift: IconGift,
    home: IconHome,
    health: IconHeart,
    entertainment: IconTicket,
    travel: IconPlane,
    education: IconBook,
    people: IconPeople,
    fuel: IconFuel,
    moto: IconMoto,
    sport: IconSport,
    bizum: IconBizum,
    bolt: IconBolt,
    coffee: IconCoffee,
    phone: IconPhone,
    other: IconDots,
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

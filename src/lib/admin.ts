export const ADMIN_USERNAME = "jan";

export function isAdminUsername(username: string): boolean {
    return username === ADMIN_USERNAME;
}

export type AdminUserSummary = {
    username: string;
    createdAt: string;
    lastSeenAt: string | null;
    language: string | null;
    currency: string;
    transactionCount: number;
    accountCount: number;
    balance: number;
    activeSessionCount: number;
};

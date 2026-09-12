export const ADMIN_USERNAME = "jan";

export function isAdminUsername(username: string): boolean {
    return username === ADMIN_USERNAME;
}

export type AdminUserSummary = {
    username: string;
    createdAt: string;
    language: string | null;
    currency: string;
    transactionCount: number;
    accountCount: number;
    lastActivityAt: string | null;
    activeSessionCount: number;
};

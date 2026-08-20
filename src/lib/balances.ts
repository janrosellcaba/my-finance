export type BalanceTx = {
    type: "income" | "expense" | "transfer";
    amount: number;
    accountId: string;
    destinationId: string;
};

export function applyTransactionToBalances(balances: Record<string, number>, tx: BalanceTx): void {
    if (tx.type === "expense") {
        if (tx.accountId in balances) balances[tx.accountId] = round2(balances[tx.accountId] - tx.amount);
    } else if (tx.type === "income") {
        if (tx.accountId in balances) balances[tx.accountId] = round2(balances[tx.accountId] + tx.amount);
    } else {
        if (tx.accountId in balances) balances[tx.accountId] = round2(balances[tx.accountId] - tx.amount);
        if (tx.destinationId in balances) balances[tx.destinationId] = round2(balances[tx.destinationId] + tx.amount);
    }
}

export function applyTransactionToNetWorth(total: number, tx: BalanceTx): number {
    if (tx.type === "expense") return round2(total - tx.amount);
    if (tx.type === "income") return round2(total + tx.amount);
    return round2(total);
}

export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

"use client";

import { useState } from "react";

const ACCOUNTS = ["Imagin Main", "Imagin Savings", "Imagin EMH", "MyInvestor Fix", "MyInvestor Var."];

const EXPENSE_CATEGORIES = [
	"Clàudia",
	"Food & Drinks",
	"Moto Rental",
	"Gas",
	"Social",
	"Gym",
	"Transport",
	"Sport",
	"Travel",
	"Services",
	"Other",
];

const INCOME_CATEGORIES = ["Salary", "Gift & Prices", "Bizum", "Other"];

const TRANSACTION_TYPES = ["Income", "Expense", "Transfer"] as const;
type TransactionType = (typeof TRANSACTION_TYPES)[number];

function todayISO() {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function categoryOptionsFor(type: TransactionType) {
	if (type === "Income") return INCOME_CATEGORIES;
	if (type === "Expense") return EXPENSE_CATEGORIES;
	return ACCOUNTS;
}

function categoryLabelFor(type: TransactionType) {
	return type === "Transfer" ? "Destination" : "Category";
}

const TYPE_STYLES: Record<TransactionType, string> = {
	Income: "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/25",
	Expense: "bg-red-500 text-white border-red-500 shadow-md shadow-red-500/25",
	Transfer: "bg-yellow-500 text-white border-yellow-500 shadow-md shadow-yellow-500/25",
};

export default function Home() {
	const [date, setDate] = useState(todayISO());
	const [description, setDescription] = useState("");
	const [type, setType] = useState<TransactionType>("Expense");
	const [account, setAccount] = useState(ACCOUNTS[0]);
	const [category, setCategory] = useState("");
	const [amount, setAmount] = useState("");
	const [showSuccess, setShowSuccess] = useState(false);

	function handleTypeChange(next: TransactionType) {
		setType(next);
		setCategory("");
	}

	function handleAddTransaction(e: React.FormEvent) {
		e.preventDefault();

		setDescription("");
		setAmount("");
		setCategory("");
		setDate(todayISO());

		setShowSuccess(true);
		setTimeout(() => setShowSuccess(false), 2500);
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
			<div className="w-full max-w-md">
				<div className="mb-8 text-center">
					<h1 className="[font-family:var(--font-outfit)] text-3xl font-extrabold tracking-tight text-emerald-950">
						MyFinance
					</h1>
					<p className="mt-1.5 text-sm text-emerald-700/60">Add a new transaction</p>
				</div>

				<form
					onSubmit={handleAddTransaction}
					className="rounded-3xl border border-emerald-900/5 bg-white shadow-xl shadow-emerald-900/10 p-7 space-y-5"
				>
					<div>
						<label
							htmlFor="date"
							className="block text-xs font-semibold uppercase tracking-wide text-emerald-800/50 mb-1.5"
						>
							Date
						</label>
						<input
							id="date"
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							required
							className="w-full rounded-xl border border-emerald-900/10 bg-emerald-50/50 px-3.5 py-2.5 text-sm text-emerald-950 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition"
						/>
					</div>

					<div>
						<label
							htmlFor="description"
							className="block text-xs font-semibold uppercase tracking-wide text-emerald-800/50 mb-1.5"
						>
							Description
						</label>
						<input
							id="description"
							type="text"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="e.g. Groceries at Mercadona"
							className="w-full rounded-xl border border-emerald-900/10 bg-emerald-50/50 px-3.5 py-2.5 text-sm text-emerald-950 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition placeholder:text-emerald-900/30"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold uppercase tracking-wide text-emerald-800/50 mb-1.5">
							Type
						</label>
						<div className="grid grid-cols-3 gap-2">
							{TRANSACTION_TYPES.map((t) => (
								<button
									key={t}
									type="button"
									onClick={() => handleTypeChange(t)}
									className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
										type === t
											? TYPE_STYLES[t]
											: "border-emerald-900/10 bg-emerald-50/50 text-emerald-800/50 hover:bg-emerald-100/60"
									}`}
								>
									{t}
								</button>
							))}
						</div>
					</div>

					<div>
						<label
							htmlFor="account"
							className="block text-xs font-semibold uppercase tracking-wide text-emerald-800/50 mb-1.5"
						>
							Account
						</label>
						<select
							id="account"
							value={account}
							onChange={(e) => setAccount(e.target.value)}
							className="w-full rounded-xl border border-emerald-900/10 bg-emerald-50/50 px-3.5 py-2.5 text-sm text-emerald-950 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition"
						>
							{ACCOUNTS.map((a) => (
								<option key={a} value={a}>
									{a}
								</option>
							))}
						</select>
					</div>

					<div>
						<label
							htmlFor="category"
							className="block text-xs font-semibold uppercase tracking-wide text-emerald-800/50 mb-1.5"
						>
							{categoryLabelFor(type)}
						</label>
						<select
							id="category"
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							required
							className="w-full rounded-xl border border-emerald-900/10 bg-emerald-50/50 px-3.5 py-2.5 text-sm text-emerald-950 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition"
						>
							<option value="" disabled>
								Select {categoryLabelFor(type).toLowerCase()}
							</option>
							{categoryOptionsFor(type).map((c) => (
								<option key={c} value={c}>
									{c}
								</option>
							))}
						</select>
					</div>

					<div>
						<label
							htmlFor="amount"
							className="block text-xs font-semibold uppercase tracking-wide text-emerald-800/50 mb-1.5"
						>
							Amount
						</label>
						<div className="relative">
							<span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700/40 text-sm font-medium">
								€
							</span>
							<input
								id="amount"
								type="number"
								step="0.01"
								min="0"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder="0.00"
								required
								className="w-full rounded-xl border border-emerald-900/10 bg-emerald-50/50 pl-7.5 pr-3.5 py-2.5 text-sm text-emerald-950 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition placeholder:text-emerald-900/30"
							/>
						</div>
					</div>

					<button
						type="submit"
						className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white [font-family:var(--font-outfit)] font-semibold text-sm py-3 shadow-lg shadow-emerald-500/25 transition hover:shadow-emerald-500/40 hover:brightness-105 active:scale-[0.99]"
					>
						Add Transaction
					</button>

					{showSuccess && (
						<div className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold px-3 py-2.5 text-center">
							<span>✓</span> Transaction added
						</div>
					)}
				</form>
			</div>
		</div>
	);
}

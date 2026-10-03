import { LANGUAGE_OPTIONS, type Language, type MessageKey, type TFunction } from "@/i18n";
import {
    buildAnalyticsSnapshot,
    type AnalyticsResult,
    type AnalyticsSnapshot,
    type AnalyticsSnapshotLabels,
    type HealthPart,
} from "./analytics";

function snapshotLabels(t: TFunction): AnalyticsSnapshotLabels {
    return {
        healthLabel: {
            notEnough: t("analytics.healthNotEnough"),
            lookingStrong: t("analytics.healthLookingStrong"),
            trackingWell: t("analytics.healthTrackingWell"),
            worthALook: t("analytics.healthWorthALook"),
            needsALook: t("analytics.healthNeedsALook"),
        },
        healthPart: {
            savings: t("analytics.healthSavings"),
            spending: t("analytics.healthSpending"),
            trend: t("analytics.healthNetWorth"),
            cushion: t("analytics.healthCushion"),
        },
        healthNote: (p: HealthPart) => {
            switch (p.noteKey) {
                case "savingsRate":
                    return t("analytics.noteSavingsRate", p.noteParams);
                case "spendLess":
                    return t("analytics.noteSpendLess", p.noteParams);
                case "spendMore":
                    return t("analytics.noteSpendMore", p.noteParams);
                case "nwUp":
                    return t("analytics.noteNwUp", p.noteParams);
                case "nwDown":
                    return t("analytics.noteNwDown", p.noteParams);
                case "cushion":
                    return t("analytics.noteCushion", p.noteParams);
            }
        },
    };
}

function oneLine(text: string) {
    return text.replace(/\s+/g, " ").trim();
}

function commentLine(depth: number, text: string) {
    return `${"  ".repeat(depth)}// ${oneLine(text)}`;
}

function fieldLine(depth: number, key: string, valueJson: string, comma: boolean) {
    return `${"  ".repeat(depth)}${JSON.stringify(key)}: ${valueJson}${comma ? "," : ""}`;
}

function commentedValue(depth: number, comment: MessageKey, key: string, value: unknown, comma: boolean, t: TFunction) {
    const pad = "  ".repeat(depth);
    const raw = JSON.stringify(value, null, 2);
    const body =
        raw.includes("\n")
            ? raw
                  .split("\n")
                  .map((line, i) => (i === 0 ? line : pad + line))
                  .join("\n")
            : raw;
    return `${commentLine(depth, t(comment))}\n${fieldLine(depth, key, body, comma)}`;
}

function objectField(depth: number, comment: MessageKey, key: string, inner: string[], comma: boolean, t: TFunction) {
    const pad = "  ".repeat(depth);
    return `${commentLine(depth, t(comment))}\n${fieldLine(depth, key, `{\n${inner.join("\n")}\n${pad}}`, comma)}`;
}

function emitVsPrevious(vs: AnalyticsSnapshot["summary"]["vsPrevious"], t: TFunction) {
    if (vs === null) {
        return commentedValue(2, "analytics.cSummaryVsPrevious", "vsPrevious", null, false, t);
    }
    return objectField(
        2,
        "analytics.cSummaryVsPrevious",
        "vsPrevious",
        [
            commentedValue(3, "analytics.cVsPreviousTruncated", "previousTruncatedToMatchPartialMonth", vs.previousTruncatedToMatchPartialMonth, true, t),
            commentedValue(3, "analytics.cVsPreviousSpent", "spent", vs.spent, true, t),
            commentedValue(3, "analytics.cVsPreviousEarned", "earned", vs.earned, true, t),
            commentedValue(3, "analytics.cVsPreviousLeftOver", "leftOver", vs.leftOver, false, t),
        ],
        false,
        t,
    );
}

function emitCommentedSnapshot(
    snapshot: AnalyticsSnapshot,
    t: TFunction,
    replyLanguage: string,
    generatedAt: string,
) {
    const { period, score, summary, netWorth } = snapshot;
    return [
        "{",
        commentedValue(1, "analytics.cGeneratedAt", "generatedAt", generatedAt, true, t),
        commentedValue(1, "analytics.cLanguage", "language", replyLanguage, true, t),
        commentedValue(1, "analytics.cCurrency", "currency", snapshot.currency, true, t),
        objectField(
            1,
            "analytics.cPeriod",
            "period",
            [
                commentedValue(2, "analytics.cPeriodMode", "mode", period.mode, true, t),
                commentedValue(2, "analytics.cPeriodLabel", "label", period.label, true, t),
                commentedValue(2, "analytics.cPeriodStart", "start", period.start, true, t),
                commentedValue(2, "analytics.cPeriodEnd", "end", period.end, true, t),
                commentedValue(2, "analytics.cPeriodPartial", "isPartial", period.isPartial, true, t),
                commentedValue(2, "analytics.cPeriodElapsed", "elapsedDays", period.elapsedDays, true, t),
                commentedValue(2, "analytics.cPeriodTotal", "totalDays", period.totalDays, true, t),
                commentedValue(2, "analytics.cPeriodAccount", "account", period.account, false, t),
            ],
            true,
            t,
        ),
        objectField(
            1,
            "analytics.cScore",
            "score",
            [
                commentedValue(2, "analytics.cScoreValue", "value", score.value, true, t),
                commentedValue(2, "analytics.cScoreLabel", "label", score.label, true, t),
                commentedValue(2, "analytics.cScoreParts", "parts", score.parts, false, t),
            ],
            true,
            t,
        ),
        objectField(
            1,
            "analytics.cSummary",
            "summary",
            [
                commentedValue(2, "analytics.cSummarySpent", "spent", summary.spent, true, t),
                commentedValue(2, "analytics.cSummaryEarned", "earned", summary.earned, true, t),
                commentedValue(2, "analytics.cSummaryLeftOver", "leftOver", summary.leftOver, true, t),
                commentedValue(2, "analytics.cSummarySavingsRate", "savingsRatePct", summary.savingsRatePct, true, t),
                commentedValue(2, "analytics.cSummaryPurchases", "purchases", summary.purchases, true, t),
                commentedValue(2, "analytics.cSummaryPerDay", "perDay", summary.perDay, true, t),
                emitVsPrevious(summary.vsPrevious, t),
            ],
            true,
            t,
        ),
        commentedValue(1, "analytics.cByAccount", "byAccount", snapshot.byAccount, true, t),
        commentedValue(1, "analytics.cTransfers", "transfers", snapshot.transfers, true, t),
        commentedValue(1, "analytics.cSpendingByCategory", "spendingByCategory", snapshot.spendingByCategory, true, t),
        commentedValue(1, "analytics.cBiggestPurchases", "biggestPurchases", snapshot.biggestPurchases, true, t),
        commentedValue(1, "analytics.cMonthByMonth", "monthByMonth", snapshot.monthByMonth, true, t),
        commentedValue(1, "analytics.cAccountBalances", "accountBalances", snapshot.accountBalances, true, t),
        commentedValue(1, "analytics.cIncomeByCategory", "incomeByCategory", snapshot.incomeByCategory, true, t),
        objectField(
            1,
            "analytics.cNetWorth",
            "netWorth",
            [
                commentedValue(2, "analytics.cNetWorthCurrent", "current", netWorth.current, true, t),
                commentedValue(2, "analytics.cNetWorthAsOf", "asOf", netWorth.asOf, true, t),
                commentedValue(2, "analytics.cNetWorthSince", "since", netWorth.since, true, t),
                commentedValue(2, "analytics.cNetWorthAtPeriodStart", "atPeriodStart", netWorth.atPeriodStart, true, t),
                commentedValue(2, "analytics.cNetWorthChange", "change", netWorth.change, true, t),
                commentedValue(2, "analytics.cNetWorthHigh", "high", netWorth.high, true, t),
                commentedValue(2, "analytics.cNetWorthLow", "low", netWorth.low, true, t),
                commentedValue(2, "analytics.cNetWorthMonthly", "monthly", netWorth.monthly, false, t),
            ],
            false,
            t,
        ),
        "}",
    ].join("\n");
}

export function buildAnalyticsAiBrief(
    data: AnalyticsResult,
    opts: {
        t: TFunction;
        language: Language;
        accountName: string | null;
        currency: string;
        periodLabel: string;
    },
): string {
    const { t, language } = opts;
    const replyLanguage = LANGUAGE_OPTIONS.find((option) => option.key === language)?.nativeName ?? language;
    const snapshot = buildAnalyticsSnapshot(data, {
        accountName: opts.accountName,
        currency: opts.currency,
        periodLabel: opts.periodLabel,
        labels: snapshotLabels(t),
        allAccountsLabel: t("analytics.allAccounts"),
    });
    const generatedAt = new Date().toISOString().slice(0, 10);
    return [
        t("analytics.aiRole"),
        "",
        t("analytics.aiJob"),
        "",
        t("analytics.aiRules", { language: replyLanguage }),
        "",
        t("analytics.aiLegend"),
        "",
        t("analytics.aiDataHeading"),
        emitCommentedSnapshot(snapshot, t, replyLanguage, generatedAt),
    ].join("\n");
}

import type { TFunction } from "@/i18n";

export function assetTypeLabel(t: TFunction, type: string): string {
    switch (type) {
        case "fund":
            return t("markets.typeFund");
        case "etf":
            return t("markets.typeEtf");
        case "stock":
            return t("markets.typeStock");
        case "index":
            return t("markets.typeIndex");
        case "crypto":
            return t("markets.typeCrypto");
        case "currency":
            return t("markets.typeCurrency");
        default:
            return type;
    }
}
